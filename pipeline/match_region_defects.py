"""Run the semantic defect matcher against the scraped region review datasets
(Asia, Australia, New Zealand) and write matched_defect_group / operation_related
fields back into the region JSON files, mirroring what the NA pipeline does.
"""
from __future__ import annotations

import json
from pathlib import Path

from pipeline.semantic_defect_matcher import match_reviews_to_defects, DEFAULT_THRESHOLD

REGION_FILES = [
    "reviews_asia.json",
    "reviews_australia.json",
    "reviews_new_zealand.json",
]

PROCESSED_DIR = Path("data/processed/dashboard_data")
PUBLIC_DIR = Path("public/data/dashboard_data")


def run_for_file(filename: str) -> dict:
    path = PROCESSED_DIR / filename
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)

    match_rows = [{"title": r.get("title", ""), "review_text": r.get("review_text", "")} for r in rows]
    matches = match_reviews_to_defects(match_rows, threshold=DEFAULT_THRESHOLD)

    matched_count = 0
    group_counts: dict[str, int] = {}
    for row, match in zip(rows, matches):
        row["matched_defect_group_code"] = match["matched_defect_group_code"]
        row["matched_defect_group"] = match["matched_defect_group"]
        row["matched_defect_code"] = match["matched_defect_code"]
        row["matched_defect_desc"] = match["matched_defect_desc"]
        row["similarity_score"] = match["similarity_score"]
        row["confidence_score"] = match["confidence_score"]
        row["semantic_match_method"] = match["semantic_match_method"]
        row["operation_related"] = bool(match["operation_related"])
        if match["operation_related"]:
            matched_count += 1
            group_counts[match["matched_defect_group"]] = group_counts.get(match["matched_defect_group"], 0) + 1

    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    public_path = PUBLIC_DIR / filename
    with open(public_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    return {
        "file": filename,
        "total": len(rows),
        "matched": matched_count,
        "groups": group_counts,
    }


if __name__ == "__main__":
    summary = [run_for_file(name) for name in REGION_FILES]
    print(json.dumps(summary, indent=2, ensure_ascii=False))
