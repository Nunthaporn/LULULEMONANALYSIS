from __future__ import annotations

import argparse
import json
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from pipeline.pipeline_common import (
    GRAPHQL_ENDPOINT,
    REVIEW_FIELDNAMES,
    clean_text,
    ensure_pipeline_dirs,
    flatten_review,
    log,
    read_products,
    safe_int,
    write_csv_rows,
    write_json,
)


DEFAULT_START_DATE = "2026-07-09"
DEFAULT_END_DATE = "2026-08-04"
DEFAULT_RATINGS = [1, 2, 3]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape lululemon reviews from a captured cne/graphql curl request for a date window.",
    )
    parser.add_argument("--curl-file", required=True)
    parser.add_argument("--products", default="data/input/products.csv")
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=DEFAULT_END_DATE)
    parser.add_argument("--ratings", default="1,2,3")
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument(
        "--output-prefix",
        default="data/processed/reviews_2026-07-09_to_2026-08-04",
    )
    return parser.parse_args()


def _unescape_shell_data_raw(value: str) -> str:
    return (
        value.replace(r"\'", "'")
        .replace(r"\\", "\\")
        .replace(r"\u0021", "!")
    )


def load_curl_request(path: Path) -> tuple[dict[str, str], dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    headers = {
        key.strip().lower(): value.strip()
        for key, value in re.findall(r"-H '([^:']+):\s*([^']*)'", text)
    }
    cookie_match = re.search(r"\s-b '([^']+)'", text)
    if cookie_match:
        headers["cookie"] = cookie_match.group(1)

    body_match = re.search(r"--data-raw \$'(.+?)'\s*$", text, flags=re.S)
    if not body_match:
        raise ValueError(f"Could not find --data-raw payload in {path}")

    payload = json.loads(_unescape_shell_data_raw(body_match.group(1)))
    return headers, payload


def parse_date_boundary(value: str, *, end: bool = False) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if end and len(value) == len("YYYY-MM-DD"):
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed.astimezone(timezone.utc)


def parse_submission_time(value: Any) -> datetime | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def request_page(
    session: requests.Session,
    *,
    headers_template: dict[str, str],
    payload_template: dict[str, Any],
    product: dict[str, str],
    rating: int,
    offset: int,
    timeout: int,
) -> dict[str, Any]:
    headers = dict(headers_template)
    headers["referer"] = product["product_url"]
    headers["x-lll-ecom-correlation-id"] = str(uuid.uuid4()).upper()
    headers["x-lll-request-correlation-id"] = str(uuid.uuid4())

    payload = json.loads(json.dumps(payload_template))
    variables = payload.setdefault("variables", {})
    variables["productNameId"] = product["productNameId"]
    variables["offset"] = offset
    variables["rating"] = []
    variables["filters"] = [f"Rating:eq:{rating}"]
    variables["sort"] = variables.get("sort") or "Rating:asc"

    response = session.post(
        GRAPHQL_ENDPOINT,
        headers=headers,
        json=payload,
        timeout=max(timeout, 1),
    )
    response.raise_for_status()
    body = response.json()
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], ensure_ascii=True))
    data = body.get("data", {}).get("getReviews")
    if not isinstance(data, dict):
        raise RuntimeError("Response did not include data.getReviews")
    if data.get("hasErrors") and data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"], ensure_ascii=True))
    return data


def main() -> int:
    args = parse_args()
    ensure_pipeline_dirs()

    start_at = parse_date_boundary(args.start_date)
    end_at = parse_date_boundary(args.end_date, end=True)
    ratings = [safe_int(item) for item in args.ratings.split(",") if clean_text(item)]
    output_prefix = Path(args.output_prefix)

    headers_template, payload_template = load_curl_request(Path(args.curl_file))
    products = read_products(Path(args.products))
    session = requests.Session()

    rows: list[dict[str, Any]] = []
    raw_pages: list[dict[str, Any]] = []
    seen_review_keys: set[tuple[str, str]] = set()

    for product in products:
        for rating in ratings:
            offset = 0
            while True:
                data = request_page(
                    session,
                    headers_template=headers_template,
                    payload_template=payload_template,
                    product=product,
                    rating=rating,
                    offset=offset,
                    timeout=args.timeout,
                )
                results = [item for item in data.get("results") or [] if isinstance(item, dict)]
                limit = safe_int(data.get("limit"), len(results) or 16)
                raw_pages.append(
                    {
                        "product_id": product["product_id"],
                        "productNameId": product["productNameId"],
                        "rating": rating,
                        "offset": offset,
                        "limit": limit,
                        "totalResults": safe_int(data.get("totalResults")),
                        "result_count": len(results),
                        "hasAdditionalReviews": bool(data.get("hasAdditionalReviews")),
                        "results": results,
                    }
                )

                kept = 0
                for review in results:
                    submitted_at = parse_submission_time(review.get("submissionTime"))
                    if not submitted_at or submitted_at < start_at or submitted_at > end_at:
                        continue
                    key = (product["product_id"], clean_text(review.get("id")))
                    if key in seen_review_keys:
                        continue
                    seen_review_keys.add(key)
                    rows.append(flatten_review(product, review))
                    kept += 1

                log(
                    f"{product['product_id']} rating={rating} offset={offset} "
                    f"fetched={len(results)} kept_in_window={kept}"
                )

                if not data.get("hasAdditionalReviews") or limit <= 0 or not results:
                    break
                offset += limit
                if args.delay > 0:
                    time.sleep(args.delay)

    rows.sort(
        key=lambda row: (
            row.get("submission_time", ""),
            row.get("product_id", ""),
            safe_int(row.get("rating")),
            row.get("review_id", ""),
        ),
        reverse=True,
    )

    csv_path = output_prefix.with_suffix(".csv")
    json_path = output_prefix.with_suffix(".json")
    raw_path = output_prefix.parent / f"{output_prefix.name}_raw_pages.json"
    write_csv_rows(csv_path, rows, REVIEW_FIELDNAMES)
    write_json(json_path, rows)
    write_json(
        raw_path,
        {
            "start_date": args.start_date,
            "end_date": args.end_date,
            "ratings": ratings,
            "review_count": len(rows),
            "raw_pages": raw_pages,
        },
    )
    log(f"Saved {len(rows)} filtered reviews to {csv_path}")
    log(f"Saved JSON copy to {json_path}")
    log(f"Saved raw page archive to {raw_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
