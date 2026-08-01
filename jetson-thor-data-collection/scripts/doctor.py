#!/usr/bin/env python3
from __future__ import annotations

import platform
import shutil
import sys
from pathlib import Path

from huggingface_hub import HfApi

from common import PROJECT_DIR, collection_root, dataset_repo_id


class Report:
    def __init__(self) -> None:
        self.failures = 0
        self.warnings = 0

    def pass_(self, message: str) -> None:
        print(f"[PASS] {message}")

    def warn(self, message: str) -> None:
        self.warnings += 1
        print(f"[WARN] {message}")

    def fail(self, message: str) -> None:
        self.failures += 1
        print(f"[FAIL] {message}")


def nearest_existing_parent(path: Path) -> Path:
    candidate = path
    while not candidate.exists() and candidate != candidate.parent:
        candidate = candidate.parent
    return candidate


def main() -> None:
    report = Report()
    print("Prompt to Platter collection diagnostics\n")

    python_version = sys.version_info
    if python_version >= (3, 10):
        report.pass_(f"Python {platform.python_version()}")
    else:
        report.fail(
            f"Python {platform.python_version()} is too old; Python 3.10+ is required."
        )

    env_path = PROJECT_DIR / ".env"
    if env_path.is_file():
        report.pass_("Local .env configuration exists")
    else:
        report.fail("Missing .env; run: cp .env.example .env")

    repo_id: str | None = None
    try:
        repo_id = dataset_repo_id()
        report.pass_(f"Dataset repository configured: {repo_id}")
    except RuntimeError as error:
        report.fail(str(error))

    root = collection_root()
    storage_path = nearest_existing_parent(root)
    if storage_path.exists() and storage_path.is_dir():
        free_gib = shutil.disk_usage(storage_path).free / (1024**3)
        report.pass_(f"Collection storage resolves to: {root}")
        if free_gib < 20:
            report.warn(f"Only {free_gib:.1f} GiB free on collection storage")
        else:
            report.pass_(f"Collection storage has {free_gib:.1f} GiB free")
    else:
        report.fail(f"Collection storage parent does not exist: {storage_path}")

    model_path = Path("/proc/device-tree/model")
    model = (
        model_path.read_text(encoding="utf-8", errors="replace").rstrip("\x00\n")
        if model_path.is_file()
        else ""
    )
    if "thor" in model.lower():
        report.pass_(f"Jetson model detected: {model}")
    elif model:
        report.warn(f"This machine reports '{model}', not Jetson Thor")
    else:
        report.warn("Jetson model could not be detected (expected off-device)")

    for command, purpose in [
        ("git", "source updates"),
        ("ffmpeg", "video inspection/encoding"),
        ("tegrastats", "Jetson telemetry"),
    ]:
        if shutil.which(command):
            report.pass_(f"{command} available for {purpose}")
        else:
            report.warn(f"{command} not found; it may be needed for {purpose}")

    if repo_id:
        api = HfApi()
        try:
            identity = api.whoami()
            report.pass_(f"Hugging Face authentication: {identity['name']}")
            try:
                info = api.repo_info(repo_id=repo_id, repo_type="dataset")
                report.pass_(f"Hugging Face dataset is accessible: {info.id}")
            except Exception:
                report.warn("Dataset is not accessible yet; run: ./collector init-hf")
        except Exception:
            report.fail("Hugging Face login missing or invalid; run: .venv/bin/hf auth login")

    print(
        f"\nResult: {report.failures} failure(s), {report.warnings} warning(s)."
    )
    if report.failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
