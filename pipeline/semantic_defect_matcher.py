from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from pipeline.config import get_config
from pipeline.pipeline_common import MASTER_DEFECT_CSV, clean_text, ensure_pipeline_dirs, log, read_csv_rows
from pipeline.storage.review_repository import ReviewRepository, build_analysis_key, normalize_text

DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_THRESHOLD = 0.22
UNCLASSIFIED = "Unclassified"

_model_cache: dict[str, Any] = {}
_category_cache: dict[Path, list["CategoryDocument"]] = {}
_embedding_cache: dict[tuple[str, str], np.ndarray] = {}


@dataclass(frozen=True)
class CategoryDocument:
    group_code: str
    group_desc: str
    knowledge_text: str


def get_model(model_name: str = DEFAULT_MODEL_NAME):
    if model_name not in _model_cache:
        from sentence_transformers import SentenceTransformer

        log(f"Loading semantic model '{model_name}' (cached after first download)...")
        _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]


def load_category_documents(path: Path = MASTER_DEFECT_CSV) -> list[CategoryDocument]:
    if path in _category_cache:
        return _category_cache[path]

    rows = read_csv_rows(path)
    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for row in rows:
        desc = clean_text(row.get("DEFECT_DESC_ENG"))
        group_desc = clean_text(row.get("GRP_DESC_ENG"))
        group_code = clean_text(row.get("DEFECT_GRP_CODE"))
        if not desc or not group_desc:
            continue
        if group_desc not in groups:
            groups[group_desc] = {"group_code": group_code, "descs": []}
            order.append(group_desc)
        groups[group_desc]["descs"].append(desc)

    if not groups:
        raise ValueError(f"No usable defect rows found in {path}")

    documents = [
        CategoryDocument(
            group_code=groups[group_desc]["group_code"],
            group_desc=group_desc,
            knowledge_text=f"{group_desc}: " + ". ".join(groups[group_desc]["descs"]),
        )
        for group_desc in order
    ]
    _category_cache[path] = documents
    return documents


def taxonomy_hash_for_documents(documents: list[CategoryDocument]) -> str:
    payload = [
        {
            "group_code": doc.group_code,
            "group_desc": doc.group_desc,
            "knowledge_text": doc.knowledge_text,
        }
        for doc in documents
    ]
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def get_taxonomy_hash(path: Path = MASTER_DEFECT_CSV) -> str:
    return taxonomy_hash_for_documents(load_category_documents(path))


def combine_review_text(row: dict[str, Any] | sqlite3.Row) -> str:
    title = clean_text(row.get("title") if isinstance(row, dict) else row["title"])
    body = clean_text(row.get("review_text") if isinstance(row, dict) else row["review_text"])
    return ". ".join(part for part in (title, body) if part)


def embed_texts(model, texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, model.get_sentence_embedding_dimension()))
    return model.encode(
        texts,
        batch_size=64,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )


def get_category_embeddings(
    *,
    model_name: str,
    taxonomy_hash: str,
    documents: list[CategoryDocument],
) -> np.ndarray:
    cache_key = (model_name, taxonomy_hash)
    if cache_key not in _embedding_cache:
        model = get_model(model_name)
        _embedding_cache[cache_key] = embed_texts(
            model,
            [document.knowledge_text for document in documents],
        )
    return _embedding_cache[cache_key]


def classify_match(
    *,
    best_score: float,
    best_category: CategoryDocument | None,
    threshold: float,
) -> dict[str, Any]:
    rounded_score = round(float(best_score), 4)

    if best_category is not None and best_score >= threshold:
        return {
            "matched_defect_code": "",
            "matched_defect_desc": "",
            "matched_defect_group_code": best_category.group_code,
            "matched_defect_group": best_category.group_desc,
            "similarity_score": rounded_score,
            "semantic_match_method": "sentence_transformer",
            "operation_related": True,
            "confidence_score": rounded_score,
        }

    return {
        "matched_defect_code": "",
        "matched_defect_desc": "",
        "matched_defect_group_code": "",
        "matched_defect_group": UNCLASSIFIED,
        "similarity_score": rounded_score,
        "semantic_match_method": "unclassified",
        "operation_related": False,
        "confidence_score": rounded_score,
    }


def match_reviews_to_defects(
    rows: list[dict[str, Any]],
    *,
    threshold: float = DEFAULT_THRESHOLD,
    model_name: str = DEFAULT_MODEL_NAME,
) -> list[dict[str, Any]]:
    if not rows:
        return []

    categories = load_category_documents()
    taxonomy_hash = taxonomy_hash_for_documents(categories)
    model = get_model(model_name)
    category_embeddings = get_category_embeddings(
        model_name=model_name,
        taxonomy_hash=taxonomy_hash,
        documents=categories,
    )
    review_texts = [combine_review_text(row) for row in rows]
    non_empty_indices = [index for index, text in enumerate(review_texts) if text]
    review_embeddings = embed_texts(model, [review_texts[index] for index in non_empty_indices])

    similarity_by_index: dict[int, np.ndarray] = {}
    if non_empty_indices and category_embeddings.shape[0]:
        similarity_matrix = np.matmul(review_embeddings, category_embeddings.T)
        for position, row_index in enumerate(non_empty_indices):
            similarity_by_index[row_index] = similarity_matrix[position]

    results: list[dict[str, Any]] = []
    for index, _row in enumerate(rows):
        scores = similarity_by_index.get(index)
        if scores is None:
            results.append(classify_match(best_score=0.0, best_category=None, threshold=threshold))
            continue

        best_index = int(np.argmax(scores))
        results.append(
            classify_match(
                best_score=float(scores[best_index]),
                best_category=categories[best_index],
                threshold=threshold,
            )
        )
    return results


def run() -> dict[str, int | str]:
    ensure_pipeline_dirs()
    config = get_config()
    repository = ReviewRepository(config.state_db_path)
    taxonomy_hash = get_taxonomy_hash()
    reviews, reused = repository.get_reviews_needing_semantic_analysis(
        max_rating=config.low_star_max_rating,
        classifier_version=config.classifier_version,
        embedding_model_name=config.ml_model_name,
        embedding_model_version=config.embedding_model_version,
        semantic_threshold=config.semantic_threshold,
        taxonomy_hash=taxonomy_hash,
    )
    if not reviews:
        return {
            "semantic_matches_performed": 0,
            "cached_analysis_reused": reused,
            "taxonomy_hash": taxonomy_hash,
        }

    rows = [
        {
            "title": row["title"],
            "review_text": row["review_text"],
        }
        for row in reviews
    ]
    matches = match_reviews_to_defects(
        rows,
        threshold=config.semantic_threshold,
        model_name=config.ml_model_name,
    )
    for review, match in zip(reviews, matches):
        analysis_key = build_analysis_key(
            product_id=str(review["product_id"]),
            review_id=str(review["review_id"]),
            review_content_hash=str(review["content_hash"]),
            classifier_version=config.classifier_version,
            embedding_model_name=config.ml_model_name,
            embedding_model_version=config.embedding_model_version,
            semantic_threshold=config.semantic_threshold,
            taxonomy_hash=taxonomy_hash,
        )
        existing = repository.get_current_analysis(
            product_id=str(review["product_id"]),
            review_id=str(review["review_id"]),
            review_content_hash=str(review["content_hash"]),
            classifier_version=config.classifier_version,
            embedding_model_name=config.ml_model_name,
            embedding_model_version=config.embedding_model_version,
            semantic_threshold=config.semantic_threshold,
            taxonomy_hash=taxonomy_hash,
        )
        complaint_theme = normalize_text(existing["complaint_theme"]) if existing else ""
        business_insight = normalize_text(existing["business_insight"]) if existing else ""
        repository.upsert_review_analysis(
            {
                "analysis_key": analysis_key,
                "product_id": review["product_id"],
                "review_id": review["review_id"],
                "review_content_hash": review["content_hash"],
                "complaint_theme": complaint_theme,
                "business_insight": business_insight,
                "matched_defect_group": match["matched_defect_group"],
                "matched_defect_group_code": match["matched_defect_group_code"],
                "matched_defect_code": match["matched_defect_code"],
                "matched_defect_desc": match["matched_defect_desc"],
                "similarity_score": match["similarity_score"],
                "confidence_score": match["confidence_score"],
                "semantic_match_method": match["semantic_match_method"],
                "operation_related": int(bool(match["operation_related"])),
                "classifier_version": config.classifier_version,
                "embedding_model_name": config.ml_model_name,
                "embedding_model_version": config.embedding_model_version,
                "semantic_threshold": config.semantic_threshold,
                "taxonomy_version": config.taxonomy_version,
                "taxonomy_hash": taxonomy_hash,
                "analysis_status": "complete",
                "analysis_error": "",
            }
        )

    return {
        "semantic_matches_performed": len(matches),
        "cached_analysis_reused": reused,
        "taxonomy_hash": taxonomy_hash,
    }


def main() -> int:
    run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
