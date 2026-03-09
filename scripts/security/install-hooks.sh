#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required to install hooks." >&2
  exit 1
fi

git config core.hooksPath .githooks

chmod +x .githooks/pre-commit
chmod +x scripts/security/scan-secrets.sh

echo "Installed git hooks at .githooks"
echo "Current core.hooksPath: $(git config core.hooksPath)"
