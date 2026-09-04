from __future__ import annotations

from pipeline.config import get_config
from pipeline.pipeline_common import (
    business_insight_for_theme,
    classify_complaint_theme,
    ensure_pipeline_dirs,
)
from pipeline.semantic_defect_matcher import get_taxonomy_hash
from pipeline.storage.review_repository import ReviewRepository, build_analysis_key, normalize_text


def run() -> dict[str, int]:
    ensure_pipeline_dirs()
    config = get_config()
    repository = ReviewRepository(config.state_db_path)
    taxonomy_hash = get_taxonomy_hash()
    reviews, reused = repository.get_reviews_needing_complaint_analysis(
        max_rating=config.low_star_max_rating,
        classifier_version=config.classifier_version,
        current_embedding_model_name=config.ml_model_name,
        current_embedding_model_version=config.embedding_model_version,
        current_semantic_threshold=config.semantic_threshold,
        current_taxonomy_hash=taxonomy_hash,
    )

    performed = 0
    reused_from_prior_config = 0
    for review in reviews:
        reusable = repository.find_reusable_complaint_analysis(
            product_id=str(review["product_id"]),
            review_id=str(review["review_id"]),
            review_content_hash=str(review["content_hash"]),
            classifier_version=config.classifier_version,
        )
        if reusable is not None:
            theme = normalize_text(reusable["complaint_theme"])
            insight = normalize_text(reusable["business_insight"])
            reused_from_prior_config += 1
        else:
            theme = classify_complaint_theme(
                str(review["title"] or ""),
                str(review["review_text"] or ""),
                str(review["fit_feedback"] or ""),
            )
            insight = business_insight_for_theme(theme)
            performed += 1

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
        repository.upsert_review_analysis(
            {
                "analysis_key": analysis_key,
                "product_id": review["product_id"],
                "review_id": review["review_id"],
                "review_content_hash": review["content_hash"],
                "complaint_theme": theme,
                "business_insight": insight,
                "matched_defect_group": "",
                "matched_defect_group_code": "",
                "matched_defect_code": "",
                "matched_defect_desc": "",
                "similarity_score": 0.0,
                "confidence_score": 0.0,
                "semantic_match_method": "",
                "operation_related": 0,
                "classifier_version": config.classifier_version,
                "embedding_model_name": config.ml_model_name,
                "embedding_model_version": config.embedding_model_version,
                "semantic_threshold": config.semantic_threshold,
                "taxonomy_version": config.taxonomy_version,
                "taxonomy_hash": taxonomy_hash,
                "analysis_status": "complaint_complete",
                "analysis_error": "",
            }
        )

    return {
        "complaint_classifications_performed": performed,
        "cached_analysis_reused": reused + reused_from_prior_config,
    }


def main() -> int:
    run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
