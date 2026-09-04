from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pipeline.config import get_config
from pipeline.storage.atomic_exporter import atomic_write_json


@dataclass(frozen=True)
class RawRunPaths:
    run_dir: Path
    manifest_path: Path


class RawRunStore:
    def __init__(self, base_dir: Path | None = None) -> None:
        config = get_config()
        self.base_dir = Path(base_dir or config.raw_runs_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def create_run_paths(self, run_id: str, started_at: str) -> RawRunPaths:
        year = started_at[0:4]
        month = started_at[5:7]
        day = started_at[8:10]
        run_dir = self.base_dir / year / month / day / f"run_{run_id}"
        run_dir.mkdir(parents=True, exist_ok=True)
        return RawRunPaths(run_dir=run_dir, manifest_path=run_dir / "manifest.json")

    def write_page(
        self,
        *,
        run_dir: Path,
        product_id: str,
        page_number: int,
        payload: Any,
    ) -> Path:
        target = run_dir / product_id / f"page_{page_number:03d}.json"
        atomic_write_json(target, payload)
        return target

    def write_manifest(self, manifest_path: Path, payload: dict[str, Any]) -> None:
        atomic_write_json(manifest_path, payload)
