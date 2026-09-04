from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
OUTPUT_DIR = Path(
    r"c:\Users\hiruk\OneDrive\Desktop\lululemon\lululemon-review-scraper\output"
)
IMAGES_WORKBOOK = OUTPUT_DIR / "lululemon_define_jacket_1_2_3_star_review_images.xlsx"
LOW_REVIEWS_WORKBOOK = OUTPUT_DIR / "lululemon_define_jacket_low_reviews.xlsx"
DATA_DIR = ROOT_DIR / "src" / "data"


def normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    return df.astype(object).where(pd.notnull(df), None)


def parse_urls(value):
    if pd.isna(value):
        return []
    return [url.strip() for url in str(value).split(";") if url.strip()]


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    image_mapping = pd.read_excel(IMAGES_WORKBOOK, sheet_name="Image Mapping")
    image_mapping = image_mapping[image_mapping["image_exists"] == True].copy()
    image_mapping["review_date"] = image_mapping["review_date"].astype(str)
    image_mapping = normalize_frame(image_mapping)

    images = image_mapping[
        [
            "rating",
            "review_id",
            "review_date",
            "review_title",
            "review_text",
            "complaint_theme",
            "business_insight",
            "photo_number",
            "image_url",
            "size_purchased",
            "fit_feedback",
            "verified_buyer",
            "helpful_votes",
        ]
    ].to_dict(orient="records")

    (DATA_DIR / "images.json").write_text(
        json.dumps(images, ensure_ascii=False, indent=2, default=str, allow_nan=False),
        encoding="utf-8",
    )
    print(f"Exported {len(images)} image records")

    reviews_with_images = pd.read_excel(IMAGES_WORKBOOK, sheet_name="Reviews With Images")
    reviews_with_images["review_date"] = reviews_with_images["review_date"].astype(str)
    reviews_with_images["photo_urls"] = reviews_with_images["photo_urls"].apply(parse_urls)
    reviews_with_images.drop(columns=["downloaded_image_paths"], inplace=True)
    reviews_with_images = normalize_frame(reviews_with_images)

    (DATA_DIR / "reviewsWithImages.json").write_text(
        json.dumps(
            reviews_with_images.to_dict(orient="records"),
            ensure_ascii=False,
            indent=2,
            default=str,
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    print(f"Exported {len(reviews_with_images)} reviews with images")

    reviews = pd.read_excel(LOW_REVIEWS_WORKBOOK)
    reviews["review_date"] = reviews["review_date"].astype(str)
    reviews["scraped_at"] = reviews["scraped_at"].astype(str)
    reviews = normalize_frame(reviews)

    (DATA_DIR / "reviews.json").write_text(
        json.dumps(
            reviews.to_dict(orient="records"),
            ensure_ascii=False,
            indent=2,
            default=str,
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    print(f"Exported {len(reviews)} reviews")

    category_summary = pd.read_excel(
        IMAGES_WORKBOOK,
        sheet_name="Complaint Category Summary",
    )
    category_summary = normalize_frame(category_summary)

    (DATA_DIR / "categorySummary.json").write_text(
        json.dumps(
            category_summary.to_dict(orient="records"),
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    print(f"Exported {len(category_summary)} categories")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
