from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pipeline.config import get_config
from pipeline.storage.review_repository import get_db_connection, initialize_state_db, utc_now_iso


@dataclass
class ProductCheckpoint:
    product_id: str
    source_product_key: str
    last_success_at: str | None
    newest_seen_at: str | None
    total_results_seen: int
    consecutive_failures: int
    cooldown_until: str | None
    last_run_id: str | None
    schema_version: int
    updated_at: str


class CheckpointStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or get_config().state_db_path)
        initialize_state_db(self.db_path)

    def get_checkpoint(self, product_id: str) -> ProductCheckpoint | None:
        with get_db_connection(self.db_path) as connection:
            row = connection.execute(
                "SELECT * FROM product_checkpoints WHERE product_id = ?",
                (product_id,),
            ).fetchone()
        if row is None:
            return None
        return ProductCheckpoint(**dict(row))

    def upsert_checkpoint(
        self,
        *,
        product_id: str,
        source_product_key: str = "",
        last_success_at: str | None = None,
        newest_seen_at: str | None = None,
        total_results_seen: int = 0,
        consecutive_failures: int = 0,
        cooldown_until: str | None = None,
        last_run_id: str | None = None,
        schema_version: int | None = None,
    ) -> None:
        now = utc_now_iso()
        schema_version = schema_version or get_config().schema_version
        with get_db_connection(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO product_checkpoints (
                    product_id,
                    source_product_key,
                    last_success_at,
                    newest_seen_at,
                    total_results_seen,
                    consecutive_failures,
                    cooldown_until,
                    last_run_id,
                    schema_version,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(product_id) DO UPDATE SET
                    source_product_key = excluded.source_product_key,
                    last_success_at = excluded.last_success_at,
                    newest_seen_at = excluded.newest_seen_at,
                    total_results_seen = excluded.total_results_seen,
                    consecutive_failures = excluded.consecutive_failures,
                    cooldown_until = excluded.cooldown_until,
                    last_run_id = excluded.last_run_id,
                    schema_version = excluded.schema_version,
                    updated_at = excluded.updated_at
                """,
                (
                    product_id,
                    source_product_key,
                    last_success_at,
                    newest_seen_at,
                    total_results_seen,
                    consecutive_failures,
                    cooldown_until,
                    last_run_id,
                    schema_version,
                    now,
                ),
            )

    def record_success(
        self,
        *,
        product_id: str,
        source_product_key: str,
        newest_seen_at: str | None,
        total_results_seen: int,
        run_id: str | None,
    ) -> None:
        self.upsert_checkpoint(
            product_id=product_id,
            source_product_key=source_product_key,
            last_success_at=utc_now_iso(),
            newest_seen_at=newest_seen_at,
            total_results_seen=total_results_seen,
            consecutive_failures=0,
            cooldown_until=None,
            last_run_id=run_id,
        )

    def record_failure(
        self,
        *,
        product_id: str,
        source_product_key: str = "",
        run_id: str | None = None,
        cooldown_until: str | None = None,
    ) -> None:
        existing = self.get_checkpoint(product_id)
        failures = 1 if existing is None else existing.consecutive_failures + 1
        self.upsert_checkpoint(
            product_id=product_id,
            source_product_key=source_product_key or (existing.source_product_key if existing else ""),
            last_success_at=existing.last_success_at if existing else None,
            newest_seen_at=existing.newest_seen_at if existing else None,
            total_results_seen=existing.total_results_seen if existing else 0,
            consecutive_failures=failures,
            cooldown_until=cooldown_until,
            last_run_id=run_id,
            schema_version=existing.schema_version if existing else None,
        )
