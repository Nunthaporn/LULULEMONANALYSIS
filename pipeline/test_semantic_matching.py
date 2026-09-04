from __future__ import annotations

import argparse
import sys

from pipeline.pipeline_common import LOW_STAR_REVIEWS_CSV, log, read_csv_rows
from pipeline.semantic_defect_matcher import (
    DEFAULT_THRESHOLD,
    combine_review_text,
    match_reviews_to_defects,
)


def preview(text: str, length: int = 90) -> str:
    text = text.strip()
    if not text:
        return "(empty review text)"
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"


def main() -> int:
    # Avoid UnicodeEncodeError on Windows consoles when review text contains
    # emoji or smart quotes outside the active code page.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description="Debug the semantic defect matcher against real low-star reviews.",
    )
    parser.add_argument("--limit", type=int, default=20, help="Number of reviews to test (default: 20).")
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=f"Similarity threshold (default: {DEFAULT_THRESHOLD}).",
    )
    args = parser.parse_args()

    rows = read_csv_rows(LOW_STAR_REVIEWS_CSV)
    if not rows:
        log(f"No rows found in {LOW_STAR_REVIEWS_CSV}. Run the pipeline first.")
        return 1

    sample = rows[: args.limit]
    log(f"Testing semantic matcher on {len(sample)} of {len(rows)} low-star reviews (threshold={args.threshold}).")

    matches = match_reviews_to_defects(sample, threshold=args.threshold)

    print()
    for row, match in zip(sample, matches):
        print(f"Review:          {preview(combine_review_text(row))}")
        print(f"Matched group:   {match['matched_defect_group']}")
        print(f"Similarity:      {match['similarity_score']}  (method={match['semantic_match_method']})")
        print("-" * 70)

    matched = sum(1 for m in matches if m["semantic_match_method"] == "sentence_transformer")
    unclassified = sum(1 for m in matches if m["semantic_match_method"] == "unclassified")
    print(f"\nSummary: {matched} matched to official groups, {unclassified} unclassified (of {len(sample)}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
