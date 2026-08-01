#!/usr/bin/env python3
from __future__ import annotations

import argparse
import platform
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from common import collection_root, utc_now, write_json


def device_model() -> str:
    model_path = Path("/proc/device-tree/model")
    if model_path.is_file():
        return model_path.read_text(encoding="utf-8", errors="replace").rstrip("\x00\n")
    return "unknown"


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:40] or "session"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a new local collection session.")
    parser.add_argument("--task", required=True, help="Natural-language task for this run.")
    parser.add_argument("--robot-id", required=True, help="Stable robot identifier.")
    parser.add_argument(
        "--camera",
        action="append",
        default=[],
        help="Camera/modality name. Repeat for multiple cameras.",
    )
    parser.add_argument("--format", default="lerobot-v3", dest="dataset_format")
    parser.add_argument("--notes", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = collection_root()
    root.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    session_id = f"{timestamp}-{slug(args.task)}-{uuid.uuid4().hex[:8]}"
    session_dir = root / session_id
    session_dir.mkdir()
    (session_dir / "raw").mkdir()
    (session_dir / "metadata").mkdir()
    (session_dir / ".collecting").touch()

    manifest = {
        "schema_version": "prompt-to-platter-session/v1",
        "session_id": session_id,
        "status": "collecting",
        "created_at": utc_now(),
        "task": args.task.strip(),
        "robot_id": args.robot_id.strip(),
        "dataset_format": args.dataset_format.strip(),
        "cameras": args.camera,
        "hardware": {
            "device_model": device_model(),
            "machine": platform.machine(),
            "system_release": platform.release(),
            "python": platform.python_version(),
        },
    }
    if args.notes.strip():
        manifest["notes"] = args.notes.strip()
    write_json(session_dir / "manifest.json", manifest)
    print(session_dir, file=sys.stdout)


if __name__ == "__main__":
    main()
