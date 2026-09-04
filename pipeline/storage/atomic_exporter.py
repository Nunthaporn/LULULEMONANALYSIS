from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def _write_atomic(path: Path, write_fn) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path_str = tempfile.mkstemp(
        dir=str(path.parent),
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temp_path = Path(temp_path_str)
    try:
        with os.fdopen(fd, "wb") as handle:
            write_fn(handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def atomic_write_text(path: Path | str, text: str, encoding: str = "utf-8") -> None:
    target = Path(path)

    def writer(handle) -> None:
        handle.write(text.encode(encoding))

    _write_atomic(target, writer)


def atomic_write_bytes(path: Path | str, payload: bytes) -> None:
    target = Path(path)

    def writer(handle) -> None:
        handle.write(payload)

    _write_atomic(target, writer)


def atomic_write_json(path: Path | str, payload: Any, *, indent: int = 2) -> None:
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        indent=indent,
        allow_nan=False,
    )
    atomic_write_text(path, serialized + "\n")
