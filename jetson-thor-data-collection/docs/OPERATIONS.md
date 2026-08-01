# Collection operations

This is the short runbook for an engineer operating the Jetson Thor.

## Before a collection block

```bash
cd ~/YOUR_REPOSITORY/jetson-thor-data-collection
git pull --ff-only
./collector setup
./collector doctor
```

Resolve every `[FAIL]` before collecting. Review `[WARN]` entries, especially low disk space.

## Record one session

```bash
SESSION_DIR=$(./collector new \
  --task "Place berries as eyes and cheese cubes as a smile" \
  --robot-id "platter-robot-01" \
  --camera "overhead-rgb" \
  --camera "wrist-rgbd" \
  --format "lerobot-v3")

echo "$SESSION_DIR"
```

Start the hardware recorder with `$SESSION_DIR/raw` as its output. Copy the board plan and calibration into `$SESSION_DIR/metadata`.

## Close and upload

Stop every writer and camera process first. For LeRobot v3, allow LeRobot to finalize its Parquet/video writers.

```bash
./collector finalize "$SESSION_DIR"
./collector upload "$SESSION_DIR"
./collector sessions
```

The upload is explicit. `finalize` never sends data over the network.

## Failure handling

### Upload interrupted

Run the identical command again:

```bash
./collector upload "$SESSION_DIR"
```

Hugging Face skips content that already reached the Hub.

### Session was finalized too early

Do not append to it. Create a new session so the uploaded manifest and inventory remain trustworthy.

### Session contains bad data

Do not upload it. Preserve it locally until the team decides whether it is useful as a negative example. Record the decision in the task tracker.

### Disk space warning

Stop collection before the disk fills. Upload finalized sessions, verify them on Hugging Face, then archive or remove local copies according to the team's retention policy.

### Credential failure

```bash
.venv/bin/hf auth login --force
./collector doctor
```

Never place a token in a command committed to Git history.
