from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from pipeline.config import get_config, reset_config_cache
from pipeline.ingestion.checkpoint_store import CheckpointStore
from pipeline.ingestion.incremental_collector import IncrementalCollector
from pipeline.ingestion.retry_policy import (
    NonRetryableSourceError,
    RetryPolicy,
    RetryableSourceError,
    SourceAccessBlockedError,
    redact_sensitive_text,
)
from pipeline.ingestion.source_client import NormalizedPage
from pipeline.storage.raw_store import RawRunStore
from pipeline.storage.review_repository import ReviewRepository


def sample_product():
    return {
        "product_name": "Define Jacket Nulu",
        "product_id": "define_jacket_nulu",
        "productNameId": "Define_Jacket_Nulu",
        "product_url": "https://shop.example.com/product",
        "category": "Jackets",
    }


def sample_review(review_id: str, review_text: str = "Quality issue", rating: int = 1):
    return {
        "product_name": "Define Jacket Nulu",
        "product_id": "define_jacket_nulu",
        "productNameId": "Define_Jacket_Nulu",
        "product_url": "https://shop.example.com/product",
        "category": "Jackets",
        "review_id": review_id,
        "rating": rating,
        "title": "Issue",
        "review_text": review_text,
        "submission_time": "2026-05-23T03:07:43.000+00:00",
        "author": "guest",
        "is_staff": False,
        "is_verified_buyer": False,
        "badge": "",
        "likes": 0,
        "incentivized_review_label": "",
        "fit_feedback": "",
        "height": "",
        "weight": "",
        "size_purchased": "",
        "usual_size": "",
        "total_comments": 0,
        "comments_json": "[]",
        "lulu_response_author": "",
        "lulu_response_text": "",
        "lulu_response_time": "",
        "photo_count": 0,
        "photo_ids": "",
        "photo_urls": "",
        "photo_thumbnails": "",
        "photo_captions": "",
        "complaint_theme": "",
        "business_insight": "",
        "matched_defect_code": "",
        "matched_defect_desc": "",
        "matched_defect_group_code": "",
        "matched_defect_group": "",
        "similarity_score": 0.0,
        "semantic_match_method": "",
        "operation_related": False,
        "confidence_score": 0.0,
        "scraped_at": "2026-05-28T07:52:53.589785+00:00",
        "source_updated_at": "",
    }


class FakeSourceClient:
    def __init__(self, pages_by_product, *, raise_for_product=None):
        self.pages_by_product = pages_by_product
        self.raise_for_product = raise_for_product or {}

    def get_source_metadata(self):
        return {"source_adapter": "fake_source", "sort": "Rating:asc"}

    def validate_normalized_review(self, review):
        if not review.get("product_id") or not review.get("review_id"):
            raise ValueError("missing identity")
        rating = int(review.get("rating") or 0)
        if rating < 1 or rating > 5:
            raise ValueError("bad rating")

    def iter_pages(self, *, product, max_pages, max_reviews):
        error = self.raise_for_product.get(product["product_id"])
        if error is not None:
            raise error
        emitted = 0
        for page in self.pages_by_product.get(product["product_id"], [])[:max_pages]:
            yield page
            emitted += len(page.normalized_reviews)
            if emitted >= max_reviews:
                break


def make_page(page_number, reviews, *, total_results=10, has_more=True, duplicate_count=0, invalid_count=0):
    return NormalizedPage(
        page_number=page_number,
        offset=page_number * 16,
        limit=16,
        total_results=total_results,
        has_additional_reviews=has_more,
        normalized_reviews=reviews,
        duplicate_count=duplicate_count,
        invalid_count=invalid_count,
        raw_payload={"page": page_number, "results": reviews},
        source_metadata={"source_adapter": "fake_source"},
    )


def configure_env(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    processed_dir = data_dir / "processed"
    input_dir = data_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    products_csv = input_dir / "products.csv"
    with products_csv.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["product_name", "product_id", "productNameId", "product_url", "category"],
        )
        writer.writeheader()
        writer.writerow(sample_product())
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(data_dir))
    monkeypatch.setenv("PIPELINE_STATE_DB", str(data_dir / "state" / "pipeline_state.db"))
    monkeypatch.setenv("PIPELINE_OUTPUT_DIR", str(tmp_path / "public" / "data" / "dashboard_data"))
    monkeypatch.setenv("MAX_PAGES_PER_PRODUCT", "5")
    monkeypatch.setenv("KNOWN_PAGE_STOP_THRESHOLD", "2")
    monkeypatch.setenv("MAX_REVIEWS_PER_PRODUCT_RUN", "100")
    monkeypatch.setenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "2")
    monkeypatch.setenv("CIRCUIT_BREAKER_COOLDOWN_SECONDS", "60")
    reset_config_cache()
    config = get_config()
    return config


def build_collector(config, source_client):
    repository = ReviewRepository(config.state_db_path)
    checkpoint_store = CheckpointStore(config.state_db_path)
    raw_store = RawRunStore(config.raw_runs_dir)
    return IncrementalCollector(
        config=config,
        source_client=source_client,
        repository=repository,
        checkpoint_store=checkpoint_store,
        raw_store=raw_store,
    )


def test_new_changed_and_unchanged_detection(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    repository = ReviewRepository(config.state_db_path)
    repository.bulk_upsert_reviews([sample_review("1", "old text")], ingestion_run_id="baseline")

    source = FakeSourceClient(
        {
            "define_jacket_nulu": [
                make_page(
                    0,
                    [
                        sample_review("1", "updated text"),
                        sample_review("2", "brand new"),
                        sample_review("3", "unchanged"),
                    ],
                    has_more=False,
                )
            ]
        }
    )
    repository.bulk_upsert_reviews([sample_review("3", "unchanged")], ingestion_run_id="baseline")
    collector = build_collector(config, source)

    result = collector.collect(mode="incremental", dry_run=False)

    assert result["metrics"]["new_reviews"] == 1
    assert result["metrics"]["updated_reviews"] == 1
    review_row = repository.get_review("define_jacket_nulu", "1")
    assert review_row["review_text"] == "updated text"
    assert repository.count_reviews_for_product("define_jacket_nulu") == 3


def test_duplicate_page_data_and_checkpoint_update(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    source = FakeSourceClient(
        {
            "define_jacket_nulu": [
                make_page(
                    0,
                    [sample_review("1"), sample_review("1"), sample_review("2")],
                    has_more=False,
                )
            ]
        }
    )
    collector = build_collector(config, source)

    result = collector.collect(mode="incremental", dry_run=False)
    checkpoint = CheckpointStore(config.state_db_path).get_checkpoint("define_jacket_nulu")

    assert result["metrics"]["duplicate_reviews"] >= 1
    assert checkpoint is not None
    assert checkpoint.last_run_id == result["run_id"]
    assert checkpoint.consecutive_failures == 0


def test_page_budget_and_known_page_stopping(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    repository = ReviewRepository(config.state_db_path)
    repository.bulk_upsert_reviews([sample_review("1"), sample_review("2")], ingestion_run_id="baseline")
    source = FakeSourceClient(
        {
            "define_jacket_nulu": [
                make_page(0, [sample_review("1")]),
                make_page(1, [sample_review("2")]),
                make_page(2, [sample_review("3")]),
            ]
        }
    )
    collector = build_collector(config, source)

    result = collector.collect(mode="incremental", dry_run=False)

    assert result["metrics"]["pages_requested"] == 2
    assert repository.get_review("define_jacket_nulu", "3") is None


def test_403_immediate_stop_and_circuit_breaker(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    source = FakeSourceClient(
        {"define_jacket_nulu": []},
        raise_for_product={
            "define_jacket_nulu": SourceAccessBlockedError(
                "blocked",
                error_type="http_403",
                status_code=403,
            )
        },
    )
    collector = build_collector(config, source)
    result = collector.collect(mode="incremental", dry_run=False)
    checkpoint = CheckpointStore(config.state_db_path).get_checkpoint("define_jacket_nulu")

    assert result["metrics"]["http_403_count"] == 1
    assert checkpoint is not None
    assert checkpoint.consecutive_failures == 1


def test_partial_product_failure_preserves_successful_data(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    products_csv = config.data_dir / "input" / "products.csv"
    with products_csv.open("a", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["product_name", "product_id", "productNameId", "product_url", "category"],
        )
        writer.writerow(
            {
                "product_name": "Second Product",
                "product_id": "second_product",
                "productNameId": "Second_Product",
                "product_url": "https://shop.example.com/second",
                "category": "Shorts",
            }
        )

    source = FakeSourceClient(
        {
            "define_jacket_nulu": [make_page(0, [sample_review("1")], has_more=False)],
            "second_product": [],
        },
        raise_for_product={
            "second_product": RetryableSourceError("server", error_type="server_error", status_code=500)
        },
    )
    collector = build_collector(config, source)
    result = collector.collect(mode="incremental", dry_run=False)

    assert result["metrics"]["products_succeeded"] == 1
    assert result["metrics"]["products_failed"] == 1
    assert ReviewRepository(config.state_db_path).get_review("define_jacket_nulu", "1") is not None


def test_raw_archive_and_reconciliation_report(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    source = FakeSourceClient(
        {"define_jacket_nulu": [make_page(0, [sample_review("1")], has_more=False, total_results=1)]}
    )
    collector = build_collector(config, source)
    result = collector.collect(mode="incremental", dry_run=False)

    report_path = config.processed_dir / "reconciliation_report.csv"
    rows = list(csv.DictReader(report_path.open("r", encoding="utf-8-sig", newline="")))
    assert any(row["run_id"] == result["run_id"] for row in rows)

    run_dirs = list(config.raw_runs_dir.rglob("manifest.json"))
    assert run_dirs
    manifest = json.loads(run_dirs[0].read_text(encoding="utf-8"))
    assert manifest["run_id"] == result["run_id"]


def test_retry_policy_respects_retry_after_and_bounded_5xx(monkeypatch):
    sleeps = []
    policy = RetryPolicy(
        max_attempts=3,
        sleep_fn=lambda seconds: sleeps.append(seconds),
        random_fn=lambda: 0.0,
    )

    class Response:
        def __init__(self, status_code, headers=None):
            self.status_code = status_code
            self.headers = headers or {}

    calls = {"count": 0}

    def request_fn(_attempt):
        calls["count"] += 1
        if calls["count"] == 1:
            return Response(429, {"Retry-After": "2"})
        if calls["count"] == 2:
            return Response(503)
        return Response(200)

    response = policy.execute(request_fn)
    assert response.status_code == 200
    assert sleeps[0] == 2
    assert len(sleeps) == 2


def test_timeout_retry_and_schema_mismatch_and_redaction(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    source = FakeSourceClient(
        {"define_jacket_nulu": []},
        raise_for_product={
            "define_jacket_nulu": NonRetryableSourceError(
                "authorization=secret cookie=abc",
                error_type="schema_mismatch",
            )
        },
    )
    collector = build_collector(config, source)
    result = collector.collect(mode="incremental", dry_run=False)
    assert result["metrics"]["schema_error_count"] == 1
    assert "<redacted>" in redact_sensitive_text("authorization=secret cookie=abc")


def test_dry_run_does_not_mutate_database(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    source = FakeSourceClient(
        {"define_jacket_nulu": [make_page(0, [sample_review("1")], has_more=False)]}
    )
    collector = build_collector(config, source)
    result = collector.collect(mode="incremental", dry_run=True)

    assert result["metrics"]["new_reviews"] == 1
    assert ReviewRepository(config.state_db_path).count_reviews() == 0

