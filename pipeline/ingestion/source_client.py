from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import requests

from pipeline.config import get_config
from pipeline.ingestion.retry_policy import (
    NonRetryableSourceError,
    RetryPolicy,
    build_retry_policy,
    redact_sensitive_text,
)
from pipeline.pipeline_common import (
    DEFAULT_LOCALE,
    DEFAULT_SORT,
    GRAPHQL_ENDPOINT,
    QUERY,
    build_headers,
    clean_text,
    current_timestamp,
    normalize_bool,
    safe_int,
    serialize_graphql_payload,
    serialize_list,
)


@dataclass(frozen=True)
class NormalizedPage:
    page_number: int
    offset: int
    limit: int
    total_results: int
    has_additional_reviews: bool
    normalized_reviews: list[dict[str, Any]]
    duplicate_count: int
    invalid_count: int
    raw_payload: dict[str, Any]
    source_metadata: dict[str, Any]


class ReviewSourceClient:
    source_name = "base"

    def fetch_page(self, *args, **kwargs) -> NormalizedPage:
        raise NotImplementedError

    def iter_pages(self, *args, **kwargs) -> Iterable[NormalizedPage]:
        raise NotImplementedError

    def validate_response_schema(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def normalize_review(self, product: dict[str, str], review: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def get_source_metadata(self) -> dict[str, Any]:
        raise NotImplementedError


class LululemonGraphQLReviewSourceClient(ReviewSourceClient):
    source_name = "lululemon_graphql"

    def __init__(
        self,
        *,
        session: requests.Session | None = None,
        retry_policy: RetryPolicy | None = None,
        locale: str = DEFAULT_LOCALE,
        sort: str = DEFAULT_SORT,
        timeout: int | None = None,
        endpoint: str = GRAPHQL_ENDPOINT,
    ) -> None:
        self.session = session or requests.Session()
        self.retry_policy = retry_policy or build_retry_policy()
        self.locale = locale
        self.sort = sort
        self.timeout = timeout or get_config().request_timeout_seconds
        self.endpoint = endpoint

    def get_source_metadata(self) -> dict[str, Any]:
        return {
            "source_adapter": self.source_name,
            "endpoint": self.endpoint,
            "locale": self.locale,
            "sort": self.sort,
        }

    def build_payload(self, *, product_name_id: str, offset: int) -> dict[str, Any]:
        return {
            "operationName": "GetReviews",
            "query": QUERY,
            "variables": {
                "locale": self.locale,
                "productNameId": product_name_id,
                "offset": offset,
                "search": "",
                "rating": [],
                "filters": [],
                "sort": self.sort,
            },
        }

    def build_request_headers(self, product: dict[str, str]) -> dict[str, str]:
        headers = build_headers(product["product_url"])
        headers["x-lll-ecom-correlation-id"] = str(uuid.uuid4()).upper()
        headers["x-lll-request-correlation-id"] = str(uuid.uuid4())
        return headers

    def validate_response_schema(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("errors"):
            raise NonRetryableSourceError(
                "Response contained top-level GraphQL errors.",
                error_type="schema_mismatch",
                diagnostic_sample=redact_sensitive_text(
                    json.dumps(payload.get("errors"), ensure_ascii=True)
                ),
            )

        data = payload.get("data", {}).get("getReviews")
        if not isinstance(data, dict):
            raise NonRetryableSourceError(
                "Response did not include data.getReviews.",
                error_type="schema_mismatch",
                diagnostic_sample=redact_sensitive_text(
                    json.dumps(payload, ensure_ascii=True)[:500]
                ),
            )

        if data.get("hasErrors") and data.get("errors"):
            raise NonRetryableSourceError(
                "Response indicated source-level review errors.",
                error_type="schema_mismatch",
                diagnostic_sample=redact_sensitive_text(
                    json.dumps(data.get("errors"), ensure_ascii=True)
                ),
            )

        required_keys = {"results", "totalResults", "hasAdditionalReviews"}
        if not required_keys.issubset(data.keys()):
            raise NonRetryableSourceError(
                "Response schema is missing required review fields.",
                error_type="schema_mismatch",
                diagnostic_sample=redact_sensitive_text(
                    json.dumps({key: data.get(key) for key in sorted(data.keys())}, ensure_ascii=True)[:500]
                ),
            )
        return data

    def _parse_response_body(self, response: requests.Response) -> dict[str, Any]:
        try:
            return response.json()
        except ValueError as exc:
            raise NonRetryableSourceError(
                "Response body was not valid JSON.",
                error_type="schema_mismatch",
                diagnostic_sample=redact_sensitive_text(response.text[:500]),
            ) from exc

    def fetch_page(
        self,
        *,
        product: dict[str, str],
        offset: int,
        page_number: int,
    ) -> NormalizedPage:
        payload = self.build_payload(product_name_id=product["productNameId"], offset=offset)
        headers = self.build_request_headers(product)
        body = serialize_graphql_payload(payload)

        response = self.retry_policy.execute(
            lambda _attempt: self.session.post(
                self.endpoint,
                headers=headers,
                data=body,
                timeout=max(self.timeout, 1),
            )
        )
        body = self._parse_response_body(response)
        data = self.validate_response_schema(body)

        seen_page_keys: set[str] = set()
        normalized_reviews: list[dict[str, Any]] = []
        duplicate_count = 0
        invalid_count = 0

        for item in data.get("results") or []:
            if not isinstance(item, dict):
                invalid_count += 1
                continue
            review_id = clean_text(item.get("id"))
            page_key = review_id or json.dumps(item, sort_keys=True, ensure_ascii=True, default=str)
            if page_key in seen_page_keys:
                duplicate_count += 1
                continue
            seen_page_keys.add(page_key)
            normalized = self.normalize_review(product, item)
            if not normalized:
                invalid_count += 1
                continue
            normalized_reviews.append(normalized)

        limit = safe_int(data.get("limit"), len(normalized_reviews) or 16)
        total_results = safe_int(data.get("totalResults"))
        return NormalizedPage(
            page_number=page_number,
            offset=offset,
            limit=limit,
            total_results=total_results,
            has_additional_reviews=bool(data.get("hasAdditionalReviews")),
            normalized_reviews=normalized_reviews,
            duplicate_count=duplicate_count,
            invalid_count=invalid_count,
            raw_payload=body,
            source_metadata={
                **self.get_source_metadata(),
                "product_id": product["product_id"],
                "product_name_id": product["productNameId"],
                "offset": offset,
            },
        )

    def iter_pages(
        self,
        *,
        product: dict[str, str],
        max_pages: int,
        max_reviews: int,
    ) -> Iterable[NormalizedPage]:
        offset = 0
        page_number = 0
        reviews_seen = 0

        while page_number < max_pages and reviews_seen < max_reviews:
            page = self.fetch_page(product=product, offset=offset, page_number=page_number)
            yield page
            page_number += 1
            reviews_seen += len(page.normalized_reviews)

            if not page.has_additional_reviews:
                break
            if page.limit <= 0:
                break
            offset += page.limit

    def normalize_review(self, product: dict[str, str], review: dict[str, Any]) -> dict[str, Any]:
        contributor = review.get("contributor") or {}
        fit_information = review.get("fitInformation") or {}
        lulu_response = review.get("luluResponse") or {}
        comments = review.get("comments") or []
        photos = review.get("photos") or []

        photo_ids = [clean_text(item.get("id")) for item in photos if isinstance(item, dict)]
        photo_urls = [clean_text(item.get("url")) for item in photos if isinstance(item, dict)]
        photo_thumbnails = [
            clean_text(item.get("thumbnail"))
            for item in photos
            if isinstance(item, dict)
        ]
        photo_captions = [
            clean_text(item.get("caption"))
            for item in photos
            if isinstance(item, dict)
        ]

        normalized = {
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
            "complaint_theme": "",
            "business_insight": "",
            "matched_defect_code": "",
            "matched_defect_desc": "",
            "matched_defect_group_code": "",
            "matched_defect_group": "",
            "similarity_score": 0.0,
            "semantic_match_method": "",
            "operation_related": False,
            "confidence_score": 0.0,
            "scraped_at": current_timestamp(),
            "source_updated_at": clean_text(lulu_response.get("submissionTime")),
        }
        self.validate_normalized_review(normalized)
        return normalized

    def validate_normalized_review(self, review: dict[str, Any]) -> None:
        if not clean_text(review.get("product_id")):
            raise ValueError("product_id missing from normalized review")
        if not clean_text(review.get("review_id")):
            raise ValueError("review_id missing from normalized review")
        rating = safe_int(review.get("rating"))
        if rating < 1 or rating > 5:
            raise ValueError(f"rating out of range: {rating}")
        submission_time = clean_text(review.get("submission_time"))
        if submission_time:
            from datetime import datetime

            try:
                datetime.fromisoformat(submission_time.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError("submission_time was not parseable") from exc
        for image_url in (review.get("photo_urls") or "").split(" ; "):
            if image_url and not image_url.startswith("http"):
                raise ValueError("photo url was not a valid http(s) URL")
