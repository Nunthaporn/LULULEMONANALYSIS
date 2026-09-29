from __future__ import annotations

import csv
import json
import os
import re
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlsplit

import requests


PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
DATA_DIR = ROOT_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
RAW_DIR = DATA_DIR / "raw"
RAW_JSON_DIR = RAW_DIR / "product_raw_json"
PROCESSED_DIR = DATA_DIR / "processed"
DASHBOARD_DATA_DIR = PROCESSED_DIR / "dashboard_data"
IMAGES_DIR = DATA_DIR / "images"
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
PUBLIC_DASHBOARD_DATA_DIR = PUBLIC_DATA_DIR / "dashboard_data"

MASTER_DEFECT_CSV = DATA_DIR / "master_defect.csv"

PRODUCTS_CSV = INPUT_DIR / "products.csv"
ALL_REVIEWS_CSV = PROCESSED_DIR / "all_reviews.csv"
ALL_REVIEWS_JSON = PROCESSED_DIR / "all_reviews.json"
LOW_STAR_REVIEWS_CSV = PROCESSED_DIR / "low_star_reviews.csv"
PRODUCT_RATING_DISTRIBUTION_CSV = PROCESSED_DIR / "product_rating_distribution.csv"
REVIEW_IMAGES_MAPPING_CSV = PROCESSED_DIR / "review_images_mapping.csv"
CATEGORY_SUMMARY_CSV = PROCESSED_DIR / "category_summary.csv"
PRODUCT_SUMMARY_CSV = PROCESSED_DIR / "product_summary.csv"
SCRAPE_FAILURES_CSV = PROCESSED_DIR / "scrape_failures.csv"

GRAPHQL_ENDPOINT = "https://shop.lululemon.com/cne/graphql"
DEFAULT_LOCALE = "en_US,en_CA"
DEFAULT_SORT = "Rating:asc"
DEFAULT_RECENT_SORT = "SubmissionTime:desc"
DEFAULT_DELAY_SECONDS = 0.35
DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_MAX_ATTEMPTS = 5
REVIEWS_API_ENDPOINT = "https://shop.lululemon.com/.uf-svc/v1/reviews/products/{product_name_id}"
DEFAULT_PAGE_LIMIT = 6
DEFAULT_COMMENTS_PER_REVIEW = 16
LOW_STAR_RATINGS = {1, 2, 3}

QUERY = """
query GetReviews(
  $locale: String!,
  $productNameId: String!,
  $search: String,
  $offset: Int,
  $rating: [Int],
  $filters: [String],
  $sort: String
) {
  getReviews(
    locale: $locale,
    productNameId: $productNameId,
    search: $search,
    offset: $offset,
    rating: $rating,
    filters: $filters,
    sort: $sort
  ) {
    results {
      title
      reviewText
      rating
      badge
      id
      likes
      incentivizedReviewLabel
      submissionTime
      totalComments
      contributor {
        isStaff
        isVerifiedBuyer
        nickName
      }
      fitInformation {
        fits
        height
        sizePurchased
        weight
        whatIsYourUsualSize
      }
      luluResponse {
        nickName
        responseText
        submissionTime
      }
      comments {
        id
        text
        likes
        submissionTime
        reviewId
        contributor {
          isStaff
          nickName
        }
      }
      photos {
        caption
        thumbnail
        id
        url
      }
    }
    totalResults
    errors {
      message
      code
    }
    hasAdditionalReviews
    hasErrors
    limit
    offset
    stats {
      averageOverallRating
      features {
        averageRating
        featureId
      }
      fitsRating {
        range
        label
        rating
      }
      ratingDistribution {
        numberOfResults
        ratingValue
      }
      totalReviewCount
    }
  }
}
""".strip()

REVIEW_FIELDNAMES = [
    "product_name",
    "product_id",
    "productNameId",
    "product_url",
    "category",
    "review_id",
    "rating",
    "title",
    "review_text",
    "submission_time",
    "author",
    "is_staff",
    "is_verified_buyer",
    "badge",
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
]

IMAGE_MAPPING_FIELDNAMES = [
    "product_name",
    "product_id",
    "productNameId",
    "product_url",
    "category",
    "review_id",
    "rating",
    "review_date",
    "review_title",
    "review_text",
    "complaint_theme",
    "business_insight",
    "photo_id",
    "photo_number",
    "image_url",
    "local_image_path",
    "verified_buyer",
    "helpful_votes",
    "size_purchased",
    "fit_feedback",
]

PRODUCT_SUMMARY_FIELDNAMES = [
    "product_name",
    "product_id",
    "productNameId",
    "category",
    "total_reviews",
    "low_star_reviews",
    "one_star_reviews",
    "two_star_reviews",
    "three_star_reviews",
    "reviews_with_images",
    "total_images",
    "average_rating",
    "top_complaint_theme",
    "top_complaint_share",
]

CATEGORY_SUMMARY_FIELDNAMES = [
    "product_name",
    "product_id",
    "productNameId",
    "category",
    "complaint_theme",
    "total_reviews",
    "one_star",
    "two_star",
    "three_star",
    "share_percentage",
]

COMPLAINT_THEMES = [
    "Fabric & Material Quality",
    "Shipping & Delivery",
    "Customer Service",
    "Sizing & Fit",
    "Color & Product Description",
    "Pricing & Value",
    "Zipper Issues",
    "Stitching & Construction",
    "Product Cleanliness",
    "Design & Features",
    "Other",
]

THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Fabric & Material Quality": (
        "fabric",
        "material",
        "quality",
        "pill",
        "pilling",
        "thin",
        "cheap",
        "durable",
        "durability",
        "soft",
        "scratchy",
        "itchy",
        "see through",
        "sheer",
        "lint",
        "fuzzy",
        "wore out",
        "worn out",
        "nulu",
    ),
    "Shipping & Delivery": (
        "shipping",
        "delivery",
        "arrived late",
        "arrive late",
        "package",
        "packaging",
        "mail",
        "courier",
        "damaged box",
        "lost package",
        "wrong item",
        "delay",
        "tracking",
        "express shipping",
    ),
    "Customer Service": (
        "customer service",
        "service",
        "manager",
        "staff",
        "store",
        "support",
        "refund",
        "return",
        "exchange",
        "rude",
        "unhelpful",
        "shopping experience",
        "guest education centre",
        "gec",
    ),
    "Sizing & Fit": (
        "size",
        "sizing",
        "fit",
        "runs small",
        "runs large",
        "too tight",
        "too loose",
        "tight in",
        "loose in",
        "true to size",
        "shoulders",
        "sleeves",
        "arms",
        "chest",
        "cropped",
        "xl",
        "xs",
    ),
    "Color & Product Description": (
        "color",
        "colour",
        "pictured",
        "picture",
        "photo",
        "photos",
        "description",
        "described",
        "looked different",
        "shade",
        "website",
        "online image",
        "pink",
        "purple",
        "lilac",
        "mauve",
    ),
    "Pricing & Value": (
        "price",
        "expensive",
        "overpriced",
        "worth",
        "value",
        "premium",
        "for the price",
        "not worth",
        "waste of money",
        "130 dollars",
        "$",
    ),
    "Zipper Issues": (
        "zipper",
        "zip",
        "unzipped",
        "zip up",
        "zip-down",
        "zippered",
        "zip broke",
    ),
    "Stitching & Construction": (
        "stitch",
        "stitching",
        "seam",
        "seams",
        "thread",
        "fray",
        "frayed",
        "construction",
        "hem",
        "fell apart",
        "ripped",
        "hole",
        "snag",
    ),
    "Product Cleanliness": (
        "dirty",
        "filthy",
        "stain",
        "stained",
        "smell",
        "odor",
        "odour",
        "dust",
        "used",
        "worn",
        "mark",
        "gross",
        "unclean",
        "water stain",
    ),
    "Design & Features": (
        "design",
        "feature",
        "features",
        "style",
        "pocket",
        "pockets",
        "hood",
        "cropped",
        "length",
        "shorten",
        "alteration",
        "alter",
        "old version",
        "new version",
        "changed",
        "bring back",
        "thumb hole",
        "sleeve",
        "sleeves",
    ),
}

BUSINESS_INSIGHTS = {
    "Fabric & Material Quality": "Product material or durability concern affecting premium brand trust.",
    "Shipping & Delivery": "Post-purchase delivery problem affecting customer experience.",
    "Customer Service": "Support or resolution issue affecting trust and loyalty.",
    "Sizing & Fit": "Fit expectation mismatch that may increase return risk.",
    "Color & Product Description": "Mismatch between expectation and product presentation may reduce purchase confidence.",
    "Pricing & Value": "Customer does not believe the product justifies its premium price.",
    "Zipper Issues": "Functional closure failure suggests a product reliability risk.",
    "Stitching & Construction": "Construction quality issue may undermine perceived craftsmanship.",
    "Product Cleanliness": "Fulfillment or inspection quality-control issue.",
    "Design & Features": "Design choice or feature limitation may be frustrating customers.",
    "Other": "Review content requires manual inspection for a clearer root cause.",
}


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def ensure_pipeline_dirs() -> None:
    for folder in (
        INPUT_DIR,
        RAW_JSON_DIR,
        PROCESSED_DIR,
        DASHBOARD_DATA_DIR,
        PUBLIC_DASHBOARD_DATA_DIR,
        IMAGES_DIR,
    ):
        folder.mkdir(parents=True, exist_ok=True)


def current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = value if isinstance(value, str) else str(value)
    return re.sub(r"\s+", " ", text).strip()


def safe_int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    match = re.search(r"-?\d+", str(value))
    return int(match.group()) if match else default


def safe_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"-?\d+(?:\.\d+)?", str(value))
    return float(match.group()) if match else default


def normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return int(value) == 1
    return str(value).strip().lower() in {"true", "1", "yes", "y", "verified"}


def split_serialized_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [clean_text(item) for item in value if clean_text(item)]
    text = clean_text(value)
    if not text:
        return []
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                return [clean_text(item) for item in parsed if clean_text(item)]
        except json.JSONDecodeError:
            pass
    return [part.strip() for part in re.split(r"\s*;\s*", text) if part.strip()]


def serialize_list(values: list[str]) -> str:
    return " ; ".join(clean_text(item) for item in values if clean_text(item))


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def write_csv_rows(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    from io import StringIO

    from pipeline.storage.atomic_exporter import atomic_write_text

    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(path, buffer.getvalue(), encoding="utf-8-sig")


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    from pipeline.storage.atomic_exporter import atomic_write_json

    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(path, payload)


def read_products(path: Path = PRODUCTS_CSV) -> list[dict[str, str]]:
    rows = read_csv_rows(path)
    products: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        product_name = clean_text(row.get("product_name"))
        product_id = clean_text(row.get("product_id"))
        product_name_id = clean_text(row.get("productNameId"))
        product_url = clean_text(row.get("product_url"))
        category = clean_text(row.get("category"))
        if not all((product_name, product_id, product_name_id, product_url, category)):
            raise ValueError(
                f"products.csv row {index} is missing one of: product_name, product_id, productNameId, product_url, category"
            )
        products.append(
            {
                "product_name": product_name,
                "product_id": product_id,
                "productNameId": product_name_id,
                "product_url": product_url,
                "category": category,
            }
        )
    return products


def build_headers(product_url: str) -> dict[str, str]:
    headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://shop.lululemon.com",
        "referer": product_url,
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0"
        ),
        "priority": "u=1, i",
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Microsoft Edge";v="150"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-lll-client": "pdp-reviews-component",
        "x-lll-client-repo-name": "product-experiences",
        "x-lll-locale": "en-US",
        "x-lll-referrer": "Channel=Web,Page=pdp",
    }
    cookie = os.getenv("LULULEMON_COOKIE", "").strip()
    if cookie:
        headers["cookie"] = cookie
    return headers


def build_session() -> requests.Session:
    return requests.Session()


def build_reviews_api_headers(product_url: str) -> dict[str, str]:
    headers = build_headers(product_url)
    headers.pop('content-type', None)
    headers['x-lll-client'] = 'alpine-reviews-sdk'
    headers['x-lll-locale'] = 'en-us'
    return headers


def build_reviews_api_params(
    *,
    offset: int,
    ratings: list[int] | None = None,
    locale: str = DEFAULT_LOCALE,
    sort: str = DEFAULT_SORT,
    limit: int = DEFAULT_PAGE_LIMIT,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        'page[limit]': limit,
        'page[offset]': offset,
        'filter[contentLocale]': locale,
        'commentsPerReview': DEFAULT_COMMENTS_PER_REVIEW,
        'sort': sort,
    }
    if ratings:
        params['filter[rating]'] = ratings[0] if len(ratings) == 1 else ratings
    return params


def unwrap_reviews_api_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get('data')
    if not isinstance(items, list):
        raise ValueError('Response did not include a data array.')

    reviews: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        attributes = item.get('attributes')
        if not isinstance(attributes, dict):
            continue
        reviews.append({**attributes, 'id': clean_text(item.get('id'))})
    return reviews


def _reviews_api_pagination(
    payload: dict[str, Any],
    *,
    offset: int,
    result_count: int,
    requested_limit: int,
) -> tuple[int, int, bool]:
    meta = payload.get('meta') if isinstance(payload.get('meta'), dict) else {}
    pagination = (
        meta.get('pagination')
        if isinstance(meta.get('pagination'), dict)
        else meta.get('page')
        if isinstance(meta.get('page'), dict)
        else {}
    )

    total_results = safe_int(
        payload.get('totalResults')
        or meta.get('totalResults')
        or meta.get('totalCount')
        or meta.get('total')
        or pagination.get('total')
        or pagination.get('totalResults')
    )
    limit = safe_int(
        pagination.get('limit') or meta.get('limit'),
        requested_limit,
    )
    if limit <= 0:
        limit = requested_limit

    links = payload.get('links') if isinstance(payload.get('links'), dict) else {}
    if 'next' in links:
        has_more = bool(links.get('next'))
    elif total_results > 0:
        has_more = offset + result_count < total_results
    else:
        has_more = result_count >= limit
    return total_results, limit, has_more


def build_payload(
    *,
    product_name_id: str,
    offset: int,
    ratings: list[int] | None = None,
    locale: str = DEFAULT_LOCALE,
    sort: str = DEFAULT_SORT,
) -> dict[str, Any]:
    return {
        "operationName": "GetReviews",
        "query": QUERY,
        "variables": {
            "locale": locale,
            "productNameId": product_name_id,
            "offset": offset,
            "search": "",
            "rating": ratings or [],
            "filters": [],
            "sort": sort,
        },
    }


def serialize_graphql_payload(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    return serialized.replace("String!", "String\\u0021")


def fetch_reviews_page(
    session: requests.Session,
    *,
    product: dict[str, str],
    offset: int,
    ratings: list[int] | None = None,
    locale: str = DEFAULT_LOCALE,
    sort: str = DEFAULT_SORT,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    endpoint = REVIEWS_API_ENDPOINT.format(
        product_name_id=quote(product["productNameId"], safe="_-"),
    )
    limit = DEFAULT_PAGE_LIMIT
    params = build_reviews_api_params(
        offset=offset,
        ratings=ratings,
        locale=locale,
        sort=sort,
        limit=limit,
    )
    headers = build_reviews_api_headers(product["product_url"])
    headers["x-lll-ecom-correlation-id"] = str(uuid.uuid4()).upper()
    headers["x-lll-request-correlation-id"] = str(uuid.uuid4())

    for attempt in range(1, DEFAULT_MAX_ATTEMPTS + 1):
        try:
            response = session.get(
                endpoint,
                headers=headers,
                params=params,
                timeout=timeout,
            )
            if response.status_code in {400, 401, 403, 404}:
                diagnostic = clean_text(response.text)[:500]
                raise RuntimeError(
                    f"Reviews API returned HTTP {response.status_code}: {diagnostic or 'empty response'}"
                )
            response.raise_for_status()
            response_payload = response.json()
            if not isinstance(response_payload, dict):
                raise ValueError("Reviews API response was not a JSON object.")

            results = unwrap_reviews_api_response(response_payload)
            total_results, response_limit, has_more = _reviews_api_pagination(
                response_payload,
                offset=offset,
                result_count=len(results),
                requested_limit=limit,
            )
            return {
                "results": results,
                "totalResults": total_results,
                "hasAdditionalReviews": has_more,
                "limit": response_limit,
                "offset": offset,
            }
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            if isinstance(exc, RuntimeError) and "Reviews API returned HTTP" in str(exc):
                raise RuntimeError(
                    f"{product['product_id']} request failed at offset {offset}: {exc}"
                ) from exc
            if attempt == DEFAULT_MAX_ATTEMPTS:
                raise RuntimeError(
                    f"{product['product_id']} request failed at offset {offset}: {exc}"
                ) from exc
            backoff = min(2 ** (attempt - 1), 10)
            log(
                f"{product['product_id']} offset={offset} attempt={attempt} failed: {exc}. "
                f"Retrying in {backoff}s."
            )
            time.sleep(backoff)

    raise RuntimeError(f"{product['product_id']} request failed at offset {offset}.")


def review_key(review: dict[str, Any]) -> str:
    review_id = clean_text(review.get("id"))
    if review_id:
        return review_id
    return json.dumps(review, sort_keys=True, ensure_ascii=True, default=str)


def fetch_all_reviews_for_product(
    session: requests.Session,
    *,
    product: dict[str, str],
    ratings: list[int] | None = None,
    locale: str = DEFAULT_LOCALE,
    sort: str = DEFAULT_SORT,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    delay: float = DEFAULT_DELAY_SECONDS,
    stop_review_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    all_reviews: list[dict[str, Any]] = []
    seen: set[str] = set()
    offset = 0
    total_results = 0
    known_ids = stop_review_ids or set()

    while True:
        page = fetch_reviews_page(
            session,
            product=product,
            offset=offset,
            ratings=ratings,
            locale=locale,
            sort=sort,
            timeout=timeout,
        )
        if not total_results:
            total_results = safe_int(page.get("totalResults"))
            log(f"{product['product_id']}: API reports {total_results} total reviews.")

        results = page.get("results") or []
        if not results:
            log(f"{product['product_id']}: no results at offset {offset}; stopping.")
            break

        new_count = 0
        reached_known_review = False
        for review in results:
            if not isinstance(review, dict):
                continue
            key = review_key(review)
            if key in known_ids:
                reached_known_review = True
                log(
                    f"{product['product_id']}: reached existing review {key} "
                    f"at offset {offset}; stopping incremental collection."
                )
                break
            if key in seen:
                continue
            seen.add(key)
            all_reviews.append(review)
            new_count += 1

        limit = safe_int(page.get("limit"), len(results) or 16)
        log(
            f"{product['product_id']}: offset={offset} fetched={len(results)} new={new_count} "
            f"collected={len(all_reviews)}/{total_results or '?'}"
        )

        if not page.get("hasAdditionalReviews"):
            break
        if reached_known_review:
            break
        if new_count == 0:
            log(f"{product['product_id']}: duplicate-only page at offset {offset}; stopping.")
            break

        offset += limit
        if delay > 0:
            time.sleep(delay)

    return all_reviews, total_results


def flatten_review(product: dict[str, str], review: dict[str, Any]) -> dict[str, Any]:
    contributor = review.get("contributor") or {}
    fit_information = review.get("fitInformation") or {}
    lulu_response = review.get("luluResponse") or {}
    comments = review.get("comments") or []
    photos = review.get("photos") or []

    photo_ids = [clean_text(item.get("id")) for item in photos if isinstance(item, dict)]
    photo_urls = [clean_text(item.get("url")) for item in photos if isinstance(item, dict)]
    photo_thumbnails = [
        clean_text(item.get("thumbnail")) for item in photos if isinstance(item, dict)
    ]
    photo_captions = [clean_text(item.get("caption")) for item in photos if isinstance(item, dict)]

    complaint_theme = classify_complaint_theme(
        clean_text(review.get("title")),
        clean_text(review.get("reviewText")),
        clean_text(fit_information.get("fits")),
    )

    return {
        "product_name": product["product_name"],
        "product_id": product["product_id"],
        "productNameId": product["productNameId"],
        "product_url": product["product_url"],
        "category": product["category"],
        "review_id": clean_text(review.get("id")),
        "rating": safe_int(review.get("rating")),
        "title": clean_text(review.get("title")),
        "review_text": clean_text(review.get("reviewText")),
        "submission_time": clean_text(review.get("submissionTime")),
        "author": clean_text(contributor.get("nickName")),
        "is_staff": normalize_bool(contributor.get("isStaff")),
        "is_verified_buyer": normalize_bool(contributor.get("isVerifiedBuyer")),
        "badge": clean_text(review.get("badge")),
        "likes": safe_int(review.get("likes")),
        "incentivized_review_label": clean_text(review.get("incentivizedReviewLabel")),
        "fit_feedback": clean_text(fit_information.get("fits")),
        "height": clean_text(fit_information.get("height")),
        "weight": clean_text(fit_information.get("weight")),
        "size_purchased": clean_text(fit_information.get("sizePurchased")),
        "usual_size": clean_text(fit_information.get("whatIsYourUsualSize")),
        "total_comments": safe_int(review.get("totalComments")),
        "comments_json": json.dumps(comments, ensure_ascii=False),
        "lulu_response_author": clean_text(lulu_response.get("nickName")),
        "lulu_response_text": clean_text(lulu_response.get("responseText")),
        "lulu_response_time": clean_text(lulu_response.get("submissionTime")),
        "photo_count": len(photo_urls),
        "photo_ids": serialize_list(photo_ids),
        "photo_urls": serialize_list(photo_urls),
        "photo_thumbnails": serialize_list(photo_thumbnails),
        "photo_captions": serialize_list(photo_captions),
        "complaint_theme": complaint_theme,
        "business_insight": business_insight_for_theme(complaint_theme),
        "scraped_at": current_timestamp(),
    }


def classify_complaint_theme(review_title: str, review_text: str, fit_feedback: str = "") -> str:
    corpus = " ".join((review_title, review_text, fit_feedback)).lower().strip()
    if not corpus:
        return "Other"

    scores: dict[str, int] = {}
    for theme, keywords in THEME_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in corpus)
        if hits:
            scores[theme] = hits

    if not scores:
        return "Other"

    max_score = max(scores.values())
    for theme in COMPLAINT_THEMES:
        if scores.get(theme) == max_score:
            return theme
    return "Other"


def business_insight_for_theme(theme: str) -> str:
    return BUSINESS_INSIGHTS.get(theme, BUSINESS_INSIGHTS["Other"])


def theme_share(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((count / total) * 100, 1)


def top_theme(rows: list[dict[str, Any]]) -> tuple[str, int]:
    counts = Counter(clean_text(row.get("complaint_theme")) or "Other" for row in rows)
    theme, count = counts.most_common(1)[0] if counts else ("Other", 0)
    return theme, count


def raw_json_path_for_product(product_id: str) -> Path:
    return RAW_JSON_DIR / f"{product_id}.json"


def image_folder_for(product_id: str, rating: int) -> Path:
    return IMAGES_DIR / product_id / f"{rating}_star"


def infer_file_extension(image_url: str) -> str:
    suffix = Path(urlsplit(image_url).path).suffix
    return suffix if suffix and len(suffix) <= 5 else ".jpg"


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", clean_text(value)).strip("._")
    return cleaned or "item"
