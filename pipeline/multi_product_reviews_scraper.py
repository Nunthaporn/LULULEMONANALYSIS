from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from pipeline.pipeline_common import (
    ALL_REVIEWS_CSV,
    ALL_REVIEWS_JSON,
    DEFAULT_DELAY_SECONDS,
    DEFAULT_LOCALE,
    DEFAULT_SORT,
    DEFAULT_TIMEOUT_SECONDS,
    PRODUCTS_CSV,
    RAW_JSON_DIR,
    REVIEW_FIELDNAMES,
    SCRAPE_FAILURES_CSV,
    build_session,
    ensure_pipeline_dirs,
    fetch_all_reviews_for_product,
    flatten_review,
    log,
    raw_json_path_for_product,
    read_products,
    safe_int,
    write_csv_rows,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape lululemon reviews for multiple products.")
    parser.add_argument("--products", default=str(PRODUCTS_CSV))
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--locale", default=DEFAULT_LOCALE)
    parser.add_argument("--sort", default=DEFAULT_SORT)
    return parser.parse_args()


def scrape_products(
    *,
    products: list[dict[str, str]],
    delay: float,
    timeout: int,
    locale: str,
    sort: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    session = build_session()
    flat_rows: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for product in products:
        log(f"Scraping {product['product_name']} ({product['product_id']})")
        try:
            reviews, total_results = fetch_all_reviews_for_product(
                session,
                product=product,
                delay=delay,
                timeout=timeout,
                locale=locale,
                sort=sort,
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

    flat_rows, failures = scrape_products(
        products=products,
        delay=max(args.delay, 0.0),
        timeout=max(args.timeout, 1),
        locale=args.locale,
        sort=args.sort,
    )

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

    log(f"Saved combined review CSV to {ALL_REVIEWS_CSV}")
    log(f"Saved combined review JSON to {ALL_REVIEWS_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
