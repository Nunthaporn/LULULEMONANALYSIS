from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from pipeline.config import get_config
from pipeline.pipeline_common import (
    ALL_REVIEWS_CSV,
    ALL_REVIEWS_JSON,
    DEFAULT_DELAY_SECONDS,
    DEFAULT_LOCALE,
    DEFAULT_RECENT_SORT,
    DEFAULT_TIMEOUT_SECONDS,
    LOW_STAR_RATINGS,
    PRODUCTS_CSV,
    RAW_JSON_DIR,
    REVIEW_FIELDNAMES,
    SCRAPE_FAILURES_CSV,
    build_session,
    clean_text,
    ensure_pipeline_dirs,
    fetch_all_reviews_for_product,
    flatten_review,
    log,
    raw_json_path_for_product,
    read_json,
    read_products,
    safe_int,
    write_csv_rows,
    write_json,
)
from pipeline.storage.review_repository import ReviewRepository


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape lululemon reviews for multiple products.")
    parser.add_argument("--products", default=str(PRODUCTS_CSV))
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--locale", default=DEFAULT_LOCALE)
    parser.add_argument("--sort", default=DEFAULT_RECENT_SORT)
    return parser.parse_args()


def load_existing_reviews() -> list[dict[str, Any]]:
    payload = read_json(ALL_REVIEWS_JSON, [])
    if not isinstance(payload, list):
        raise ValueError(f"{ALL_REVIEWS_JSON} must contain a JSON array")
    return [row for row in payload if isinstance(row, dict)]


def existing_review_ids_by_product(
    rows: list[dict[str, Any]],
) -> dict[str, set[str]]:
    review_ids: dict[str, set[str]] = {}
    for row in rows:
        product_id = clean_text(row.get("product_id"))
        review_id = clean_text(row.get("review_id"))
        if product_id and review_id:
            review_ids.setdefault(product_id, set()).add(review_id)
    return review_ids


def merge_review_rows(
    existing_rows: list[dict[str, Any]],
    new_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for row in [*existing_rows, *new_rows]:
        key = (
            clean_text(row.get("product_id")),
            clean_text(row.get("review_id")),
        )
        if all(key):
            merged[key] = row
    return list(merged.values())


def scrape_products(
    *,
    products: list[dict[str, str]],
    delay: float,
    timeout: int,
    locale: str,
    sort: str,
    ratings: list[int],
    known_review_ids: dict[str, set[str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    session = build_session()
    flat_rows: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for product in products:
        log(f"Scraping {product['product_name']} ({product['product_id']})")
        product_known_ids = known_review_ids.get(product["product_id"], set())
        if product_known_ids:
            log(
                f"{product['product_id']}: loaded {len(product_known_ids)} existing "
                "review IDs; collecting newest reviews until the first known ID."
            )
        try:
            reviews, total_results = fetch_all_reviews_for_product(
                session,
                product=product,
                delay=delay,
                timeout=timeout,
                locale=locale,
                sort=sort,
                ratings=ratings,
                stop_review_ids=product_known_ids,
            )
            raw_payload = {
                **product,
                "total_results": total_results,
                "review_count_collected": len(reviews),
                "reviews": reviews,
            }
            write_json(raw_json_path_for_product(product["product_id"]), raw_payload)
            flat_rows.extend(flatten_review(product, review) for review in reviews)
            log(
                f"Collected {len(reviews)} reviews for {product['product_id']} "
                f"(API total {total_results})."
            )
        except Exception as exc:  # noqa: BLE001
            log(f"Failed {product['product_id']}: {exc}")
            failures.append(
                {
                    **product,
                    "error": str(exc),
                }
            )
            continue

    return flat_rows, failures


def main() -> int:
    args = parse_args()
    ensure_pipeline_dirs()
    RAW_JSON_DIR.mkdir(parents=True, exist_ok=True)

    products = read_products(Path(args.products))
    if not products:
        raise SystemExit("No products found in products.csv")

    existing_rows = load_existing_reviews()
    known_review_ids = existing_review_ids_by_product(existing_rows)
    existing_dates = [
        clean_text(row.get("submission_time"))
        for row in existing_rows
        if clean_text(row.get("submission_time"))
    ]
    if existing_dates:
        log(
            f"Existing review history: {len(existing_rows)} rows; "
            f"latest submission_time={max(existing_dates)}"
        )
    else:
        log("No existing review history found; a full 1-3 star collection will run.")

    new_rows, failures = scrape_products(
        products=products,
        delay=max(args.delay, 0.0),
        timeout=max(args.timeout, 1),
        locale=args.locale,
        sort=args.sort,
        ratings=sorted(LOW_STAR_RATINGS),
        known_review_ids=known_review_ids,
    )

    flat_rows = merge_review_rows(existing_rows, new_rows)
    flat_rows.sort(
        key=lambda row: (
            row.get("product_id", ""),
            safe_int(row.get("rating")),
            row.get("submission_time", ""),
            row.get("review_id", ""),
        )
    )

    write_csv_rows(ALL_REVIEWS_CSV, flat_rows, REVIEW_FIELDNAMES)
    write_json(ALL_REVIEWS_JSON, flat_rows)

    state_stats = ReviewRepository(get_config().state_db_path).bulk_upsert_reviews(flat_rows)

    failure_fields = [
        "product_name",
        "product_id",
        "productNameId",
        "product_url",
        "category",
        "error",
    ]
    write_csv_rows(SCRAPE_FAILURES_CSV, failures, failure_fields)

    if failures:
        log(f"Logged {len(failures)} product failures to {SCRAPE_FAILURES_CSV}")

    log(
        f"Merged {len(new_rows)} new reviews with {len(existing_rows)} existing rows; "
        f"canonical total={len(flat_rows)}."
    )
    log(
        "State database sync: "
        f"inserted={state_stats.inserted}, updated={state_stats.updated}, "
        f"unchanged={state_stats.unchanged}, invalid={state_stats.invalid}."
    )
    log(f"Saved combined review CSV to {ALL_REVIEWS_CSV}")
    log(f"Saved combined review JSON to {ALL_REVIEWS_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
