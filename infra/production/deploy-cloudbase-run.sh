#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDBASE_RUN_ENV_ID:?Set CLOUDBASE_RUN_ENV_ID.}"

SERVICE_NAME="${CLOUDBASE_RUN_SERVICE_NAME:-softbook-api}"
REGION="${CLOUDBASE_RUN_REGION:-sh}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "${CLOUDBASE_RUN_ENV_CONFIGURED:-}" != "yes" ]]; then
  echo "Refusing deployment: confirm production secrets and DATABASE_URL are configured in CloudBase Run by setting CLOUDBASE_RUN_ENV_CONFIGURED=yes." >&2
  exit 1
fi

tcb run service:deploy \
  --noConfirm \
  --override \
  --envId "${CLOUDBASE_RUN_ENV_ID}" \
  --serviceName "${SERVICE_NAME}" \
  -r "${REGION}" \
  --path "${ROOT}/services/api" \
  --dockerfile Dockerfile \
  --containerPort 8080 \
  --cpu 1 \
  --mem 2 \
  --minNum 1 \
  --maxNum 10 \
  --policyDetails "cpu=60&mem=60" \
  --customLogs stdout \
  --remark "${CLOUDBASE_RUN_RELEASE_REMARK:-manual-release}" \
  --json
