#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL:-}"
TRACK="${SOFTBOOK_CET_LEARNING_TRACK:-cet4}"
IOS_SIMULATOR="${SOFTBOOK_CET_IOS_SIMULATOR:-iPhone 17}"
IOS_DEVICE="${SOFTBOOK_CET_IOS_DEVICE:-booted}"
IOS_BUNDLE_ID="${SOFTBOOK_CET_IOS_BUNDLE_ID:-com.softbook.cet}"
LAUNCH_IOS="${SOFTBOOK_CET_IOS_LAUNCH:-0}"
ISOLATED_CONTRACT_PHONE="${SOFTBOOK_CET_SMOKE_ISOLATED_PHONE:-1}"
METRO_PORT="${SOFTBOOK_CET_METRO_PORT:-8081}"
STOP_METRO_ON_EXIT="${SOFTBOOK_CET_STOP_METRO_ON_EXIT:-0}"
SMS_CODE="${SOFTBOOK_CET_TEST_CODE:-2468}"
MANUAL_TEST_PHONE="${SOFTBOOK_CET_MANUAL_TEST_PHONE:-}"
METRO_PID=""

create_manual_test_phone() {
  local suffix
  suffix="$(printf '%05d%04d' "$(( $(date +%s) % 100000 ))" "$(( RANDOM % 10000 ))")"

  printf '19%s\n' "${suffix}"
}

metro_is_running() {
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" \
    | grep -q "packager-status:running"
}

start_metro_if_needed() {
  if metro_is_running; then
    echo "==> Reusing Metro on port ${METRO_PORT}"
    return
  fi

  echo "==> Starting Metro on port ${METRO_PORT}"
  (
    cd "${ROOT_DIR}/apps/mobile"
    npm start -- --port "${METRO_PORT}" >/tmp/softbook-cet-metro.log 2>&1
  ) &
  METRO_PID="$!"

  for _ in {1..60}; do
    if metro_is_running; then
      return
    fi

    sleep 1
  done

  echo "Metro did not become ready on port ${METRO_PORT}. See /tmp/softbook-cet-metro.log." >&2
  exit 1
}

cleanup() {
  local reason="${1:-exit}"

  if [[ -n "${METRO_PID}" && ("${STOP_METRO_ON_EXIT}" == "1" || "${reason}" != "exit") ]]; then
    kill_process_tree "${METRO_PID}"
  fi
}

kill_process_tree() {
  local pid="$1"
  local child

  while read -r child; do
    if [[ -n "${child}" ]]; then
      kill_process_tree "${child}"
    fi
  done < <(pgrep -P "${pid}" 2>/dev/null || true)

  kill "${pid}" >/dev/null 2>&1 || true
}

trap 'cleanup interrupt; exit 130' INT TERM
trap 'cleanup exit' EXIT

if [[ -z "${BASE_URL// }" ]]; then
  echo "SOFTBOOK_CET_REMOTE_BASE_URL is required." >&2
  exit 1
fi

if [[ "${TRACK}" != "cet4" && "${TRACK}" != "cet6" ]]; then
  echo "SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6." >&2
  exit 1
fi

if [[ -z "${SOFTBOOK_CET_AUTH_TOKEN:-}" && "${ISOLATED_CONTRACT_PHONE}" != "1" ]]; then
  if [[ -z "${SOFTBOOK_CET_TEST_PHONE:-}" ]]; then
    echo "SOFTBOOK_CET_TEST_PHONE is required when SOFTBOOK_CET_AUTH_TOKEN is not set and isolated contract phone mode is disabled." >&2
    exit 1
  fi
fi

if [[ -z "${SOFTBOOK_CET_AUTH_TOKEN:-}" && -z "${SMS_CODE// }" ]]; then
  echo "SOFTBOOK_CET_TEST_CODE must not be blank when SOFTBOOK_CET_AUTH_TOKEN is not set." >&2
  exit 1
fi

export SOFTBOOK_CET_SMOKE_WRITE="${SOFTBOOK_CET_SMOKE_WRITE:-1}"
export SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS="${SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS:-1}"
export SOFTBOOK_CET_SMOKE_ISOLATED_PHONE="${ISOLATED_CONTRACT_PHONE}"
export SOFTBOOK_CET_TEST_CODE="${SMS_CODE}"

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
- 使用脚本打印的一次性手机号和 dev fixed code ${SMS_CODE} 完成登录。
- 学习页加载 ${TRACK} 远端卡源，并保留单卡流。
- 首次进入空间会启动试用；空间入口解锁后显示远端卡源的 library/group/box。
- 完成一张卡后，统计页显示远端日级同步，学习状态同步不报错。

EOF
  exit 0
fi

if [[ -z "${MANUAL_TEST_PHONE// }" ]]; then
  MANUAL_TEST_PHONE="$(create_manual_test_phone)"
fi

if [[ ! "${MANUAL_TEST_PHONE}" =~ ^19[0-9]{9}$ ]]; then
  echo "SOFTBOOK_CET_MANUAL_TEST_PHONE must match 19xxxxxxxxx." >&2
  exit 1
fi

cat <<EOF
==> Manual iOS acceptance account
Phone: ${MANUAL_TEST_PHONE}
Code: ${SMS_CODE} (dev fixed code)

Use SOFTBOOK_CET_MANUAL_TEST_PHONE=${MANUAL_TEST_PHONE} to reproduce this manual acceptance run.

EOF

echo "==> Launching iOS debug app against remote runtime"
start_metro_if_needed
(
  cd "${ROOT_DIR}/apps/mobile"
  SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
  SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
  SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
  SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
  npm run ios -- --simulator "${IOS_SIMULATOR}" --no-packager --port "${METRO_PORT}"
)

echo "==> Relaunching iOS app with simulator child environment"
SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
SIMCTL_CHILD_SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
SIMCTL_CHILD_SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
xcrun simctl launch --terminate-running-process "${IOS_DEVICE}" "${IOS_BUNDLE_ID}"

if [[ -n "${METRO_PID}" && "${STOP_METRO_ON_EXIT}" != "1" ]]; then
  cat <<EOF
==> Metro is running for manual acceptance
PID: ${METRO_PID}
Log: /tmp/softbook-cet-metro.log
Press Ctrl+C after manual acceptance to stop this Metro session.

EOF
fi

cat <<EOF
==> Manual iOS smoke after launch
- 登录页显示远端认证模式。
- 使用 ${MANUAL_TEST_PHONE} 和 dev fixed code ${SMS_CODE} 完成登录。
- 学习页加载 ${TRACK} 远端卡源，并保留单卡流。
- 首次进入空间会启动试用；空间入口解锁后显示远端卡源的 library/group/box。
- 完成一张卡后，统计页显示远端日级同步，学习状态同步不报错。

EOF

if [[ -n "${METRO_PID}" && "${STOP_METRO_ON_EXIT}" != "1" ]]; then
  wait "${METRO_PID}"
fi
