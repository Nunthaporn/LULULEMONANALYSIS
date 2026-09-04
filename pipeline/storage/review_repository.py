from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pipeline.config import get_config


REVIEW_IDENTITY_FIELDS = ("product_id", "review_id")
REVIEW_STORAGE_FIELDS = (
    "product_id",
    "review_id",
    "product_name",
    "product_name_id",
    "product_url",
    "category",
    "rating",
    "title",
    "review_text",
    "author",
    "source_created_at",
    "source_updated_at",
    "first_seen_at",
    "last_seen_at",
    "content_hash",
    "source_payload_hash",
    "is_active",
    "ingestion_run_id",
    "raw_payload_json",
    "badge",
    "is_staff",
    "is_verified_buyer",
    "likes",
    "incentivized_review_label",
    "fit_feedback",
    "height",
    "weight",
    "size_purchased",
    "usual_size",
    "total_comments",
    "comments_json",
    "lulu_response_author",
    "lulu_response_text",
    "lulu_response_time",
    "photo_count",
    "photo_ids",
    "photo_urls",
    "photo_thumbnails",
    "photo_captions",
    "complaint_theme",
    "business_insight",
    "matched_defect_code",
    "matched_defect_desc",
    "matched_defect_group_code",
    "matched_defect_group",
    "similarity_score",
    "semantic_match_method",
    "operation_related",
    "confidence_score",
    "scraped_at",
)

RUN_COUNTER_FIELDS = (
    "products_attempted",
    "products_succeeded",
    "products_failed",
    "pages_requested",
    "reviews_seen",
    "new_reviews",
    "updated_reviews",
    "duplicate_reviews",
    "http_403_count",
    "http_429_count",
    "server_error_count",
    "timeout_count",
    "schema_error_count",
    "complaint_classifications_performed",
    "semantic_matches_performed",
    "cached_analysis_reused",
    "images_queued",
    "images_downloaded",
    "images_skipped",
    "images_failed",
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def normalize_bool(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(bool(value))
    return int(normalize_text(value).lower() in {"1", "true", "yes", "y", "verified"})


def normalize_list_field(value: Any) -> list[str]:
    if isinstance(value, list):
        return [normalize_text(item) for item in value if normalize_text(item)]
    text = normalize_text(value)
    if not text:
        return []
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [normalize_text(item) for item in parsed if normalize_text(item)]
    return [part.strip() for part in text.split(";") if part.strip()]


def serialize_list_field(value: Any) -> str:
    return " ; ".join(normalize_list_field(value))


def normalize_payload(value: Any) -> str:
    if isinstance(value, str):
        return normalize_text(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def build_source_payload_hash(payload: Any) -> str:
    return hashlib.sha256(normalize_payload(payload).encode("utf-8")).hexdigest()


def build_review_content_hash(review: dict[str, Any]) -> str:
    normalized = {
        "rating": normalize_text(review.get("rating")),
        "title": normalize_text(review.get("title") or review.get("review_title")),
        "review_text": normalize_text(review.get("review_text")),
        "fit_feedback": normalize_text(review.get("fit_feedback")),
        "size_purchased": normalize_text(review.get("size_purchased")),
        "photo_ids": normalize_list_field(review.get("photo_ids")),
        "photo_urls": normalize_list_field(review.get("photo_urls")),
        "photo_thumbnails": normalize_list_field(review.get("photo_thumbnails")),
        "photo_captions": normalize_list_field(review.get("photo_captions")),
    }
    serialized = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def build_analysis_key(
    *,
    product_id: str,
    review_id: str,
    review_content_hash: str,
    classifier_version: str,
    embedding_model_name: str,
    embedding_model_version: str,
    semantic_threshold: float,
    taxonomy_hash: str,
) -> str:
    payload = {
        "product_id": product_id,
        "review_id": review_id,
        "review_content_hash": review_content_hash,
        "classifier_version": classifier_version,
        "embedding_model_name": embedding_model_name,
        "embedding_model_version": embedding_model_version,
        "semantic_threshold": semantic_threshold,
        "taxonomy_hash": taxonomy_hash,
    }
    normalized = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_db_connection(db_path: Path | None = None) -> sqlite3.Connection:
    config = get_config()
    target = Path(db_path or config.state_db_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def _ensure_columns(connection: sqlite3.Connection, table_name: str, expected: dict[str, str]) -> None:
    existing = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    for column_name, definition in expected.items():
        if column_name not in existing:
            connection.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
            )


def initialize_state_db(db_path: Path | None = None) -> Path:
    config = get_config()
    target = Path(db_path or config.state_db_path)
    with get_db_connection(target) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS ingestion_runs (
                run_id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                status TEXT NOT NULL,
                products_attempted INTEGER NOT NULL DEFAULT 0,
                products_succeeded INTEGER NOT NULL DEFAULT 0,
                products_failed INTEGER NOT NULL DEFAULT 0,
                pages_requested INTEGER NOT NULL DEFAULT 0,
                reviews_seen INTEGER NOT NULL DEFAULT 0,
                new_reviews INTEGER NOT NULL DEFAULT 0,
                updated_reviews INTEGER NOT NULL DEFAULT 0,
                duplicate_reviews INTEGER NOT NULL DEFAULT 0,
                http_403_count INTEGER NOT NULL DEFAULT 0,
                http_429_count INTEGER NOT NULL DEFAULT 0,
                server_error_count INTEGER NOT NULL DEFAULT 0,
                timeout_count INTEGER NOT NULL DEFAULT 0,
                schema_error_count INTEGER NOT NULL DEFAULT 0,
                complaint_classifications_performed INTEGER NOT NULL DEFAULT 0,
                semantic_matches_performed INTEGER NOT NULL DEFAULT 0,
                cached_analysis_reused INTEGER NOT NULL DEFAULT 0,
                images_queued INTEGER NOT NULL DEFAULT 0,
                images_downloaded INTEGER NOT NULL DEFAULT 0,
                images_skipped INTEGER NOT NULL DEFAULT 0,
                images_failed INTEGER NOT NULL DEFAULT 0,
                error_message TEXT
            );

            CREATE TABLE IF NOT EXISTS product_checkpoints (
                product_id TEXT PRIMARY KEY,
                source_product_key TEXT,
                last_success_at TEXT,
                newest_seen_at TEXT,
                total_results_seen INTEGER NOT NULL DEFAULT 0,
                consecutive_failures INTEGER NOT NULL DEFAULT 0,
                cooldown_until TEXT,
                last_run_id TEXT,
                schema_version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reviews (
                product_id TEXT NOT NULL,
                review_id TEXT NOT NULL,
                product_name TEXT,
                product_name_id TEXT,
                product_url TEXT,
                category TEXT,
                rating INTEGER NOT NULL DEFAULT 0,
                title TEXT,
                review_text TEXT,
                author TEXT,
                source_created_at TEXT,
                source_updated_at TEXT,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                source_payload_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                ingestion_run_id TEXT,
                raw_payload_json TEXT NOT NULL,
                badge TEXT,
                is_staff INTEGER NOT NULL DEFAULT 0,
                is_verified_buyer INTEGER NOT NULL DEFAULT 0,
                likes INTEGER NOT NULL DEFAULT 0,
                incentivized_review_label TEXT,
                fit_feedback TEXT,
                height TEXT,
                weight TEXT,
                size_purchased TEXT,
                usual_size TEXT,
                total_comments INTEGER NOT NULL DEFAULT 0,
                comments_json TEXT,
                lulu_response_author TEXT,
                lulu_response_text TEXT,
                lulu_response_time TEXT,
                photo_count INTEGER NOT NULL DEFAULT 0,
                photo_ids TEXT,
                photo_urls TEXT,
                photo_thumbnails TEXT,
                photo_captions TEXT,
                complaint_theme TEXT,
                business_insight TEXT,
                matched_defect_code TEXT,
                matched_defect_desc TEXT,
                matched_defect_group_code TEXT,
                matched_defect_group TEXT,
                similarity_score REAL,
                semantic_match_method TEXT,
                operation_related INTEGER NOT NULL DEFAULT 0,
                confidence_score REAL,
                scraped_at TEXT,
                PRIMARY KEY (product_id, review_id)
            );

            CREATE TABLE IF NOT EXISTS ingestion_errors (
                error_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT,
                timestamp TEXT NOT NULL,
                product_id TEXT,
                stage TEXT NOT NULL,
                error_type TEXT NOT NULL,
                status_code INTEGER,
                page_offset_or_cursor TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                message TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS review_analysis (
                analysis_key TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                review_id TEXT NOT NULL,
                review_content_hash TEXT NOT NULL,
                complaint_theme TEXT,
                business_insight TEXT,
                matched_defect_group TEXT,
                matched_defect_group_code TEXT,
                matched_defect_code TEXT,
                matched_defect_desc TEXT,
                similarity_score REAL,
                confidence_score REAL,
                semantic_match_method TEXT,
                operation_related INTEGER NOT NULL DEFAULT 0,
                classifier_version TEXT NOT NULL,
                embedding_model_name TEXT NOT NULL,
                embedding_model_version TEXT NOT NULL,
                semantic_threshold REAL NOT NULL,
                taxonomy_version TEXT NOT NULL,
                taxonomy_hash TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                analysis_status TEXT NOT NULL,
                analysis_error TEXT
            );

            CREATE TABLE IF NOT EXISTS review_assets (
                product_id TEXT NOT NULL,
                review_id TEXT NOT NULL,
                photo_id TEXT NOT NULL,
                source_url TEXT NOT NULL,
                storage_path TEXT,
                content_hash TEXT,
                download_status TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                first_seen_at TEXT NOT NULL,
                last_attempt_at TEXT,
                downloaded_at TEXT,
                error_message TEXT,
                PRIMARY KEY (product_id, review_id, photo_id)
            );

            CREATE INDEX IF NOT EXISTS idx_reviews_last_seen_at
                ON reviews(last_seen_at);
            CREATE INDEX IF NOT EXISTS idx_reviews_content_hash
                ON reviews(content_hash);
            CREATE INDEX IF NOT EXISTS idx_ingestion_errors_run_id
                ON ingestion_errors(run_id);
            CREATE INDEX IF NOT EXISTS idx_review_analysis_lookup
                ON review_analysis(product_id, review_id, review_content_hash);
            CREATE INDEX IF NOT EXISTS idx_review_assets_status
                ON review_assets(download_status);
            """
        )
        _ensure_columns(
            connection,
            "ingestion_runs",
            {
                "complaint_classifications_performed": "INTEGER NOT NULL DEFAULT 0",
                "semantic_matches_performed": "INTEGER NOT NULL DEFAULT 0",
                "cached_analysis_reused": "INTEGER NOT NULL DEFAULT 0",
                "images_queued": "INTEGER NOT NULL DEFAULT 0",
                "images_downloaded": "INTEGER NOT NULL DEFAULT 0",
                "images_skipped": "INTEGER NOT NULL DEFAULT 0",
                "images_failed": "INTEGER NOT NULL DEFAULT 0",
            },
        )
    return target


def backup_state_db(db_path: Path | None = None) -> Path | None:
    target = Path(db_path or get_config().state_db_path)
    if not target.exists():
        return None
    backup_name = f"{target.stem}.{datetime.now(timezone.utc):%Y%m%d%H%M%S}.bak{target.suffix}"
    backup_path = target.with_name(backup_name)
    shutil.copy2(target, backup_path)
    wal_path = target.with_suffix(target.suffix + "-wal")
    if wal_path.exists():
        shutil.copy2(wal_path, backup_path.with_name(backup_path.name + "-wal"))
    return backup_path


@dataclass
class ReviewUpsertStats:
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    duplicates: int = 0
    invalid: int = 0


class ReviewRepository:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or get_config().state_db_path)
        initialize_state_db(self.db_path)

    def _normalize_review(
        self,
        review: dict[str, Any],
        *,
        ingestion_run_id: str | None,
        seen_at: str,
    ) -> dict[str, Any] | None:
        product_id = normalize_text(review.get("product_id"))
        review_id = normalize_text(review.get("review_id"))
        if not product_id or not review_id:
            return None

        raw_payload_json = json.dumps(review, ensure_ascii=False, sort_keys=True)
        payload_hash = build_source_payload_hash(review)
        content_hash = build_review_content_hash(review)

        return {
            "product_id": product_id,
            "review_id": review_id,
            "product_name": normalize_text(review.get("product_name")),
            "product_name_id": normalize_text(review.get("productNameId") or review.get("product_name_id")),
            "product_url": normalize_text(review.get("product_url")),
            "category": normalize_text(review.get("category")),
            "rating": int(review.get("rating") or 0),
            "title": normalize_text(review.get("title") or review.get("review_title")),
            "review_text": normalize_text(review.get("review_text")),
            "author": normalize_text(review.get("author")),
            "source_created_at": normalize_text(review.get("submission_time") or review.get("source_created_at")),
            "source_updated_at": normalize_text(review.get("source_updated_at")),
            "first_seen_at": seen_at,
            "last_seen_at": seen_at,
            "content_hash": content_hash,
            "source_payload_hash": payload_hash,
            "is_active": 1,
            "ingestion_run_id": normalize_text(ingestion_run_id),
            "raw_payload_json": raw_payload_json,
            "badge": normalize_text(review.get("badge")),
            "is_staff": normalize_bool(review.get("is_staff")),
            "is_verified_buyer": normalize_bool(review.get("is_verified_buyer")),
            "likes": int(review.get("likes") or 0),
            "incentivized_review_label": normalize_text(review.get("incentivized_review_label")),
            "fit_feedback": normalize_text(review.get("fit_feedback")),
            "height": normalize_text(review.get("height")),
            "weight": normalize_text(review.get("weight")),
            "size_purchased": normalize_text(review.get("size_purchased")),
            "usual_size": normalize_text(review.get("usual_size")),
            "total_comments": int(review.get("total_comments") or 0),
            "comments_json": normalize_text(review.get("comments_json")),
            "lulu_response_author": normalize_text(review.get("lulu_response_author")),
            "lulu_response_text": normalize_text(review.get("lulu_response_text")),
            "lulu_response_time": normalize_text(review.get("lulu_response_time")),
            "photo_count": int(review.get("photo_count") or 0),
            "photo_ids": serialize_list_field(review.get("photo_ids")),
            "photo_urls": serialize_list_field(review.get("photo_urls")),
            "photo_thumbnails": serialize_list_field(review.get("photo_thumbnails")),
            "photo_captions": serialize_list_field(review.get("photo_captions")),
            "complaint_theme": normalize_text(review.get("complaint_theme")),
            "business_insight": normalize_text(review.get("business_insight")),
            "matched_defect_code": normalize_text(review.get("matched_defect_code")),
            "matched_defect_desc": normalize_text(review.get("matched_defect_desc")),
            "matched_defect_group_code": normalize_text(review.get("matched_defect_group_code")),
            "matched_defect_group": normalize_text(review.get("matched_defect_group")),
            "similarity_score": float(review.get("similarity_score") or 0.0),
            "semantic_match_method": normalize_text(review.get("semantic_match_method")),
            "operation_related": normalize_bool(review.get("operation_related")),
            "confidence_score": float(review.get("confidence_score") or 0.0),
            "scraped_at": normalize_text(review.get("scraped_at")),
        }

    def bulk_upsert_reviews(
        self,
        reviews: list[dict[str, Any]],
        *,
        ingestion_run_id: str | None = None,
        seen_at: str | None = None,
    ) -> ReviewUpsertStats:
        stats = ReviewUpsertStats()
        seen_at = seen_at or utc_now_iso()
        seen_keys: set[tuple[str, str]] = set()

        with get_db_connection(self.db_path) as connection:
            for review in reviews:
                normalized = self._normalize_review(
                    review,
                    ingestion_run_id=ingestion_run_id,
                    seen_at=seen_at,
                )
                if normalized is None:
                    stats.invalid += 1
                    continue

                key = (normalized["product_id"], normalized["review_id"])
                if key in seen_keys:
                    stats.duplicates += 1
                    continue
                seen_keys.add(key)

                existing = connection.execute(
                    """
                    SELECT content_hash, source_payload_hash, first_seen_at
                    FROM reviews
                    WHERE product_id = ? AND review_id = ?
                    """,
                    key,
                ).fetchone()

                if existing is None:
                    columns = ", ".join(REVIEW_STORAGE_FIELDS)
                    placeholders = ", ".join("?" for _ in REVIEW_STORAGE_FIELDS)
                    connection.execute(
                        f"INSERT INTO reviews ({columns}) VALUES ({placeholders})",
                        [normalized[field] for field in REVIEW_STORAGE_FIELDS],
                    )
                    stats.inserted += 1
                    continue

                normalized["first_seen_at"] = existing["first_seen_at"]
                changed = (
                    normalized["content_hash"] != existing["content_hash"]
                    or normalized["source_payload_hash"] != existing["source_payload_hash"]
                )
                assignments = ", ".join(
                    f"{field} = ?"
                    for field in REVIEW_STORAGE_FIELDS
                    if field not in REVIEW_IDENTITY_FIELDS
                )
                values = [
                    normalized[field]
                    for field in REVIEW_STORAGE_FIELDS
                    if field not in REVIEW_IDENTITY_FIELDS
                ]
                values.extend(key)
                connection.execute(
                    f"""
                    UPDATE reviews
                    SET {assignments}
                    WHERE product_id = ? AND review_id = ?
                    """,
                    values,
                )
                if changed:
                    stats.updated += 1
                else:
                    stats.unchanged += 1

        return stats

    def get_existing_reviews(
        self,
        keys: Iterable[tuple[str, str]],
    ) -> dict[tuple[str, str], sqlite3.Row]:
        key_list = list(keys)
        if not key_list:
            return {}
        placeholders = ", ".join("(?, ?)" for _ in key_list)
        params: list[str] = []
        for product_id, review_id in key_list:
            params.extend([product_id, review_id])
        with get_db_connection(self.db_path) as connection:
            rows = connection.execute(
                f"""
                SELECT *
                FROM reviews
                WHERE (product_id, review_id) IN ({placeholders})
                """,
                params,
            ).fetchall()
        return {
            (str(row["product_id"]), str(row["review_id"])): row
            for row in rows
        }

    def review_has_changed(self, review: dict[str, Any], existing_row: sqlite3.Row) -> bool:
        return build_review_content_hash(review) != str(existing_row["content_hash"])

    def get_review(self, product_id: str, review_id: str) -> sqlite3.Row | None:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                "SELECT * FROM reviews WHERE product_id = ? AND review_id = ?",
                (product_id, review_id),
            ).fetchone()

    def count_reviews(self) -> int:
        with get_db_connection(self.db_path) as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM reviews").fetchone()
        return int(row["count"]) if row else 0

    def count_reviews_for_product(self, product_id: str) -> int:
        with get_db_connection(self.db_path) as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM reviews WHERE product_id = ? AND is_active = 1",
                (product_id,),
            ).fetchone()
        return int(row["count"]) if row else 0

    def list_active_reviews(self) -> list[dict[str, Any]]:
        with get_db_connection(self.db_path) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM reviews
                WHERE is_active = 1
                ORDER BY product_id, rating, source_created_at, review_id
                """
            ).fetchall()
        return [self._row_to_review_dict(row) for row in rows]

    def list_reviews(self, *, active_only: bool = True) -> list[sqlite3.Row]:
        query = "SELECT * FROM reviews"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY product_id, review_id"
        with get_db_connection(self.db_path) as connection:
            return connection.execute(query).fetchall()

    def get_low_star_reviews(self, max_rating: int) -> list[sqlite3.Row]:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                """
                SELECT *
                FROM reviews
                WHERE is_active = 1 AND rating <= ?
                ORDER BY product_id, review_id
                """,
                (max_rating,),
            ).fetchall()

    def get_latest_analysis_for_review(
        self,
        *,
        product_id: str,
        review_id: str,
    ) -> list[sqlite3.Row]:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                """
                SELECT *
                FROM review_analysis
                WHERE product_id = ? AND review_id = ?
                ORDER BY processed_at DESC
                """,
                (product_id, review_id),
            ).fetchall()

    def find_reusable_complaint_analysis(
        self,
        *,
        product_id: str,
        review_id: str,
        review_content_hash: str,
        classifier_version: str,
    ) -> sqlite3.Row | None:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                """
                SELECT *
                FROM review_analysis
                WHERE product_id = ?
                  AND review_id = ?
                  AND review_content_hash = ?
                  AND classifier_version = ?
                  AND complaint_theme IS NOT NULL
                  AND complaint_theme != ''
                  AND analysis_status != 'failed'
                ORDER BY processed_at DESC
                LIMIT 1
                """,
                (product_id, review_id, review_content_hash, classifier_version),
            ).fetchone()

    def get_current_analysis(
        self,
        *,
        product_id: str,
        review_id: str,
        review_content_hash: str,
        classifier_version: str,
        embedding_model_name: str,
        embedding_model_version: str,
        semantic_threshold: float,
        taxonomy_hash: str,
    ) -> sqlite3.Row | None:
        analysis_key = build_analysis_key(
            product_id=product_id,
            review_id=review_id,
            review_content_hash=review_content_hash,
            classifier_version=classifier_version,
            embedding_model_name=embedding_model_name,
            embedding_model_version=embedding_model_version,
            semantic_threshold=semantic_threshold,
            taxonomy_hash=taxonomy_hash,
        )
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                "SELECT * FROM review_analysis WHERE analysis_key = ?",
                (analysis_key,),
            ).fetchone()

    def upsert_review_analysis(self, record: dict[str, Any]) -> None:
        payload = dict(record)
        payload.setdefault("processed_at", utc_now_iso())
        payload.setdefault("analysis_status", "complete")
        columns = [
            "analysis_key",
            "product_id",
            "review_id",
            "review_content_hash",
            "complaint_theme",
            "business_insight",
            "matched_defect_group",
            "matched_defect_group_code",
            "matched_defect_code",
            "matched_defect_desc",
            "similarity_score",
            "confidence_score",
            "semantic_match_method",
            "operation_related",
            "classifier_version",
            "embedding_model_name",
            "embedding_model_version",
            "semantic_threshold",
            "taxonomy_version",
            "taxonomy_hash",
            "processed_at",
            "analysis_status",
            "analysis_error",
        ]
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in columns[4:])
        with get_db_connection(self.db_path) as connection:
            connection.execute(
                f"""
                INSERT INTO review_analysis ({", ".join(columns)})
                VALUES ({placeholders})
                ON CONFLICT(analysis_key) DO UPDATE SET
                    {updates}
                """,
                [payload.get(column) for column in columns],
            )

    def get_reviews_needing_complaint_analysis(
        self,
        *,
        max_rating: int,
        classifier_version: str,
        current_embedding_model_name: str,
        current_embedding_model_version: str,
        current_semantic_threshold: float,
        current_taxonomy_hash: str,
    ) -> tuple[list[sqlite3.Row], int]:
        eligible = self.get_low_star_reviews(max_rating)
        needed: list[sqlite3.Row] = []
        reused = 0
        for review in eligible:
            current = self.get_current_analysis(
                product_id=review["product_id"],
                review_id=review["review_id"],
                review_content_hash=review["content_hash"],
                classifier_version=classifier_version,
                embedding_model_name=current_embedding_model_name,
                embedding_model_version=current_embedding_model_version,
                semantic_threshold=current_semantic_threshold,
                taxonomy_hash=current_taxonomy_hash,
            )
            if current is not None and normalize_text(current["complaint_theme"]):
                reused += 1
                continue
            needed.append(review)
        return needed, reused

    def get_reviews_needing_semantic_analysis(
        self,
        *,
        max_rating: int,
        classifier_version: str,
        embedding_model_name: str,
        embedding_model_version: str,
        semantic_threshold: float,
        taxonomy_hash: str,
    ) -> tuple[list[sqlite3.Row], int]:
        eligible = self.get_low_star_reviews(max_rating)
        needed: list[sqlite3.Row] = []
        reused = 0
        for review in eligible:
            current = self.get_current_analysis(
                product_id=review["product_id"],
                review_id=review["review_id"],
                review_content_hash=review["content_hash"],
                classifier_version=classifier_version,
                embedding_model_name=embedding_model_name,
                embedding_model_version=embedding_model_version,
                semantic_threshold=semantic_threshold,
                taxonomy_hash=taxonomy_hash,
            )
            if (
                current is not None
                and normalize_text(current["matched_defect_group"])
                and current["analysis_status"] != "failed"
            ):
                reused += 1
                continue
            needed.append(review)
        return needed, reused

    def get_current_analysis_map(
        self,
        *,
        classifier_version: str,
        embedding_model_name: str,
        embedding_model_version: str,
        semantic_threshold: float,
        taxonomy_hash: str,
    ) -> dict[tuple[str, str, str], sqlite3.Row]:
        with get_db_connection(self.db_path) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM review_analysis
                WHERE classifier_version = ?
                  AND embedding_model_name = ?
                  AND embedding_model_version = ?
                  AND semantic_threshold = ?
                  AND taxonomy_hash = ?
                """,
                (
                    classifier_version,
                    embedding_model_name,
                    embedding_model_version,
                    semantic_threshold,
                    taxonomy_hash,
                ),
            ).fetchall()
        return {
            (row["product_id"], row["review_id"], row["review_content_hash"]): row
            for row in rows
        }

    def upsert_review_asset(self, record: dict[str, Any]) -> None:
        payload = dict(record)
        payload.setdefault("attempt_count", 0)
        payload.setdefault("first_seen_at", utc_now_iso())
        columns = [
            "product_id",
            "review_id",
            "photo_id",
            "source_url",
            "storage_path",
            "content_hash",
            "download_status",
            "attempt_count",
            "first_seen_at",
            "last_attempt_at",
            "downloaded_at",
            "error_message",
        ]
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in columns[3:])
        with get_db_connection(self.db_path) as connection:
            connection.execute(
                f"""
                INSERT INTO review_assets ({", ".join(columns)})
                VALUES ({placeholders})
                ON CONFLICT(product_id, review_id, photo_id) DO UPDATE SET
                    {updates}
                """,
                [payload.get(column) for column in columns],
            )

    def get_review_asset(
        self,
        *,
        product_id: str,
        review_id: str,
        photo_id: str,
    ) -> sqlite3.Row | None:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                """
                SELECT *
                FROM review_assets
                WHERE product_id = ? AND review_id = ? AND photo_id = ?
                """,
                (product_id, review_id, photo_id),
            ).fetchone()

    def list_review_assets(self) -> list[sqlite3.Row]:
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                "SELECT * FROM review_assets ORDER BY product_id, review_id, photo_id"
            ).fetchall()

    def get_reviews_needing_image_processing(self, *, max_rating: int) -> tuple[list[dict[str, Any]], int]:
        reviews = self.get_low_star_reviews(max_rating)
        queued: list[dict[str, Any]] = []
        skipped = 0
        for review in reviews:
            photo_ids = normalize_list_field(review["photo_ids"])
            photo_urls = normalize_list_field(review["photo_urls"])
            if not photo_urls:
                continue
            for index, source_url in enumerate(photo_urls, start=1):
                photo_id = (
                    photo_ids[index - 1] if index - 1 < len(photo_ids) else f"photo_{index}"
                )
                existing = self.get_review_asset(
                    product_id=str(review["product_id"]),
                    review_id=str(review["review_id"]),
                    photo_id=photo_id,
                )
                if existing is not None and existing["download_status"] == "downloaded":
                    skipped += 1
                    continue
                queued.append(
                    {
                        "review": review,
                        "photo_id": photo_id,
                        "photo_number": index,
                        "source_url": source_url,
                    }
                )
        return queued, skipped

    def build_low_star_export_rows(
        self,
        *,
        max_rating: int,
        classifier_version: str,
        embedding_model_name: str,
        embedding_model_version: str,
        semantic_threshold: float,
        taxonomy_hash: str,
    ) -> list[dict[str, Any]]:
        rows = self.get_low_star_reviews(max_rating)
        analysis_map = self.get_current_analysis_map(
            classifier_version=classifier_version,
            embedding_model_name=embedding_model_name,
            embedding_model_version=embedding_model_version,
            semantic_threshold=semantic_threshold,
            taxonomy_hash=taxonomy_hash,
        )
        export_rows: list[dict[str, Any]] = []
        for row in rows:
            record = self._row_to_review_dict(row)
            analysis = analysis_map.get(
                (row["product_id"], row["review_id"], row["content_hash"])
            )
            if analysis is not None:
                record["complaint_theme"] = normalize_text(analysis["complaint_theme"])
                record["business_insight"] = normalize_text(analysis["business_insight"])
                record["matched_defect_code"] = normalize_text(analysis["matched_defect_code"])
                record["matched_defect_desc"] = normalize_text(analysis["matched_defect_desc"])
                record["matched_defect_group_code"] = normalize_text(
                    analysis["matched_defect_group_code"]
                )
                record["matched_defect_group"] = normalize_text(analysis["matched_defect_group"])
                record["similarity_score"] = float(analysis["similarity_score"] or 0.0)
                record["semantic_match_method"] = normalize_text(
                    analysis["semantic_match_method"]
                )
                record["operation_related"] = bool(analysis["operation_related"])
                record["confidence_score"] = float(analysis["confidence_score"] or 0.0)
            export_rows.append(record)
        return export_rows

    def build_image_mapping_rows(
        self,
        *,
        max_rating: int,
        classifier_version: str,
        embedding_model_name: str,
        embedding_model_version: str,
        semantic_threshold: float,
        taxonomy_hash: str,
    ) -> list[dict[str, Any]]:
        review_rows = {
            (row["product_id"], row["review_id"]): row
            for row in self.get_low_star_reviews(max_rating)
        }
        export_reviews = {
            (row["product_id"], row["review_id"]): row
            for row in self.build_low_star_export_rows(
                max_rating=max_rating,
                classifier_version=classifier_version,
                embedding_model_name=embedding_model_name,
                embedding_model_version=embedding_model_version,
                semantic_threshold=semantic_threshold,
                taxonomy_hash=taxonomy_hash,
            )
        }
        rows: list[dict[str, Any]] = []
        for asset in self.list_review_assets():
            review_key = (asset["product_id"], asset["review_id"])
            review_row = review_rows.get(review_key)
            export_row = export_reviews.get(review_key)
            if review_row is None or export_row is None:
                continue
            if asset["download_status"] != "downloaded":
                continue
            photo_ids = normalize_list_field(review_row["photo_ids"])
            try:
                photo_number = photo_ids.index(asset["photo_id"]) + 1
            except ValueError:
                photo_number = 1
            rows.append(
                {
                    "product_name": export_row["product_name"],
                    "product_id": export_row["product_id"],
                    "productNameId": export_row["productNameId"],
                    "product_url": export_row["product_url"],
                    "category": export_row["category"],
                    "review_id": export_row["review_id"],
                    "rating": export_row["rating"],
                    "review_date": export_row["submission_time"],
                    "review_title": export_row["title"],
                    "review_text": export_row["review_text"],
                    "complaint_theme": export_row["complaint_theme"],
                    "business_insight": export_row["business_insight"],
                    "photo_id": asset["photo_id"],
                    "photo_number": photo_number,
                    "image_url": asset["source_url"],
                    "local_image_path": asset["storage_path"] or "",
                    "verified_buyer": export_row["is_verified_buyer"],
                    "helpful_votes": export_row["likes"],
                    "size_purchased": export_row["size_purchased"],
                    "fit_feedback": export_row["fit_feedback"],
                }
            )
        return rows

    def get_health_snapshot(self) -> dict[str, Any]:
        with get_db_connection(self.db_path) as connection:
            last_run = connection.execute(
                "SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 1"
            ).fetchone()
            last_success = connection.execute(
                "SELECT finished_at FROM ingestion_runs WHERE status LIKE '%completed' ORDER BY finished_at DESC LIMIT 1"
            ).fetchone()
            recent_runs = connection.execute(
                "SELECT status, http_403_count, http_429_count, schema_error_count FROM ingestion_runs ORDER BY started_at DESC LIMIT 30"
            ).fetchall()
            total_reviews = connection.execute(
                "SELECT COUNT(*) AS count FROM reviews WHERE is_active = 1"
            ).fetchone()["count"]
            low_star_reviews = connection.execute(
                "SELECT COUNT(*) AS count FROM reviews WHERE is_active = 1 AND rating <= ?",
                (get_config().low_star_max_rating,),
            ).fetchone()["count"]
            pending_analysis_count = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM reviews
                WHERE is_active = 1 AND rating <= ?
                  AND NOT EXISTS (
                    SELECT 1 FROM review_analysis
                    WHERE review_analysis.product_id = reviews.product_id
                      AND review_analysis.review_id = reviews.review_id
                      AND review_analysis.review_content_hash = reviews.content_hash
                      AND review_analysis.analysis_status = 'complete'
                  )
                """,
                (get_config().low_star_max_rating,),
            ).fetchone()["count"]
            failed_analysis_count = connection.execute(
                "SELECT COUNT(*) AS count FROM review_analysis WHERE analysis_status = 'failed'"
            ).fetchone()["count"]
            pending_image_count = connection.execute(
                "SELECT COUNT(*) AS count FROM review_assets WHERE download_status IN ('pending', 'failed')"
            ).fetchone()["count"]
            failed_image_count = connection.execute(
                "SELECT COUNT(*) AS count FROM review_assets WHERE download_status = 'failed'"
            ).fetchone()["count"]
            products_unhealthy = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM product_checkpoints
                WHERE cooldown_until IS NOT NULL AND cooldown_until > ?
                """,
                (utc_now_iso(),),
            ).fetchone()["count"]
            products_total = connection.execute(
                "SELECT COUNT(*) AS count FROM product_checkpoints"
            ).fetchone()["count"]

        last_successful_run_at = last_success["finished_at"] if last_success else None
        freshness = None
        if last_successful_run_at:
            freshness = round(
                (
                    datetime.now(timezone.utc)
                    - datetime.fromisoformat(str(last_successful_run_at).replace("Z", "+00:00"))
                ).total_seconds()
                / 3600,
                2,
            )
        successful_runs_last_30 = sum(
            1 for row in recent_runs if "completed" in str(row["status"])
        )
        failed_runs_last_30 = len(recent_runs) - successful_runs_last_30
        return {
            "last_successful_run_at": last_successful_run_at,
            "last_run_status": last_run["status"] if last_run else None,
            "data_freshness_hours": freshness,
            "total_reviews": int(total_reviews),
            "new_reviews_last_run": int(last_run["new_reviews"]) if last_run else 0,
            "updated_reviews_last_run": int(last_run["updated_reviews"]) if last_run else 0,
            "low_star_reviews": int(low_star_reviews),
            "pending_analysis_count": int(pending_analysis_count),
            "failed_analysis_count": int(failed_analysis_count),
            "pending_image_count": int(pending_image_count),
            "failed_image_count": int(failed_image_count),
            "products_healthy": max(int(products_total) - int(products_unhealthy), 0),
            "products_unhealthy": int(products_unhealthy),
            "http_403_last_30_runs": sum(int(row["http_403_count"]) for row in recent_runs),
            "http_429_last_30_runs": sum(int(row["http_429_count"]) for row in recent_runs),
            "schema_errors_last_30_runs": sum(
                int(row["schema_error_count"]) for row in recent_runs
            ),
            "successful_runs_last_30": successful_runs_last_30,
            "failed_runs_last_30": failed_runs_last_30,
        }

    def _row_to_review_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "product_name": row["product_name"],
            "product_id": row["product_id"],
            "productNameId": row["product_name_id"],
            "product_url": row["product_url"],
            "category": row["category"],
            "review_id": row["review_id"],
            "rating": row["rating"],
            "title": row["title"],
            "review_text": row["review_text"],
            "submission_time": row["source_created_at"],
            "author": row["author"],
            "is_staff": bool(row["is_staff"]),
            "is_verified_buyer": bool(row["is_verified_buyer"]),
            "badge": row["badge"],
            "likes": row["likes"],
            "incentivized_review_label": row["incentivized_review_label"],
            "fit_feedback": row["fit_feedback"],
            "height": row["height"],
            "weight": row["weight"],
            "size_purchased": row["size_purchased"],
            "usual_size": row["usual_size"],
            "total_comments": row["total_comments"],
            "comments_json": row["comments_json"],
            "lulu_response_author": row["lulu_response_author"],
            "lulu_response_text": row["lulu_response_text"],
            "lulu_response_time": row["lulu_response_time"],
            "photo_count": row["photo_count"],
            "photo_ids": row["photo_ids"],
            "photo_urls": row["photo_urls"],
            "photo_thumbnails": row["photo_thumbnails"],
            "photo_captions": row["photo_captions"],
            "complaint_theme": row["complaint_theme"],
            "business_insight": row["business_insight"],
            "matched_defect_code": row["matched_defect_code"],
            "matched_defect_desc": row["matched_defect_desc"],
            "matched_defect_group_code": row["matched_defect_group_code"],
            "matched_defect_group": row["matched_defect_group"],
            "similarity_score": row["similarity_score"],
            "semantic_match_method": row["semantic_match_method"],
            "operation_related": bool(row["operation_related"]),
            "confidence_score": row["confidence_score"],
            "scraped_at": row["scraped_at"],
        }
