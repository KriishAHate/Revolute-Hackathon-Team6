#!/usr/bin/env python3
from __future__ import annotations

from common import collection_root, read_json


def main() -> None:
    root = collection_root()
    if not root.is_dir():
        print(f"No sessions yet. Collection root: {root}")
        return

    sessions = []
    for manifest_path in sorted(root.glob("*/manifest.json"), reverse=True):
        try:
            manifest = read_json(manifest_path)
        except (OSError, ValueError):
            continue
        sessions.append(manifest)

    if not sessions:
        print(f"No sessions yet. Collection root: {root}")
        return

    print(f"{'STATUS':<11} {'FILES':>7}  {'SESSION ID':<64} TASK")
    print(f"{'-' * 11} {'-' * 7}  {'-' * 64} {'-' * 30}")
    for manifest in sessions:
        status = str(manifest.get("status", "unknown"))[:11]
        files = str(manifest.get("file_count", "-"))
        session_id = str(manifest.get("session_id", "unknown"))[:64]
        task = str(manifest.get("task", ""))
        print(f"{status:<11} {files:>7}  {session_id:<64} {task}")


if __name__ == "__main__":
    main()
