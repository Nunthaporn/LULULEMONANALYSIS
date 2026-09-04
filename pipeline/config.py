from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
DEFAULT_ENV_PATH = ROOT_DIR / ".env"


def _load_env_file(path: Path = DEFAULT_ENV_PATH) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _path_from_env(name: str, default: Path) -> Path:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    candidate = Path(raw)
    return candidate if candidate.is_absolute() else ROOT_DIR / candidate


def _int_from_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float_from_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class PipelineConfig:
    root_dir: Path
    pipeline_dir: Path
    data_dir: Path
    processed_dir: Path
    output_dir: Path
    public_data_dir: Path
    raw_dir: Path
    raw_runs_dir: Path
    state_dir: Path
    state_db_path: Path
    max_pages_per_product: int
    known_page_stop_threshold: int
    max_reviews_per_product_run: int
    request_timeout_seconds: int
    max_retry_attempts: int
    circuit_breaker_failure_threshold: int
    circuit_breaker_cooldown_seconds: int
    low_star_max_rating: int
    classifier_version: str
    ml_model_name: str
    embedding_model_version: str
    semantic_threshold: float
    taxonomy_version: str
    schema_version: int

    def ensure_directories(self) -> None:
        for directory in (
            self.data_dir,
            self.processed_dir,
            self.output_dir,
            self.public_data_dir,
            self.raw_dir,
            self.raw_runs_dir,
            self.state_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_config() -> PipelineConfig:
    _load_env_file()

    data_dir = _path_from_env("PIPELINE_DATA_DIR", ROOT_DIR / "data")
    processed_dir = data_dir / "processed"
    raw_dir = data_dir / "raw"
    output_dir = _path_from_env(
        "PIPELINE_OUTPUT_DIR",
        ROOT_DIR / "public" / "data" / "dashboard_data",
    )
    state_db_path = _path_from_env(
        "PIPELINE_STATE_DB",
        data_dir / "state" / "pipeline_state.db",
    )

    config = PipelineConfig(
        root_dir=ROOT_DIR,
        pipeline_dir=PIPELINE_DIR,
        data_dir=data_dir,
        processed_dir=processed_dir,
        output_dir=output_dir,
        public_data_dir=ROOT_DIR / "public" / "data",
        raw_dir=raw_dir,
        raw_runs_dir=raw_dir / "runs",
        state_dir=state_db_path.parent,
        state_db_path=state_db_path,
        max_pages_per_product=_int_from_env("MAX_PAGES_PER_PRODUCT", 1000),
        known_page_stop_threshold=_int_from_env("KNOWN_PAGE_STOP_THRESHOLD", 2),
        max_reviews_per_product_run=_int_from_env("MAX_REVIEWS_PER_PRODUCT_RUN", 5000),
        request_timeout_seconds=_int_from_env("REQUEST_TIMEOUT_SECONDS", 60),
        max_retry_attempts=_int_from_env("MAX_RETRY_ATTEMPTS", 5),
        circuit_breaker_failure_threshold=_int_from_env(
            "CIRCUIT_BREAKER_FAILURE_THRESHOLD",
            3,
        ),
        circuit_breaker_cooldown_seconds=_int_from_env(
            "CIRCUIT_BREAKER_COOLDOWN_SECONDS",
            1800,
        ),
        low_star_max_rating=_int_from_env("LOW_STAR_MAX_RATING", 3),
        classifier_version=os.getenv("CLASSIFIER_VERSION", "keyword_v1").strip() or "keyword_v1",
        ml_model_name=os.getenv(
            "ML_MODEL_NAME",
            "sentence-transformers/all-MiniLM-L6-v2",
        ).strip()
        or "sentence-transformers/all-MiniLM-L6-v2",
        embedding_model_version=os.getenv(
            "EMBEDDING_MODEL_VERSION",
            "all-MiniLM-L6-v2",
        ).strip()
        or "all-MiniLM-L6-v2",
        semantic_threshold=_float_from_env("SEMANTIC_THRESHOLD", 0.22),
        taxonomy_version=os.getenv("TAXONOMY_VERSION", "master_defect_v1").strip()
        or "master_defect_v1",
        schema_version=_int_from_env("PIPELINE_SCHEMA_VERSION", 1),
    )
    config.ensure_directories()
    return config


def reset_config_cache() -> None:
    get_config.cache_clear()
