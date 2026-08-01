#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi

from common import dataset_is_private, dataset_repo_id, read_json, resolve_session, utc_now, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload one finalized session to the Hub.")
    parser.add_argument("session", help="Session path or session ID.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    session_dir = resolve_session(args.session)
    manifest_path = session_dir / "manifest.json"
    manifest = read_json(manifest_path)
    if manifest.get("status") not in {"finalized", "uploaded"}:
        raise RuntimeError("Finalize the session before uploading it.")
    if (session_dir / ".collecting").exists():
        raise RuntimeError("The session is still marked as collecting.")

    lock_path = session_dir / ".uploading"
    try:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(lock_fd)
    except FileExistsError as error:
        raise RuntimeError(f"Another upload is active for {session_dir}") from error

    repo_id = dataset_repo_id()
    path_in_repo = f"sessions/{manifest['session_id']}"
    api = HfApi()
    try:
        api.create_repo(
            repo_id=repo_id,
            repo_type="dataset",
            private=dataset_is_private(),
            exist_ok=True,
        )
        commit = api.upload_folder(
            folder_path=session_dir,
            path_in_repo=path_in_repo,
            repo_id=repo_id,
            repo_type="dataset",
            ignore_patterns=[".collecting", ".uploading", "**/.cache/**", "**/__pycache__/**"],
            commit_message=f"Upload session {manifest['session_id']}",
        )
        manifest["status"] = "uploaded"
        manifest["upload"] = {
            "repo_id": repo_id,
            "path_in_repo": path_in_repo,
            "commit_url": commit.commit_url,
            "uploaded_at": utc_now(),
        }
        write_json(manifest_path, manifest)
        final_commit = api.upload_file(
            path_or_fileobj=manifest_path,
            path_in_repo=f"{path_in_repo}/manifest.json",
            repo_id=repo_id,
            repo_type="dataset",
            commit_message=f"Mark session {manifest['session_id']} uploaded",
        )
        print(f"Uploaded: {final_commit.commit_url}")
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
