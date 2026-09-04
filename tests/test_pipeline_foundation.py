from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path

from pipeline.bootstrap_existing_data import main as bootstrap_main
from pipeline.config import reset_config_cache
from pipeline.ingestion.checkpoint_store import CheckpointStore
from pipeline.ingestion.run_logger import RunLogger
from pipeline.storage.atomic_exporter import atomic_write_json, atomic_write_text
from pipeline.storage.review_repository import (
    ReviewRepository,
    build_review_content_hash,
    get_db_connection,
)


def sample_review(**overrides):
    review = {
        "product_name": "Define Jacket Nulu",
        "product_id": "define_jacket_nulu",
        "productNameId": "Define_Jacket_Nulu",
        "product_url": "https://shop.lululemon.com/p/example",
        "category": "Jackets",
        "review_id": "250856814",
        "rating": "1",
        "title": "So disappointed with fulfillment lately!",
        "review_text": "Sadly my jacket came with greased spots.",
        "submission_time": "2026-05-23T03:07:43.000+00:00",
        "author": "lbrown1025",
        "is_staff": "False",
        "is_verified_buyer": "False",
        "badge": "",
        "likes": "0",
        "incentivized_review_label": "",
        "fit_feedback": "True to size",
        "height": "",
        "weight": "",
        "size_purchased": "10",
        "usual_size": "10",
        "total_comments": "0",
        "comments_json": "[]",
        "lulu_response_author": "Guest Education Centre (GEC)",
        "lulu_response_text": "We reached out by email.",
        "lulu_response_time": "2026-05-24T12:28:35.000+00:00",
        "photo_count": "2",
        "photo_ids": "17322503 ; 17322504",
        "photo_urls": "https://example.com/1 ; https://example.com/2",
        "photo_thumbnails": "https://example.com/t1 ; https://example.com/t2",
        "photo_captions": "",
        "complaint_theme": "Product Cleanliness",
        "business_insight": "Fulfillment quality-control issue.",
        "matched_defect_code": "",
        "matched_defect_desc": "",
        "matched_defect_group_code": "",
        "matched_defect_group": "Unclassified",
        "similarity_score": "0.0",
        "semantic_match_method": "unclassified",
        "operation_related": "False",
        "confidence_score": "0.0",
        "scraped_at": "2026-05-28T07:52:53.589785+00:00",
    }
    review.update(overrides)
    return review


def configure_env(monkeypatch, tmp_path):
    state_db = tmp_path / "state" / "pipeline_state.db"
    monkeypatch.setenv("PIPELINE_STATE_DB", str(state_db))
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PIPELINE_OUTPUT_DIR", str(tmp_path / "output"))
    reset_config_cache()
    return state_db


def test_review_upsert_and_duplicate_handling(tmp_path, monkeypatch):
    db_path = configure_env(monkeypatch, tmp_path)
    repository = ReviewRepository(db_path)

    stats = repository.bulk_upsert_reviews(
        [sample_review(), sample_review(), sample_review(review_id="250856815")],
        ingestion_run_id="run-1",
        seen_at="2026-07-10T00:00:00+00:00",
    )

    assert stats.inserted == 2
    assert stats.duplicates == 1
    assert stats.updated == 0
    assert stats.unchanged == 0
    assert repository.count_reviews() == 2


def test_changed_review_detection(tmp_path, monkeypatch):
    db_path = configure_env(monkeypatch, tmp_path)
    repository = ReviewRepository(db_path)
    repository.bulk_upsert_reviews([sample_review()], ingestion_run_id="run-1")

    stats = repository.bulk_upsert_reviews(
        [sample_review(review_text="Sadly my jacket came with several grease spots.")],
        ingestion_run_id="run-2",
    )

    stored = repository.get_review("define_jacket_nulu", "250856814")
    assert stats.updated == 1
    assert stored["review_text"] == "Sadly my jacket came with several grease spots."


def test_checkpoint_creation_and_update(tmp_path, monkeypatch):
    db_path = configure_env(monkeypatch, tmp_path)
    store = CheckpointStore(db_path)

    assert store.get_checkpoint("define_jacket_nulu") is None

    store.record_failure(product_id="define_jacket_nulu", source_product_key="Define_Jacket_Nulu")
    failed = store.get_checkpoint("define_jacket_nulu")
    assert failed is not None
    assert failed.consecutive_failures == 1

    store.record_success(
        product_id="define_jacket_nulu",
        source_product_key="Define_Jacket_Nulu",
        newest_seen_at="2026-05-26T05:52:44.000+00:00",
        total_results_seen=5391,
        run_id="run-1",
    )
    updated = store.get_checkpoint("define_jacket_nulu")
    assert updated is not None
    assert updated.consecutive_failures == 0
    assert updated.total_results_seen == 5391
    assert updated.last_run_id == "run-1"


def test_ingestion_run_lifecycle_and_error_logging(tmp_path, monkeypatch):
    db_path = configure_env(monkeypatch, tmp_path)
    logger = RunLogger(db_path)

    run_id = logger.start_run()
    error_id = logger.log_error(
        run_id=run_id,
        product_id="define_jacket_nulu",
        stage="collector",
        error_type="http_429",
        status_code=429,
        retry_count=2,
        page_offset_or_cursor="32",
        message="rate limited",
    )
    logger.finish_run(
        run_id,
        status="completed",
        products_attempted=1,
        products_succeeded=1,
        pages_requested=12,
        reviews_seen=100,
        new_reviews=3,
        duplicate_reviews=97,
        http_429_count=1,
    )

    run_row = logger.get_run(run_id)
    assert run_row is not None
    assert run_row["status"] == "completed"
    assert run_row["http_429_count"] == 1

    with get_db_connection(db_path) as connection:
        error_row = connection.execute(
            "SELECT * FROM ingestion_errors WHERE error_id = ?",
            (error_id,),
        ).fetchone()
    assert error_row is not None
    assert error_row["status_code"] == 429


def test_atomic_file_replacement(tmp_path):
    target = tmp_path / "dashboard" / "reviews.json"
    atomic_write_text(target, "first")
    atomic_write_json(target, [{"review_id": "1"}])
    assert json.loads(target.read_text(encoding="utf-8")) == [{"review_id": "1"}]


def test_bootstrap_idempotency(tmp_path, monkeypatch, capsys):
    db_path = configure_env(monkeypatch, tmp_path)
    csv_path = tmp_path / "all_reviews.csv"
    rows = [sample_review(), sample_review(review_id="250856815")]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    assert bootstrap_main(["--source", str(csv_path), "--db", str(db_path)]) == 0
    first_output = capsys.readouterr().out
    assert "Inserted: 2" in first_output

    assert bootstrap_main(["--source", str(csv_path), "--db", str(db_path)]) == 0
    second_output = capsys.readouterr().out
    assert "Inserted: 0" in second_output
    assert "Unchanged: 2" in second_output

    repository = ReviewRepository(db_path)
    assert repository.count_reviews() == 2
    backups = list(db_path.parent.glob("pipeline_state.*.bak.db"))
    assert backups


def test_content_hash_stability():
    baseline = sample_review()
    variant = sample_review(
        title="  So disappointed with fulfillment lately!  ",
        review_text="Sadly  my jacket came with greased spots.\n",
    )
    changed = sample_review(review_text="Completely different review text.")

    assert build_review_content_hash(baseline) == build_review_content_hash(variant)
    assert build_review_content_hash(baseline) != build_review_content_hash(changed)
