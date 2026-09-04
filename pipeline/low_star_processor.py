from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from pipeline.config import get_config
from pipeline.pipeline_common import (
    REVIEW_FIELDNAMES,
    ensure_pipeline_dirs,
    safe_int,
    write_csv_rows,
    write_json,
)
from pipeline.semantic_defect_matcher import get_taxonomy_hash
from pipeline.storage.review_repository import ReviewRepository


def build_product_rating_distribution(rows: list[dict[str, Any]], low_star_max_rating: int) -> list[dict[str, int | str]]:
    counts: dict[tuple[str, str, str], Counter[int]] = defaultdict(Counter)
    totals: dict[tuple[str, str, str], int] = defaultdict(int)

    for row in rows:
        key = (row.get("product_name", ""), row.get("product_id", ""), row.get("category", ""))
        rating = safe_int(row.get("rating"))
        counts[key][rating] += 1
        totals[key] += 1

    output: list[dict[str, int | str]] = []
    for (product_name, product_id, category), rating_counts in sorted(counts.items()):
        output.append(
            {
                "product_name": product_name,
                "product_id": product_id,
                "category": category,
                "total_reviews": totals[(product_name, product_id, category)],
                "one_star_reviews": rating_counts[1],
                "two_star_reviews": rating_counts[2],
                "three_star_reviews": rating_counts[3],
                "four_star_reviews": rating_counts[4],
                "five_star_reviews": rating_counts[5],
                "low_star_reviews": sum(
                    rating_counts[rating]
                    for rating in range(1, low_star_max_rating + 1)
                ),
            }
        )
    return output


def run() -> dict[str, int]:
    ensure_pipeline_dirs()
    config = get_config()
    repository = ReviewRepository(config.state_db_path)
    taxonomy_hash = get_taxonomy_hash()
    low_star_rows = repository.build_low_star_export_rows(
        max_rating=config.low_star_max_rating,
        classifier_version=config.classifier_version,
        embedding_model_name=config.ml_model_name,
        embedding_model_version=config.embedding_model_version,
        semantic_threshold=config.semantic_threshold,
        taxonomy_hash=taxonomy_hash,
    )
    all_rows = repository.list_active_reviews()
    write_csv_rows(config.processed_dir / "all_reviews.csv", all_rows, REVIEW_FIELDNAMES)
    write_json(config.processed_dir / "all_reviews.json", all_rows)

    write_csv_rows(config.processed_dir / "low_star_reviews.csv", low_star_rows, REVIEW_FIELDNAMES)

    rating_distribution = build_product_rating_distribution(all_rows, config.low_star_max_rating)
    write_csv_rows(
        config.processed_dir / "product_rating_distribution.csv",
        rating_distribution,
        [
            "product_name",
            "product_id",
            "category",
            "total_reviews",
            "one_star_reviews",
            "two_star_reviews",
            "three_star_reviews",
            "four_star_reviews",
            "five_star_reviews",
            "low_star_reviews",
        ],
    )
    return {
        "low_star_reviews": len(low_star_rows),
        "total_reviews": len(all_rows),
    }


def main() -> int:
    run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
