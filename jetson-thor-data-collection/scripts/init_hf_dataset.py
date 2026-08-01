#!/usr/bin/env python3
from __future__ import annotations

from huggingface_hub import HfApi

from common import PROJECT_DIR, dataset_is_private, dataset_repo_id


def main() -> None:
    repo_id = dataset_repo_id()
    api = HfApi()
    identity = api.whoami()
    repo_url = api.create_repo(
        repo_id=repo_id,
        repo_type="dataset",
        private=dataset_is_private(),
        exist_ok=True,
    )

    existing_files = set(api.list_repo_files(repo_id=repo_id, repo_type="dataset"))
    assets = {
        "README.md": PROJECT_DIR / "hub-assets" / "README.md",
        "schema/session-manifest.schema.json": (
            PROJECT_DIR / "hub-assets" / "schema" / "session-manifest.schema.json"
        ),
    }
    for path_in_repo, local_path in assets.items():
        if path_in_repo in existing_files:
            continue
        api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo=path_in_repo,
            repo_id=repo_id,
            repo_type="dataset",
            commit_message=f"Initialize {path_in_repo}",
        )

    print(f"Authenticated as: {identity['name']}")
    print(f"Dataset ready: {repo_url}")


if __name__ == "__main__":
    main()
