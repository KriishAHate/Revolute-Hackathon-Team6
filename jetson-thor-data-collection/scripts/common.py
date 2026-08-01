from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


PROJECT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_DIR / ".env")


def utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
    temporary.replace(path)


def dataset_repo_id() -> str:
    repo_id = os.getenv("HF_DATASET_REPO", "").strip()
    if not repo_id or repo_id.count("/") != 1:
        raise RuntimeError(
            "Set HF_DATASET_REPO in .env using the form owner/dataset-name."
        )
    return repo_id


def dataset_is_private() -> bool:
    return os.getenv("HF_DATASET_PRIVATE", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }


def collection_root() -> Path:
    configured = Path(os.getenv("COLLECTION_ROOT", "./data/sessions")).expanduser()
    if not configured.is_absolute():
        configured = PROJECT_DIR / configured
    return configured.resolve()


def resolve_session(value: str) -> Path:
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        direct = (Path.cwd() / candidate).resolve()
        candidate = direct if direct.exists() else collection_root() / candidate
    candidate = candidate.resolve()
    if not candidate.is_dir():
        raise FileNotFoundError(f"Session directory does not exist: {candidate}")
    if not (candidate / "manifest.json").is_file():
        raise FileNotFoundError(f"Session has no manifest.json: {candidate}")
    return candidate
