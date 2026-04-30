#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL:-}"
TRACK="${SOFTBOOK_CET_LEARNING_TRACK:-cet4}"
IOS_SIMULATOR="${SOFTBOOK_CET_IOS_SIMULATOR:-iPhone 17}"
LAUNCH_IOS="${SOFTBOOK_CET_IOS_LAUNCH:-0}"

if [[ -z "${BASE_URL// }" ]]; then
  echo "SOFTBOOK_CET_REMOTE_BASE_URL is required." >&2
  exit 1
fi

if [[ "${TRACK}" != "cet4" && "${TRACK}" != "cet6" ]]; then
  echo "SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6." >&2
  exit 1
fi

if [[ -z "${SOFTBOOK_CET_AUTH_TOKEN:-}" ]]; then
  if [[ -z "${SOFTBOOK_CET_TEST_PHONE:-}" ]]; then
    echo "SOFTBOOK_CET_TEST_PHONE is required when SOFTBOOK_CET_AUTH_TOKEN is not set." >&2
    exit 1
  fi

  if [[ -z "${SOFTBOOK_CET_TEST_CODE:-}" ]]; then
    echo "SOFTBOOK_CET_TEST_CODE is required when SOFTBOOK_CET_AUTH_TOKEN is not set." >&2
    exit 1
  fi
fi

export SOFTBOOK_CET_SMOKE_WRITE="${SOFTBOOK_CET_SMOKE_WRITE:-1}"
export SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS="${SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS:-1}"

echo "==> Verifying CloudBase REST contract for mobile runtime"
node "${ROOT_DIR}/infra/cloudbase/smoke-softbook-api.mjs"

echo "==> Verifying JS runtime profile parsing"
(
  cd "${ROOT_DIR}/apps/mobile"
  npm test -- --runInBand --watchman=false __tests__/appRuntimeConfig.test.ts __tests__/installRuntimeConfig.test.ts
)

if [[ "${LAUNCH_IOS}" != "1" ]]; then
  cat <<EOF
==> iOS launch skipped
Set SOFTBOOK_CET_IOS_LAUNCH=1 to start the debug app with the same remote profile.

Expected manual iOS smoke after launch:
- 登录页显示远端认证模式。
- 使用 SOFTBOOK_CET_TEST_PHONE 和 SOFTBOOK_CET_TEST_CODE 完成登录。
- 学习页加载 ${TRACK} 远端卡源，并保留单卡流。
- 首次进入空间会启动试用；空间入口解锁后显示远端卡源的 library/group/box。
- 完成一张卡后，统计页显示远端日级同步，学习状态同步不报错。

EOF
  exit 0
fi

echo "==> Launching iOS debug app against remote runtime"
(
  cd "${ROOT_DIR}/apps/mobile"
  SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
  SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
  SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
  SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
  npm run ios -- --simulator "${IOS_SIMULATOR}"
)
