#!/usr/bin/env bash
set -euo pipefail

ENV_ID="${CLOUDBASE_ENV_ID:-test-d2gzcyxr9f7e80972}"

if ! command -v tcb >/dev/null 2>&1; then
  echo "Missing CloudBase CLI. Install it with: npm install -g @cloudbase/cli" >&2
  exit 1
fi

echo "CloudBase CLI:"
tcb -v

echo
echo "Environment list:"
tcb env list --json

echo
echo "Environment detail for ${ENV_ID}:"
tcb env detail -e "${ENV_ID}" --json

echo
echo "Cloud functions for ${ENV_ID}:"
tcb fn list -e "${ENV_ID}" --json

echo
echo "Usage for ${ENV_ID}:"
tcb env usage -e "${ENV_ID}" --json --yes
