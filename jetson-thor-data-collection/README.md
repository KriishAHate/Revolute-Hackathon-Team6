# Jetson Thor data collection

This folder is the portable collection-side companion for Prompt to Platter. Copy it to the Jetson Thor, point your recorder at a session's `raw/` directory, then finalize and upload that session to a private Hugging Face dataset. No coding agent or special editor is required.

It does not assume a specific robot, camera, or recorder. The payload can be LeRobot v3, ROS bags, MP4/Parquet, images, telemetry, or a custom format. Every session gets a consistent manifest and file inventory.

## 1. Install on the Jetson

Python 3.10 or newer is recommended.

```bash
cd jetson-thor-data-collection
./collector setup
cp .env.example .env
```

Edit `.env` and set `HF_DATASET_REPO`. For a large collection, set `COLLECTION_ROOT` to an NVMe-backed absolute path.

## 2. Authenticate and create the dataset

Create a [fine-grained Hugging Face token](https://huggingface.co/settings/tokens) with write access to the target dataset, then authenticate on the Jetson:

```bash
.venv/bin/hf auth login
./collector doctor
./collector init-hf
```

For a headless service, inject `HF_TOKEN` through the service environment instead of saving it in shell history. The setup creates a private dataset by default and adds a dataset card plus the session-manifest schema.

## 3. Start a collection session

```bash
SESSION_DIR=$(./collector new \
  --task "Place berries as eyes and cheese cubes as a smile" \
  --robot-id "platter-robot-01" \
  --camera "overhead-rgb" \
  --camera "wrist-rgbd" \
  --format "lerobot-v3")

echo "$SESSION_DIR"
```

Send all recorder output to `$SESSION_DIR/raw/`. Put the board plan, calibration, or other small sidecar files in `$SESSION_DIR/metadata/`.

Example recorder contract:

```bash
your-recorder --output "$SESSION_DIR/raw"
cp /path/to/board-plan.json "$SESSION_DIR/metadata/board-plan.json"
```

## 4. Finalize and upload

Stop the recorder before finalizing. Finalization inventories the files and refuses an empty session.

```bash
./collector finalize "$SESSION_DIR"
./collector upload "$SESSION_DIR"
```

Uploads use Hugging Face's resumable `upload_folder` path. If a large transfer is interrupted, run the same upload command again. A session is uploaded under `sessions/<session-id>/`; it is never uploaded automatically.

Add `--sha256` when finalizing if cryptographic checksums are worth the extra full-disk read:

```bash
./collector finalize "$SESSION_DIR" --sha256
```

List local sessions at any time with `./collector sessions`. Run `./collector help` for the complete command list.

## Session layout

```text
session-id/
├── manifest.json
├── file_inventory.json       # created during finalization
├── metadata/
│   └── board-plan.json
└── raw/
    └── recorder output
```

The manifest records the task, robot ID, camera names, format, Jetson model, collection timestamps, byte count, and upload commit. It intentionally does not record IP addresses, Hugging Face credentials, or operator identity.

## LeRobot

LeRobotDataset v3 is a good default when your robot and cameras are supported: it stores robot-learning data in Parquet plus video and supports streaming from the Hub. Keep LeRobot's own dataset directory intact under `raw/`, and always let LeRobot finalize its writers before running this folder's `finalize_session.py`.

## Team handoff

- Repository and access setup: [`docs/TEAM_SETUP.md`](docs/TEAM_SETUP.md)
- Day-to-day collector runbook: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
