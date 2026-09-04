from __future__ import annotations

import json
import shutil
from pathlib import Path

from pipeline.config import get_config
from pipeline.pipeline_common import (
    ensure_pipeline_dirs,
    read_csv_rows,
    read_products,
    safe_float,
    safe_int,
)
from pipeline.storage.atomic_exporter import atomic_write_json
from pipeline.storage.review_repository import ReviewRepository


def coerce_review_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for row in rows:
        output.append(
            {
                **row,
                "rating": safe_int(row.get("rating")),
                "likes": safe_int(row.get("likes")),
                "photo_count": safe_int(row.get("photo_count")),
                "total_comments": safe_int(row.get("total_comments")),
                "is_staff": str(row.get("is_staff", "")).lower() == "true",
                "is_verified_buyer": str(row.get("is_verified_buyer", "")).lower() == "true",
                "similarity_score": safe_float(row.get("similarity_score")),
                "confidence_score": safe_float(row.get("confidence_score")),
                "operation_related": str(row.get("operation_related", "")).lower() == "true",
            }
        )
    return output


def coerce_image_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for row in rows:
        output.append(
            {
                **row,
                "rating": safe_int(row.get("rating")),
                "photo_number": safe_int(row.get("photo_number")),
                "helpful_votes": safe_int(row.get("helpful_votes")),
                "verified_buyer": str(row.get("verified_buyer", "")).lower() == "true",
            }
        )
    return output


def coerce_category_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for row in rows:
        output.append(
            {
                **row,
                "total_reviews": safe_int(row.get("total_reviews")),
                "one_star": safe_int(row.get("one_star")),
                "two_star": safe_int(row.get("two_star")),
                "three_star": safe_int(row.get("three_star")),
                "share_percentage": safe_float(row.get("share_percentage")),
            }
        )
    return output


def coerce_product_summary_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    numeric_keys = {
        "total_reviews",
        "low_star_reviews",
        "one_star_reviews",
        "two_star_reviews",
        "three_star_reviews",
        "reviews_with_images",
        "total_images",
    }
    float_keys = {"average_rating", "top_complaint_share"}
    output: list[dict[str, object]] = []
    for row in rows:
        record: dict[str, object] = dict(row)
        for key in numeric_keys:
            record[key] = safe_int(row.get(key))
        for key in float_keys:
            record[key] = safe_float(row.get(key))
        output.append(record)
    return output


def validate_bundle(bundle: dict[str, object]) -> None:
    required = {"products", "reviews", "images", "category", "productSummary"}
    missing = required.difference(bundle)
    if missing:
        raise ValueError(f"Dashboard export bundle missing keys: {sorted(missing)}")
    for key in required:
        if not isinstance(bundle[key], list):
            raise ValueError(f"Dashboard export bundle key {key} must be a list")


def build_bundle() -> dict[str, object]:
    config = get_config()
    products = read_products(config.data_dir / "input" / "products.csv")
    reviews = coerce_review_rows(read_csv_rows(config.processed_dir / "low_star_reviews.csv"))
    images = coerce_image_rows(read_csv_rows(config.processed_dir / "review_images_mapping.csv"))
    categories = coerce_category_rows(read_csv_rows(config.processed_dir / "category_summary.csv"))
    product_summary = coerce_product_summary_rows(read_csv_rows(config.processed_dir / "product_summary.csv"))
    bundle = {
        "products": products,
        "reviews": reviews,
        "images": images,
        "category": categories,
        "productSummary": product_summary,
    }
    validate_bundle(bundle)
    return bundle


def write_bundle_to_directory(bundle: dict[str, object], target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    file_map = {
        "products": "products.json",
        "reviews": "reviews.json",
        "images": "images.json",
        "category": "category.json",
        "productSummary": "productSummary.json",
    }
    for key, file_name in file_map.items():
        payload = bundle[key]
        json.loads(json.dumps(payload, ensure_ascii=False, allow_nan=False))
        atomic_write_json(target_dir / file_name, payload)


def run() -> dict[str, str]:
    ensure_pipeline_dirs()
    config = get_config()
    bundle = build_bundle()
    validate_bundle(bundle)
    temp_dir = config.processed_dir / "dashboard_data_tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    write_bundle_to_directory(bundle, temp_dir)

    expected_files = {
        "products.json",
        "reviews.json",
        "images.json",
        "category.json",
        "productSummary.json",
    }
    if expected_files.difference({path.name for path in temp_dir.iterdir()}):
        raise ValueError("Temporary dashboard export directory is incomplete.")

    write_bundle_to_directory(bundle, config.processed_dir / "dashboard_data")
    write_bundle_to_directory(bundle, config.public_data_dir / "dashboard_data")

    health = ReviewRepository(config.state_db_path).get_health_snapshot()
    atomic_write_json(config.processed_dir / "pipeline_health.json", health)
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except OSError:
        pass
    return {"dashboard_export": "SUCCESS"}


def main() -> int:
    run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
