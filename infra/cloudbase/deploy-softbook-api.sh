#!/usr/bin/env bash
set -euo pipefail

ENV_ID="${CLOUDBASE_ENV_ID:-test-d2gzcyxr9f7e80972}"
FUNCTION_NAME="${CLOUDBASE_FUNCTION_NAME:-softbook-api}"
HTTP_PATH="${CLOUDBASE_HTTP_PATH:-/softbook-api}"

cd "$(dirname "$0")"

tcb fn deploy "${FUNCTION_NAME}" \
  --dir "functions/${FUNCTION_NAME}" \
  --path "${HTTP_PATH}" \
  --runtime Nodejs20.19 \
  -e "${ENV_ID}" \
  --force
