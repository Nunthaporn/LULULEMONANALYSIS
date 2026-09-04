from __future__ import annotations

import argparse

from pipeline.ingestion.incremental_collector import IncrementalCollector
from pipeline.pipeline_common import ensure_pipeline_dirs, log


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the lululemon review pipeline.")
    parser.add_argument(
        "--mode",
        default="legacy",
        choices=["legacy", "incremental", "full-reconcile", "process-only"],
        help="Pipeline execution mode. Default remains legacy during migration.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview incremental collection without mutating state or dashboard outputs.",
    )
    return parser.parse_args(argv)


def run_processing_steps() -> int:
    from pipeline.complaint_classifier import run as classifier_run
    from pipeline.dashboard_exporter import run as exporter_run
    from pipeline.low_star_processor import run as low_star_run
    from pipeline.multi_product_image_mapper import run as image_mapper_run
    from pipeline.semantic_defect_matcher import run as semantic_matcher_run
    from pipeline.summary_generator import main as summary_main

    steps = [
        ("complaint_classifier", classifier_run),
        ("semantic_defect_matcher", semantic_matcher_run),
        ("multi_product_image_mapper", image_mapper_run),
        ("low_star_processor", low_star_run),
        ("summary_generator", summary_main),
        ("dashboard_exporter", exporter_run),
    ]

    aggregated: dict[str, object] = {}
    for name, func in steps:
        log(f"Running {name}")
        result = func()
        if isinstance(result, dict):
            aggregated.update(result)
            continue
        exit_code = result
        if exit_code not in (0, None):
            raise SystemExit(f"{name} failed with exit code {exit_code}")
    return aggregated


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    ensure_pipeline_dirs()

    if args.mode == "legacy":
        from pipeline.multi_product_reviews_scraper import main as scraper_main

        steps = [("multi_product_reviews_scraper", scraper_main)]
        for name, func in steps:
            log(f"Running {name}")
            exit_code = func()
            if exit_code not in (0, None):
                raise SystemExit(f"{name} failed with exit code {exit_code}")
        run_processing_steps()
        log("Legacy full-refresh pipeline completed successfully.")
        return 0

    if args.mode == "process-only":
        processing_stats = run_processing_steps()
        log(f"PIPELINE RUN SUMMARY: mode=process-only status=SUCCESS stats={processing_stats}")
        log("Process-only pipeline completed successfully.")
        return 0

    collector = IncrementalCollector()
    collection_result = collector.collect(mode=args.mode, dry_run=args.dry_run)

    if args.dry_run:
        log("Dry-run incremental collection completed. No state or dashboard outputs were changed.")
        return 0

    processing_stats = run_processing_steps()
    summary = {
        "run_id": collection_result["run_id"],
        "mode": args.mode,
        "status": "SUCCESS",
        "products_attempted": collection_result["metrics"]["products_attempted"],
        "products_succeeded": collection_result["metrics"]["products_succeeded"],
        "products_failed": collection_result["metrics"]["products_failed"],
        "pages_requested": collection_result["metrics"]["pages_requested"],
        "reviews_seen": collection_result["metrics"]["reviews_seen"],
        "new_reviews": collection_result["metrics"]["new_reviews"],
        "changed_reviews": collection_result["metrics"]["updated_reviews"],
        "unchanged_reviews": "see reconciliation_report.csv",
        **processing_stats,
    }
    log(f"PIPELINE RUN SUMMARY: {summary}")

    log(f"{args.mode} pipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
