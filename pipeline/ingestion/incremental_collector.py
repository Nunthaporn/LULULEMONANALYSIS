from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from pipeline.config import get_config
from pipeline.ingestion.checkpoint_store import CheckpointStore
from pipeline.ingestion.retry_policy import (
    NonRetryableSourceError,
    RetryableSourceError,
    SourceAccessBlockedError,
    SourceAuthenticationError,
    redact_sensitive_text,
)
from pipeline.ingestion.run_logger import RunLogger
from pipeline.ingestion.source_client import LululemonGraphQLReviewSourceClient, ReviewSourceClient
from pipeline.pipeline_common import (
    REVIEW_FIELDNAMES,
    ensure_pipeline_dirs,
    log,
    read_products,
    write_csv_rows,
    write_json,
)
from pipeline.storage.raw_store import RawRunStore
from pipeline.storage.review_repository import ReviewRepository, utc_now_iso


@dataclass
class ProductCollectionStats:
    product_id: str
    product_name: str
    source_reported_total: int = 0
    canonical_total_before: int = 0
    canonical_total_after: int = 0
    new_reviews: int = 0
    updated_reviews: int = 0
    unchanged_reviews: int = 0
    duplicate_reviews: int = 0
    invalid_reviews: int = 0
    pages_requested: int = 0
    reviews_seen: int = 0
    status: str = "pending"
    notes: str = ""
    newest_seen_at: str | None = None


def _append_reconciliation_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "run_id",
        "product_id",
        "product_name",
        "source_reported_total",
        "canonical_total_before",
        "new_reviews",
        "updated_reviews",
        "unchanged_reviews",
        "canonical_total_after",
        "difference_to_source",
        "status",
        "notes",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not path.exists()
    with path.open("a", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerows(rows)


class IncrementalCollector:
    def __init__(
        self,
        *,
        source_client: ReviewSourceClient | None = None,
        repository: ReviewRepository | None = None,
        checkpoint_store: CheckpointStore | None = None,
        run_logger: RunLogger | None = None,
        raw_store: RawRunStore | None = None,
        config=None,
    ) -> None:
        self.config = config or get_config()
        self.source_client = source_client or LululemonGraphQLReviewSourceClient()
        self.repository = repository or ReviewRepository(self.config.state_db_path)
        self.checkpoint_store = checkpoint_store or CheckpointStore(self.config.state_db_path)
        self.run_logger = run_logger or RunLogger(self.config.state_db_path)
        self.raw_store = raw_store or RawRunStore(self.config.raw_runs_dir)

    def _cooldown_until(self) -> str:
        return (
            datetime.now(timezone.utc)
            + timedelta(seconds=max(self.config.circuit_breaker_cooldown_seconds, 0))
        ).isoformat()

    def _export_canonical_reviews(self) -> None:
        rows = self.repository.list_active_reviews()
        write_csv_rows(self.config.processed_dir / "all_reviews.csv", rows, REVIEW_FIELDNAMES)
        write_json(self.config.processed_dir / "all_reviews.json", rows)

    def _compare_reviews(self, reviews: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, int]:
        existing = self.repository.get_existing_reviews(
            [(row["product_id"], row["review_id"]) for row in reviews]
        )
        new_rows: list[dict[str, Any]] = []
        changed_rows: list[dict[str, Any]] = []
        unchanged_count = 0
        duplicate_count = 0
        seen_keys: set[tuple[str, str]] = set()

        for row in reviews:
            key = (row["product_id"], row["review_id"])
            if key in seen_keys:
                duplicate_count += 1
                continue
            seen_keys.add(key)
            existing_row = existing.get(key)
            if existing_row is None:
                new_rows.append(row)
            elif self.repository.review_has_changed(row, existing_row):
                changed_rows.append(row)
            else:
                unchanged_count += 1
        return new_rows, changed_rows, unchanged_count, duplicate_count

    def collect(
        self,
        *,
        mode: str = "incremental",
        dry_run: bool = False,
        export_canonical: bool = True,
    ) -> dict[str, Any]:
        ensure_pipeline_dirs()
        products = read_products(self.config.data_dir / "input" / "products.csv")
        run_id = self.run_logger.start_run(
            status="dry_run" if dry_run else f"{mode}_running"
        )
        started_at = utc_now_iso()
        raw_paths = None if dry_run else self.raw_store.create_run_paths(run_id, started_at)

        metrics = {
            "products_attempted": 0,
            "products_succeeded": 0,
            "products_failed": 0,
            "pages_requested": 0,
            "reviews_seen": 0,
            "new_reviews": 0,
            "updated_reviews": 0,
            "duplicate_reviews": 0,
            "http_403_count": 0,
            "http_429_count": 0,
            "server_error_count": 0,
            "timeout_count": 0,
            "schema_error_count": 0,
        }
        reconciliation_rows: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []
        stop_collection = False

        try:
            for product in products:
                if stop_collection:
                    break

                metrics["products_attempted"] += 1
                product_id = product["product_id"]
                checkpoint = self.checkpoint_store.get_checkpoint(product_id)
                stats = ProductCollectionStats(
                    product_id=product_id,
                    product_name=product["product_name"],
                    canonical_total_before=self.repository.count_reviews_for_product(product_id),
                )

                if checkpoint and checkpoint.cooldown_until:
                    cooldown_until = datetime.fromisoformat(
                        checkpoint.cooldown_until.replace("Z", "+00:00")
                    )
                    if cooldown_until > datetime.now(timezone.utc):
                        stats.status = "skipped_cooldown"
                        stats.notes = (
                            f"Skipped due to cooldown until {checkpoint.cooldown_until}."
                        )
                        reconciliation_rows.append(
                            self._build_reconciliation_row(run_id, stats)
                        )
                        continue

                try:
                    self._collect_product(
                        run_id=run_id,
                        product=product,
                        stats=stats,
                        dry_run=dry_run,
                        mode=mode,
                        raw_run_dir=raw_paths.run_dir if raw_paths else None,
                    )
                except SourceAccessBlockedError as exc:
                    metrics["products_failed"] += 1
                    metrics["http_403_count"] += 1
                    stats.status = "source_blocked"
                    stats.notes = str(exc)
                    if not dry_run:
                        self.checkpoint_store.record_failure(
                            product_id=product_id,
                            source_product_key=product["productNameId"],
                            run_id=run_id,
                            cooldown_until=self._cooldown_until(),
                        )
                    self._log_failure(
                        run_id=run_id,
                        product_id=product_id,
                        stage="fetch_page",
                        error=exc,
                    )
                    failures.append({"product_id": product_id, "error": str(exc)})
                    stop_collection = True
                except SourceAuthenticationError as exc:
                    metrics["products_failed"] += 1
                    stats.status = "auth_failed"
                    stats.notes = str(exc)
                    self._log_failure(
                        run_id=run_id,
                        product_id=product_id,
                        stage="fetch_page",
                        error=exc,
                    )
                    failures.append({"product_id": product_id, "error": str(exc)})
                    stop_collection = True
                except (RetryableSourceError, NonRetryableSourceError, Exception) as exc:  # noqa: BLE001
                    metrics["products_failed"] += 1
                    stats.status = "failed"
                    stats.notes = redact_sensitive_text(str(exc))
                    self._increment_error_metrics(metrics, exc)
                    self._log_failure(
                        run_id=run_id,
                        product_id=product_id,
                        stage="collect_product",
                        error=exc,
                    )
                    failures.append({"product_id": product_id, "error": stats.notes})
                    if checkpoint is None or checkpoint.consecutive_failures + 1 >= self.config.circuit_breaker_failure_threshold:
                        cooldown_until = self._cooldown_until()
                    else:
                        cooldown_until = None
                    if not dry_run:
                        self.checkpoint_store.record_failure(
                            product_id=product_id,
                            source_product_key=product["productNameId"],
                            run_id=run_id,
                            cooldown_until=cooldown_until,
                        )
                    if isinstance(exc, SourceAccessBlockedError):
                        stop_collection = True
                else:
                    metrics["products_succeeded"] += 1
                    metrics["pages_requested"] += stats.pages_requested
                    metrics["reviews_seen"] += stats.reviews_seen
                    metrics["new_reviews"] += stats.new_reviews
                    metrics["updated_reviews"] += stats.updated_reviews
                    metrics["duplicate_reviews"] += stats.duplicate_reviews
                    stats.canonical_total_after = self.repository.count_reviews_for_product(product_id)

                reconciliation_rows.append(self._build_reconciliation_row(run_id, stats))

            if reconciliation_rows:
                _append_reconciliation_rows(
                    self.config.processed_dir / "reconciliation_report.csv",
                    reconciliation_rows,
                )

            if export_canonical and not dry_run:
                self._export_canonical_reviews()

            finished_at = utc_now_iso()
            if raw_paths is not None:
                self.raw_store.write_manifest(
                    raw_paths.manifest_path,
                    {
                        "run_id": run_id,
                        "started_at": started_at,
                        "finished_at": finished_at,
                        "source_adapter": self.source_client.get_source_metadata(),
                        "products_attempted": metrics["products_attempted"],
                        "pages_requested": metrics["pages_requested"],
                        "reviews_seen": metrics["reviews_seen"],
                        "new_reviews": metrics["new_reviews"],
                        "updated_reviews": metrics["updated_reviews"],
                        "failures": failures,
                        "schema_version": self.config.schema_version,
                    },
                )

            self.run_logger.finish_run(
                run_id,
                status="dry_run_completed" if dry_run else f"{mode}_completed",
                **metrics,
            )
            return {
                "run_id": run_id,
                "metrics": metrics,
                "reconciliation_rows": reconciliation_rows,
                "failures": failures,
            }
        except Exception as exc:  # noqa: BLE001
            self.run_logger.finish_run(
                run_id,
                status="failed",
                error_message=redact_sensitive_text(str(exc)),
                **metrics,
            )
            raise

    def _collect_product(
        self,
        *,
        run_id: str,
        product: dict[str, str],
        stats: ProductCollectionStats,
        dry_run: bool,
        mode: str,
        raw_run_dir: Path | None,
    ) -> None:
        known_stable_pages = 0
        collected_delta: list[dict[str, Any]] = []
        newest_seen_at: str | None = None
        max_pages = self.config.max_pages_per_product
        if mode == "full-reconcile":
            max_pages = max(max_pages, 1000)
            known_page_stop_threshold = max(max_pages, self.config.known_page_stop_threshold)
        else:
            known_page_stop_threshold = self.config.known_page_stop_threshold

        for page in self.source_client.iter_pages(
            product=product,
            max_pages=max_pages,
            max_reviews=self.config.max_reviews_per_product_run,
        ):
            stats.pages_requested += 1
            stats.reviews_seen += len(page.normalized_reviews)
            stats.source_reported_total = page.total_results
            stats.duplicate_reviews += page.duplicate_count
            stats.invalid_reviews += page.invalid_count

            if raw_run_dir is not None:
                self.raw_store.write_page(
                    run_dir=raw_run_dir,
                    product_id=product["product_id"],
                    page_number=page.page_number,
                    payload=page.raw_payload,
                )

            valid_reviews = []
            for review in page.normalized_reviews:
                try:
                    self.source_client.validate_normalized_review(review)
                except ValueError as exc:
                    stats.invalid_reviews += 1
                    self.run_logger.log_error(
                        run_id=run_id,
                        product_id=product["product_id"],
                        stage="validate_review",
                        error_type="invalid_record",
                        message=redact_sensitive_text(str(exc)),
                        page_offset_or_cursor=str(page.offset),
                    )
                    continue
                valid_reviews.append(review)

            new_rows, changed_rows, unchanged_count, duplicate_count = self._compare_reviews(valid_reviews)
            stats.new_reviews += len(new_rows)
            stats.updated_reviews += len(changed_rows)
            stats.unchanged_reviews += unchanged_count
            stats.duplicate_reviews += duplicate_count
            collected_delta.extend(new_rows)
            collected_delta.extend(changed_rows)

            for review in valid_reviews:
                submission_time = review.get("submission_time") or ""
                if submission_time and (newest_seen_at is None or submission_time > newest_seen_at):
                    newest_seen_at = submission_time

            if not new_rows and not changed_rows:
                known_stable_pages += 1
            else:
                known_stable_pages = 0

            if known_stable_pages >= known_page_stop_threshold:
                stats.notes = (
                    "Stopped after consecutive no-change pages. "
                    "Source uses Rating:asc sort, so incremental mode uses bounded reconciliation."
                )
                break

            if stats.pages_requested >= max_pages:
                stats.notes = (
                    "Stopped at configured page budget. "
                    "Source uses Rating:asc sort, so full historical freshness is not guaranteed."
                )
                break

        if not dry_run and collected_delta:
            self.repository.bulk_upsert_reviews(collected_delta, ingestion_run_id=run_id)
        stats.newest_seen_at = newest_seen_at
        stats.status = "completed"
        stats.canonical_total_after = (
            stats.canonical_total_before
            if dry_run
            else self.repository.count_reviews_for_product(product["product_id"])
        )
        if not dry_run:
            self.checkpoint_store.record_success(
                product_id=product["product_id"],
                source_product_key=product["productNameId"],
                newest_seen_at=newest_seen_at,
                total_results_seen=stats.source_reported_total,
                run_id=run_id,
            )

    def _increment_error_metrics(self, metrics: dict[str, int], error: Exception) -> None:
        if isinstance(error, SourceAccessBlockedError):
            metrics["http_403_count"] += 1
        elif isinstance(error, RetryableSourceError):
            if error.error_type == "http_429":
                metrics["http_429_count"] += 1
            elif error.error_type == "server_error":
                metrics["server_error_count"] += 1
            elif error.error_type in {"timeout", "connection_error"}:
                metrics["timeout_count"] += 1
        elif isinstance(error, NonRetryableSourceError) and error.error_type == "schema_mismatch":
            metrics["schema_error_count"] += 1

    def _log_failure(
        self,
        *,
        run_id: str,
        product_id: str,
        stage: str,
        error: Exception,
    ) -> None:
        if isinstance(error, RetryableSourceError):
            error_type = error.error_type
            status_code = error.status_code
        elif isinstance(error, NonRetryableSourceError):
            error_type = error.error_type
            status_code = error.status_code
        else:
            error_type = "collector_error"
            status_code = None
        self.run_logger.log_error(
            run_id=run_id,
            product_id=product_id,
            stage=stage,
            error_type=error_type,
            status_code=status_code,
            message=redact_sensitive_text(str(error)),
        )

    def _build_reconciliation_row(
        self,
        run_id: str,
        stats: ProductCollectionStats,
    ) -> dict[str, Any]:
        canonical_total_after = (
            stats.canonical_total_after or stats.canonical_total_before
        )
        return {
            "run_id": run_id,
            "product_id": stats.product_id,
            "product_name": stats.product_name,
            "source_reported_total": stats.source_reported_total,
            "canonical_total_before": stats.canonical_total_before,
            "new_reviews": stats.new_reviews,
            "updated_reviews": stats.updated_reviews,
            "unchanged_reviews": stats.unchanged_reviews,
            "canonical_total_after": canonical_total_after,
            "difference_to_source": canonical_total_after - stats.source_reported_total,
            "status": stats.status,
            "notes": stats.notes,
        }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run incremental review collection.")
    parser.add_argument("--mode", default="incremental", choices=["incremental", "full-reconcile"])
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    collector = IncrementalCollector()
    result = collector.collect(mode=args.mode, dry_run=args.dry_run)
    log(
        f"Incremental collector completed: run_id={result['run_id']} "
        f"new={result['metrics']['new_reviews']} updated={result['metrics']['updated_reviews']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
