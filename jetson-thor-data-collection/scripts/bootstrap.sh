#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is not installed or not on PATH." >&2
  exit 1
fi

if ! python3 -m venv "$PROJECT_DIR/.venv"; then
  echo "ERROR: Python could not create a virtual environment." >&2
  echo "On Ubuntu, install it with: sudo apt-get install python3-venv" >&2
  exit 1
fi

"$PROJECT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$PROJECT_DIR/.venv/bin/python" -m pip install -r "$PROJECT_DIR/requirements.txt"

echo
echo "Environment ready."
echo "Next: cp .env.example .env && edit .env"
echo "Then: ./collector doctor"
