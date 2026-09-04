from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from pipeline.config import get_config
from pipeline.storage.review_repository import (
    RUN_COUNTER_FIELDS,
    get_db_connection,
    initialize_state_db,
    utc_now_iso,
)


class RunLogger:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or get_config().state_db_path)
        initialize_state_db(self.db_path)

    def start_run(self, *, status: str = "running") -> str:
        run_id = str(uuid.uuid4())
        with get_db_connection(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO ingestion_runs (
                    run_id,
                    started_at,
                    status
                ) VALUES (?, ?, ?)
                """,
                (run_id, utc_now_iso(), status),
            )
        return run_id

    def finish_run(
        self,
        run_id: str,
        *,
        status: str,
        error_message: str | None = None,
        **metrics: int,
    ) -> None:
        values = {field: int(metrics.get(field, 0)) for field in RUN_COUNTER_FIELDS}
        with get_db_connection(self.db_path) as connection:
            connection.execute(
                f"""
                UPDATE ingestion_runs
                SET finished_at = ?,
                    status = ?,
                    {", ".join(f"{field} = ?" for field in RUN_COUNTER_FIELDS)},
                    error_message = ?
                WHERE run_id = ?
                """,
                (
                    utc_now_iso(),
                    status,
                    *[values[field] for field in RUN_COUNTER_FIELDS],
                    error_message,
                    run_id,
                ),
            )

    def log_error(
        self,
        *,
        run_id: str | None,
        product_id: str | None,
        stage: str,
        error_type: str,
        message: str,
        status_code: int | None = None,
        page_offset_or_cursor: str | None = None,
        retry_count: int = 0,
    ) -> int:
        with get_db_connection(self.db_path) as connection:
            cursor = connection.execute(
                """
                INSERT INTO ingestion_errors (
                    run_id,
                    timestamp,
                    product_id,
                    stage,
                    error_type,
                    status_code,
                    page_offset_or_cursor,
                    retry_count,
                    message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    utc_now_iso(),
                    product_id,
                    stage,
                    error_type,
                    status_code,
                    page_offset_or_cursor,
                    retry_count,
                    message,
                ),
            )
        return int(cursor.lastrowid)

    def get_run(self, run_id: str):
        with get_db_connection(self.db_path) as connection:
            return connection.execute(
                "SELECT * FROM ingestion_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
