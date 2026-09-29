from __future__ import annotations

import pytest

import pipeline.pipeline_common as pipeline_common
from pipeline.multi_product_reviews_scraper import (
    existing_review_ids_by_product,
    merge_review_rows,
)
from pipeline.pipeline_common import fetch_reviews_page, flatten_review


PRODUCT = {
    "product_name": "Define Jacket Nulu",
    "product_id": "define_jacket_nulu",
    "productNameId": "Define_Jacket_Nulu",
    "product_url": "https://shop.lululemon.com/p/define-jacket-nulu/example",
    "category": "Jackets",
}


class FakeResponse:
    def __init__(self, payload, *, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


def test_fetch_reviews_page_uses_new_api_and_unwraps_attributes():
    session = FakeSession(
        FakeResponse(
            {
                "data": [
                    {
                        "id": "271989459",
                        "type": "reviews",
                        "attributes": {
                            "title": "Lululemon",
                            "reviewText": "I love it but it came with that on it",
                            "rating": 1,
                            "submissionTime": "2026-09-16T11:29:44.000+00:00",
                            "contributor": {
                                "nickName": None,
                                "isStaff": False,
                                "isVerifiedBuyer": False,
                            },
                            "fitInformation": {
                                "fits": "True to size",
                                "sizePurchased": "8",
                                "whatIsYourUsualSize": "8",
                            },
                            "comments": [],
                            "photos": [],
                        },
                    }
                ],
                "meta": {"totalCount": 12, "limit": 6, "offset": 0},
            }
        )
    )

    page = fetch_reviews_page(
        session,
        product=PRODUCT,
        offset=0,
        ratings=[1, 2, 3],
        timeout=10,
    )

    url, request = session.calls[0]
    assert url.endswith("/Define_Jacket_Nulu")
    assert request["params"]["page[limit]"] == 6
    assert request["params"]["page[offset]"] == 0
    assert request["params"]["filter[rating]"] == [1, 2, 3]
    assert request["headers"]["x-lll-client"] == "alpine-reviews-sdk"
    assert page["results"][0]["id"] == "271989459"
    assert page["results"][0]["reviewText"].startswith("I love it")
    assert page["totalResults"] == 12
    assert page["hasAdditionalReviews"] is True

    flattened = flatten_review(PRODUCT, page["results"][0])
    assert flattened["review_id"] == "271989459"
    assert flattened["size_purchased"] == "8"


def test_fetch_reviews_page_does_not_retry_bad_request():
    session = FakeSession(
        FakeResponse(
            {"message": "Bad Request"},
            status_code=400,
            text='{"message":"Bad Request"}',
        )
    )

    with pytest.raises(RuntimeError, match="Reviews API returned HTTP 400"):
        fetch_reviews_page(session, product=PRODUCT, offset=0)

    assert len(session.calls) == 1


def test_incremental_collection_stops_at_first_known_review(monkeypatch):
    page_calls = []

    def fake_fetch_page(session, **kwargs):
        page_calls.append(kwargs["offset"])
        return {
            "results": [
                {"id": "new-review", "rating": 3},
                {"id": "known-review", "rating": 2},
                {"id": "older-review", "rating": 1},
            ],
            "totalResults": 100,
            "hasAdditionalReviews": True,
            "limit": 6,
        }

    monkeypatch.setattr(pipeline_common, "fetch_reviews_page", fake_fetch_page)

    reviews, total = pipeline_common.fetch_all_reviews_for_product(
        object(),
        product=PRODUCT,
        ratings=[1, 2, 3],
        sort="SubmissionTime:desc",
        delay=0,
        stop_review_ids={"known-review"},
    )

    assert [row["id"] for row in reviews] == ["new-review"]
    assert total == 100
    assert page_calls == [0]


def test_existing_review_index_and_merge_keep_history_without_duplicates():
    existing = [
        {
            "product_id": "define_jacket_nulu",
            "review_id": "known-review",
            "review_text": "old value",
        }
    ]
    new = [
        {
            "product_id": "define_jacket_nulu",
            "review_id": "new-review",
            "review_text": "new review",
        },
        {
            "product_id": "define_jacket_nulu",
            "review_id": "known-review",
            "review_text": "updated value",
        },
    ]

    index = existing_review_ids_by_product(existing)
    merged = merge_review_rows(existing, new)
    rows_by_id = {row["review_id"]: row for row in merged}

    assert index == {"define_jacket_nulu": {"known-review"}}
    assert set(rows_by_id) == {"known-review", "new-review"}
    assert rows_by_id["known-review"]["review_text"] == "updated value"
