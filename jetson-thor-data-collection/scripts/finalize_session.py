#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from common import read_json, resolve_session, utc_now, write_json


IGNORED_NAMES = {
    ".collecting",
    ".uploading",
    "file_inventory.json",
    "manifest.json",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Finalize and inventory a session.")
    parser.add_argument("session", help="Session path or session ID.")
    parser.add_argument(
        "--sha256", action="store_true", help="Hash every payload file (extra disk I/O)."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    session_dir = resolve_session(args.session)
    files = []
    for path in sorted(session_dir.rglob("*")):
        if not path.is_file() or path.name in IGNORED_NAMES:
            continue
        relative = path.relative_to(session_dir).as_posix()
        entry = {"path": relative, "bytes": path.stat().st_size}
        if args.sha256:
            entry["sha256"] = sha256(path)
        files.append(entry)

    if not files:
        raise RuntimeError(f"Refusing to finalize empty session: {session_dir}")

    inventory = {
        "schema_version": "prompt-to-platter-file-inventory/v1",
        "generated_at": utc_now(),
        "files": files,
    }
    write_json(session_dir / "file_inventory.json", inventory)

    manifest = read_json(session_dir / "manifest.json")
    manifest.update(
        {
            "status": "finalized",
            "finalized_at": utc_now(),
            "file_count": len(files),
            "total_bytes": sum(item["bytes"] for item in files),
            "inventory": "file_inventory.json",
        }
    )
    manifest.pop("upload", None)
    write_json(session_dir / "manifest.json", manifest)
    (session_dir / ".collecting").unlink(missing_ok=True)
    print(
        f"Finalized {manifest['session_id']}: "
        f"{manifest['file_count']} files, {manifest['total_bytes']} bytes"
    )


if __name__ == "__main__":
    main()
