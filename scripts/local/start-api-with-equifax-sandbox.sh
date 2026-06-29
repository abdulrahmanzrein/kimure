#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$HOME/.kimure-equifax-sandbox.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing private Equifax sandbox env file: ~/.kimure-equifax-sandbox.env" >&2
  echo "Create it outside the repo, chmod 600 it, and never commit or paste its contents." >&2
  exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Private Equifax sandbox env file is not readable by this user." >&2
  echo "Check file ownership and permissions without printing its contents." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js/npm or open a shell where npm is available." >&2
  exit 1
fi

cd "$REPO_ROOT/apps/api"

# Load private local sandbox config without printing values. The file should
# contain exported environment variables and must remain outside the repo.
# shellcheck source=/dev/null
source "$ENV_FILE"

echo "Starting Kimure API on localhost:3001 with local Equifax sandbox config loaded."
echo "No smoke test or Equifax provider call is run by this helper."
exec npm run start:dev
