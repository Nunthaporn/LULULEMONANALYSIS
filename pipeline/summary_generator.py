from __future__ import annotations

from collections import Counter, defaultdict

from pipeline.config import get_config
from pipeline.pipeline_common import (
    CATEGORY_SUMMARY_FIELDNAMES,
    PRODUCT_SUMMARY_FIELDNAMES,
    clean_text,
    ensure_pipeline_dirs,
    read_csv_rows,
    safe_float,
    safe_int,
    theme_share,
    top_theme,
    write_csv_rows,
)


def build_product_summary(
    low_star_rows: list[dict[str, str]],
    all_review_rows: list[dict[str, str]],
    image_rows: list[dict[str, str]],
) -> list[dict[str, object]]:
    low_by_product: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    all_by_product: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    images_by_product: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)

    for row in low_star_rows:
        key = (
            row.get("product_name", ""),
            row.get("product_id", ""),
            row.get("productNameId", ""),
            row.get("category", ""),
        )
        low_by_product[key].append(row)

    for row in all_review_rows:
        key = (
            row.get("product_name", ""),
            row.get("product_id", ""),
            row.get("productNameId", ""),
            row.get("category", ""),
        )
        all_by_product[key].append(row)

    for row in image_rows:
        key = (
            row.get("product_name", ""),
            row.get("product_id", ""),
            row.get("productNameId", ""),
            row.get("category", ""),
        )
        images_by_product[key].append(row)

    product_keys = sorted(set(low_by_product) | set(all_by_product) | set(images_by_product))
    summary_rows: list[dict[str, object]] = []

    for key in product_keys:
        product_name, product_id, product_name_id, category = key
        all_rows = all_by_product.get(key, [])
        low_rows = low_by_product.get(key, [])
        img_rows = images_by_product.get(key, [])
        rating_counts = Counter(safe_int(row.get("rating")) for row in low_rows)
        image_review_ids = {clean_text(row.get("review_id")) for row in img_rows if clean_text(row.get("review_id"))}
        theme, theme_count = top_theme(low_rows)
        average_rating = (
            round(sum(safe_float(row.get("rating")) for row in all_rows) / len(all_rows), 2)
            if all_rows
            else 0
        )

        summary_rows.append(
            {
                "product_name": product_name,
                "product_id": product_id,
                "productNameId": product_name_id,
                "category": category,
                "total_reviews": len(all_rows),
                "low_star_reviews": len(low_rows),
                "one_star_reviews": rating_counts[1],
                "two_star_reviews": rating_counts[2],
                "three_star_reviews": rating_counts[3],
                "reviews_with_images": len(image_review_ids),
                "total_images": len(img_rows),
                "average_rating": average_rating,
                "top_complaint_theme": theme,
                "top_complaint_share": theme_share(theme_count, len(low_rows)),
            }
        )

    return summary_rows


def build_category_summary(low_star_rows: list[dict[str, str]]) -> list[dict[str, object]]:
    grouped: dict[tuple[str, str, str, str, str], list[dict[str, str]]] = defaultdict(list)

    for row in low_star_rows:
        key = (
            row.get("product_name", ""),
            row.get("product_id", ""),
            row.get("productNameId", ""),
            row.get("category", ""),
            row.get("complaint_theme", "") or "Other",
        )
        grouped[key].append(row)

    product_totals: Counter[tuple[str, str, str, str]] = Counter()
    for row in low_star_rows:
        product_totals[
            (
                row.get("product_name", ""),
                row.get("product_id", ""),
                row.get("productNameId", ""),
                row.get("category", ""),
            )
        ] += 1

    summary_rows: list[dict[str, object]] = []
    for key, rows in sorted(grouped.items()):
        product_name, product_id, product_name_id, category, theme = key
        rating_counts = Counter(safe_int(row.get("rating")) for row in rows)
        total_reviews = len(rows)
        total_product_reviews = product_totals[(product_name, product_id, product_name_id, category)]
        summary_rows.append(
            {
                "product_name": product_name,
                "product_id": product_id,
                "productNameId": product_name_id,
                "category": category,
                "complaint_theme": theme,
                "total_reviews": total_reviews,
                "one_star": rating_counts[1],
                "two_star": rating_counts[2],
                "three_star": rating_counts[3],
                "share_percentage": theme_share(total_reviews, total_product_reviews),
            }
        )

    summary_rows.sort(
        key=lambda row: (
            row["product_id"],
            -safe_int(row["total_reviews"]),
            row["complaint_theme"],
        )
    )
    return summary_rows


def main() -> int:
    ensure_pipeline_dirs()
    config = get_config()

    all_rows = read_csv_rows(config.processed_dir / "all_reviews.csv")
    low_star_rows = read_csv_rows(config.processed_dir / "low_star_reviews.csv")
    image_rows = read_csv_rows(config.processed_dir / "review_images_mapping.csv")

    product_summary = build_product_summary(low_star_rows, all_rows, image_rows)
    category_summary = build_category_summary(low_star_rows)

    write_csv_rows(config.processed_dir / "product_summary.csv", product_summary, PRODUCT_SUMMARY_FIELDNAMES)
    write_csv_rows(config.processed_dir / "category_summary.csv", category_summary, CATEGORY_SUMMARY_FIELDNAMES)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
