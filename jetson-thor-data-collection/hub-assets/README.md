---
pretty_name: Prompt to Platter robot data
tags:
- robotics
- lerobot
- jetson-thor
---

# Prompt to Platter robot data

Robot demonstrations and sensor data collected on NVIDIA Jetson Thor for the Prompt to Platter project.

## Organization

Each opt-in collection run is stored under `sessions/<session-id>/` with:

- `manifest.json`: task, hardware, modality, and lifecycle metadata
- `file_inventory.json`: relative paths and byte sizes, with optional SHA-256 hashes
- `raw/`: recorder output such as LeRobot v3, ROS bags, video, images, or telemetry
- `metadata/`: board plans, calibration, annotations, and other sidecars

## Collection policy

Sessions are uploaded only after the recorder is stopped and the session is explicitly finalized. Credentials, network addresses, and operator identity are not part of the manifest. Dataset access and licensing should be documented before changing this repository from private to public.

## Format

The outer session manifest uses `prompt-to-platter-session/v1`. Recorder payloads declare their format independently in each manifest, allowing the collection stack to preserve native LeRobot or custom data layouts.
