from __future__ import annotations

import argparse
import hashlib
import requests
from pathlib import Path

from pipeline.config import get_config
from pipeline.ingestion.retry_policy import build_retry_policy, redact_sensitive_text
from pipeline.pipeline_common import (
    DEFAULT_TIMEOUT_SECONDS,
    IMAGE_MAPPING_FIELDNAMES,
    clean_text,
    ensure_pipeline_dirs,
    image_folder_for,
    infer_file_extension,
    log,
    sanitize_filename,
    write_csv_rows,
)
from pipeline.semantic_defect_matcher import get_taxonomy_hash
from pipeline.storage.atomic_exporter import atomic_write_bytes
from pipeline.storage.review_repository import ReviewRepository, utc_now_iso


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download and map low-star review images.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    return parser.parse_args()


def download_image(*, session: requests.Session, retry_policy, image_url: str, timeout: int) -> bytes:
    response = retry_policy.execute(
        lambda _attempt: session.get(image_url, timeout=max(timeout, 1))
    )
    return response.content


def run(timeout: int = DEFAULT_TIMEOUT_SECONDS) -> dict[str, int]:
    ensure_pipeline_dirs()
    config = get_config()
    repository = ReviewRepository(config.state_db_path)
    queued_assets, skipped = repository.get_reviews_needing_image_processing(
        max_rating=config.low_star_max_rating
    )
    session = requests.Session()
    retry_policy = build_retry_policy()
    downloaded = 0
    failed = 0

    for asset in queued_assets:
        review = asset["review"]
        product_id = clean_text(review["product_id"])
        review_id = clean_text(review["review_id"])
        photo_id = clean_text(asset["photo_id"])
        rating = int(review["rating"])
        target_dir = image_folder_for(product_id, rating)
        target_dir.mkdir(parents=True, exist_ok=True)
        extension = infer_file_extension(asset["source_url"])
        file_name = f"{sanitize_filename(review_id)}_{sanitize_filename(photo_id)}{extension}"
        destination = target_dir / file_name
        repository.upsert_review_asset(
            {
                "product_id": product_id,
                "review_id": review_id,
                "photo_id": photo_id,
                "source_url": asset["source_url"],
                "storage_path": str(destination.resolve()),
                "download_status": "pending",
                "attempt_count": (repository.get_review_asset(product_id=product_id, review_id=review_id, photo_id=photo_id)["attempt_count"] + 1) if repository.get_review_asset(product_id=product_id, review_id=review_id, photo_id=photo_id) else 1,
                "first_seen_at": utc_now_iso(),
                "last_attempt_at": utc_now_iso(),
                "downloaded_at": None,
                "error_message": "",
            }
        )
        try:
            if destination.exists():
                payload = destination.read_bytes()
            else:
                payload = download_image(
                    session=session,
                    retry_policy=retry_policy,
                    image_url=asset["source_url"],
                    timeout=timeout,
                )
                atomic_write_bytes(destination, payload)
            repository.upsert_review_asset(
                {
                    "product_id": product_id,
                    "review_id": review_id,
                    "photo_id": photo_id,
                    "source_url": asset["source_url"],
                    "storage_path": str(destination.resolve()),
                    "content_hash": hashlib.sha256(payload).hexdigest(),
                    "download_status": "downloaded",
                    "attempt_count": repository.get_review_asset(
                        product_id=product_id,
                        review_id=review_id,
                        photo_id=photo_id,
                    )["attempt_count"],
                    "first_seen_at": utc_now_iso(),
                    "last_attempt_at": utc_now_iso(),
                    "downloaded_at": utc_now_iso(),
                    "error_message": "",
                }
            )
            downloaded += 1
        except Exception as exc:  # noqa: BLE001
            repository.upsert_review_asset(
                {
                    "product_id": product_id,
                    "review_id": review_id,
                    "photo_id": photo_id,
                    "source_url": asset["source_url"],
                    "storage_path": str(destination.resolve()),
                    "download_status": "failed",
                    "attempt_count": repository.get_review_asset(
                        product_id=product_id,
                        review_id=review_id,
                        photo_id=photo_id,
                    )["attempt_count"],
                    "first_seen_at": utc_now_iso(),
                    "last_attempt_at": utc_now_iso(),
                    "downloaded_at": None,
                    "error_message": redact_sensitive_text(str(exc)),
                }
            )
            log(f"Image download failed for {review_id} {photo_id}: {redact_sensitive_text(str(exc))}")
            failed += 1

    rows = repository.build_image_mapping_rows(
        max_rating=config.low_star_max_rating,
        classifier_version=config.classifier_version,
        embedding_model_name=config.ml_model_name,
        embedding_model_version=config.embedding_model_version,
        semantic_threshold=config.semantic_threshold,
        taxonomy_hash=get_taxonomy_hash(),
    )
    write_csv_rows(config.processed_dir / "review_images_mapping.csv", rows, IMAGE_MAPPING_FIELDNAMES)
    return {
        "images_queued": len(queued_assets),
        "images_downloaded": downloaded,
        "images_skipped": skipped,
        "images_failed": failed,
    }


def main() -> int:
    args = parse_args()
    run(timeout=args.timeout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
