from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from pipeline import complaint_classifier, dashboard_exporter, low_star_processor, multi_product_image_mapper, semantic_defect_matcher, summary_generator
from pipeline.config import get_config, reset_config_cache
from pipeline.storage.review_repository import ReviewRepository


def sample_product():
    return {
        "product_name": "Define Jacket Nulu",
        "product_id": "define_jacket_nulu",
        "productNameId": "Define_Jacket_Nulu",
        "product_url": "https://shop.example.com/product",
        "category": "Jackets",
    }


def sample_review(review_id: str, *, rating: int = 1, review_text: str = "Pilling after one wash", photo: bool = False):
    return {
        "product_name": "Define Jacket Nulu",
        "product_id": "define_jacket_nulu",
        "productNameId": "Define_Jacket_Nulu",
        "product_url": "https://shop.example.com/product",
        "category": "Jackets",
        "review_id": review_id,
        "rating": rating,
        "title": "Quality issue",
        "review_text": review_text,
        "submission_time": "2026-05-23T03:07:43.000+00:00",
        "author": "guest",
        "is_staff": False,
        "is_verified_buyer": True,
        "badge": "",
        "likes": 2,
        "incentivized_review_label": "",
        "fit_feedback": "True to size",
        "height": "",
        "weight": "",
        "size_purchased": "8",
        "usual_size": "8",
        "total_comments": 0,
        "comments_json": "[]",
        "lulu_response_author": "",
        "lulu_response_text": "",
        "lulu_response_time": "",
        "photo_count": 1 if photo else 0,
        "photo_ids": "photo_a" if photo else "",
        "photo_urls": "https://example.com/photo-a.jpg" if photo else "",
        "photo_thumbnails": "https://example.com/photo-a-thumb.jpg" if photo else "",
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


def configure_env(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    input_dir = data_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    with (input_dir / "products.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["product_name", "product_id", "productNameId", "product_url", "category"],
        )
        writer.writeheader()
        writer.writerow(sample_product())
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(data_dir))
    monkeypatch.setenv("PIPELINE_STATE_DB", str(data_dir / "state" / "pipeline_state.db"))
    monkeypatch.setenv("PIPELINE_OUTPUT_DIR", str(tmp_path / "public" / "data" / "dashboard_data"))
    monkeypatch.setenv("CLASSIFIER_VERSION", "keyword_v1")
    monkeypatch.setenv("EMBEDDING_MODEL_VERSION", "embed_v1")
    monkeypatch.setenv("TAXONOMY_VERSION", "taxonomy_v1")
    reset_config_cache()
    return get_config()


def seed_review(config, review):
    repository = ReviewRepository(config.state_db_path)
    repository.bulk_upsert_reviews([review], ingestion_run_id="seed")
    repository.list_active_reviews()
    return repository


def fake_taxonomy_hash():
    return "taxonomy_hash_v1"


def fake_semantic_matches(rows, *, threshold, model_name):
    return [
        {
            "matched_defect_code": "",
            "matched_defect_desc": "",
            "matched_defect_group_code": "SD",
            "matched_defect_group": "Construction",
            "similarity_score": 0.31,
            "semantic_match_method": "sentence_transformer",
            "operation_related": True,
            "confidence_score": 0.31,
        }
        for _ in rows
    ]


def test_classifier_cache_reuse_and_invalidation(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    seed_review(config, sample_review("1"))
    monkeypatch.setattr(complaint_classifier, "get_taxonomy_hash", fake_taxonomy_hash)

    first = complaint_classifier.run()
    second = complaint_classifier.run()

    assert first["complaint_classifications_performed"] == 1
    assert second["complaint_classifications_performed"] == 0
    assert second["cached_analysis_reused"] >= 1

    monkeypatch.setenv("CLASSIFIER_VERSION", "keyword_v2")
    reset_config_cache()
    monkeypatch.setattr(complaint_classifier, "get_taxonomy_hash", fake_taxonomy_hash)
    third = complaint_classifier.run()
    assert third["complaint_classifications_performed"] == 1


def test_semantic_cache_reuse_and_model_taxonomy_invalidation(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    seed_review(config, sample_review("1"))
    monkeypatch.setattr(complaint_classifier, "get_taxonomy_hash", fake_taxonomy_hash)
    complaint_classifier.run()
    monkeypatch.setattr(semantic_defect_matcher, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "match_reviews_to_defects", fake_semantic_matches)

    first = semantic_defect_matcher.run()
    second = semantic_defect_matcher.run()
    assert first["semantic_matches_performed"] == 1
    assert second["semantic_matches_performed"] == 0
    assert second["cached_analysis_reused"] >= 1

    monkeypatch.setenv("EMBEDDING_MODEL_VERSION", "embed_v2")
    reset_config_cache()
    monkeypatch.setattr(semantic_defect_matcher, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "match_reviews_to_defects", fake_semantic_matches)
    third = semantic_defect_matcher.run()
    assert third["semantic_matches_performed"] == 1

    monkeypatch.setattr(semantic_defect_matcher, "get_taxonomy_hash", lambda: "taxonomy_hash_v2")
    fourth = semantic_defect_matcher.run()
    assert fourth["semantic_matches_performed"] == 1


def test_rating_change_behavior_and_low_star_consistency(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    repository = seed_review(config, sample_review("1", rating=1))
    monkeypatch.setattr(complaint_classifier, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "match_reviews_to_defects", fake_semantic_matches)
    complaint_classifier.run()
    semantic_defect_matcher.run()
    low_star_processor.run()

    low_star_csv = config.processed_dir / "low_star_reviews.csv"
    rows = list(csv.DictReader(low_star_csv.open("r", encoding="utf-8-sig", newline="")))
    assert len(rows) == 1

    repository.bulk_upsert_reviews([sample_review("1", rating=5)], ingestion_run_id="update")
    low_star_processor.run()
    rows_after = list(csv.DictReader(low_star_csv.open("r", encoding="utf-8-sig", newline="")))
    assert rows_after == []


def test_image_assets_skip_existing_downloads(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    repository = seed_review(config, sample_review("1", photo=True))
    image_dir = config.data_dir / "images" / "define_jacket_nulu" / "1_star"
    image_dir.mkdir(parents=True, exist_ok=True)
    image_path = image_dir / "1_photo_a.jpg"
    image_path.write_bytes(b"fake-image")
    repository.upsert_review_asset(
        {
            "product_id": "define_jacket_nulu",
            "review_id": "1",
            "photo_id": "photo_a",
            "source_url": "https://example.com/photo-a.jpg",
            "storage_path": str(image_path.resolve()),
            "content_hash": "abc",
            "download_status": "downloaded",
            "attempt_count": 1,
            "first_seen_at": "2026-01-01T00:00:00+00:00",
            "last_attempt_at": "2026-01-01T00:00:00+00:00",
            "downloaded_at": "2026-01-01T00:00:00+00:00",
            "error_message": "",
        }
    )
    monkeypatch.setattr(multi_product_image_mapper, "get_taxonomy_hash", fake_taxonomy_hash)
    result = multi_product_image_mapper.run()
    assert result["images_queued"] == 0
    assert result["images_skipped"] == 1


def test_summary_dashboard_health_and_atomic_rollback(tmp_path, monkeypatch):
    config = configure_env(monkeypatch, tmp_path)
    seed_review(config, sample_review("1", rating=1))
    seed_review(config, sample_review("2", rating=5, review_text="Love it"))
    monkeypatch.setattr(complaint_classifier, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "get_taxonomy_hash", fake_taxonomy_hash)
    monkeypatch.setattr(semantic_defect_matcher, "match_reviews_to_defects", fake_semantic_matches)
    complaint_classifier.run()
    semantic_defect_matcher.run()
    low_star_processor.run()
    summary_generator.main()
    dashboard_exporter.run()

    product_summary = json.loads(
        (config.public_data_dir / "dashboard_data" / "productSummary.json").read_text(encoding="utf-8")
    )
    assert product_summary[0]["total_reviews"] == 2
    assert product_summary[0]["low_star_reviews"] == 1

    pipeline_health = json.loads(
        (config.processed_dir / "pipeline_health.json").read_text(encoding="utf-8")
    )
    assert "pending_analysis_count" in pipeline_health
    assert "total_reviews" in pipeline_health

    sentinel = config.public_data_dir / "dashboard_data" / "reviews.json"
    original = sentinel.read_text(encoding="utf-8")

    monkeypatch.setattr(
        dashboard_exporter,
        "build_bundle",
        lambda: {"products": []},
    )
    with pytest.raises(ValueError):
        dashboard_exporter.run()
    assert sentinel.read_text(encoding="utf-8") == original
