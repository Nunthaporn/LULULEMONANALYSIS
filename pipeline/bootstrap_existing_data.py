from __future__ import annotations

import argparse
import csv
from pathlib import Path

from pipeline.config import get_config
from pipeline.ingestion.run_logger import RunLogger
from pipeline.storage.review_repository import (
    ReviewRepository,
    backup_state_db,
    initialize_state_db,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    config = get_config()
    parser = argparse.ArgumentParser(
        description="Bootstrap existing historical reviews into the pipeline state database.",
    )
    parser.add_argument(
        "--source",
        default=str(config.processed_dir / "all_reviews.csv"),
        help="Path to the historical all_reviews CSV file.",
    )
    parser.add_argument(
        "--db",
        default=str(config.state_db_path),
        help="Path to the SQLite state database.",
    )
    return parser.parse_args(argv)


def read_review_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    source_path = Path(args.source)
    db_path = Path(args.db)

    if not source_path.exists():
        raise SystemExit(f"Historical review dataset not found: {source_path}")

    backup_path = backup_state_db(db_path)
    initialize_state_db(db_path)

    rows = read_review_rows(source_path)
    repository = ReviewRepository(db_path)
    run_logger = RunLogger(db_path)
    run_id = run_logger.start_run(status="bootstrap_running")

    try:
        stats = repository.bulk_upsert_reviews(rows, ingestion_run_id=run_id)
        run_logger.finish_run(
            run_id,
            status="bootstrap_completed",
            reviews_seen=len(rows),
            new_reviews=stats.inserted,
            updated_reviews=stats.updated,
            duplicate_reviews=stats.duplicates,
        )
    except Exception as exc:
        run_logger.finish_run(run_id, status="bootstrap_failed", error_message=str(exc))
        raise

    print(f"Source dataset: {source_path}")
    print(f"State database: {db_path}")
    if backup_path is not None:
        print(f"Database backup: {backup_path}")
    print(f"Inserted: {stats.inserted}")
    print(f"Updated: {stats.updated}")
    print(f"Unchanged: {stats.unchanged}")
    print(f"Duplicate input rows: {stats.duplicates}")
    print(f"Invalid rows: {stats.invalid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
