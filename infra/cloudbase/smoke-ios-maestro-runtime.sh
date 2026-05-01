#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL:-}"
TRACK="${SOFTBOOK_CET_LEARNING_TRACK:-cet4}"
IOS_DEVICE="${SOFTBOOK_CET_IOS_DEVICE:-booted}"
IOS_BUNDLE_ID="${SOFTBOOK_CET_IOS_BUNDLE_ID:-com.softbook.cet}"
METRO_PORT="${SOFTBOOK_CET_METRO_PORT:-8081}"
SMS_CODE="${SOFTBOOK_CET_TEST_CODE:-2468}"
MANUAL_TEST_PHONE="${SOFTBOOK_CET_MANUAL_TEST_PHONE:-}"
MAESTRO_FLOW="${SOFTBOOK_CET_IOS_MAESTRO_FLOW:-${ROOT_DIR}/apps/mobile/e2e/maestro/ios-remote-smoke.yaml}"
MAESTRO_JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"
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

cleanup() {
  if [[ -n "${METRO_PID}" ]]; then
    kill_process_tree "${METRO_PID}"
  fi
}

trap cleanup EXIT

if [[ -z "${BASE_URL// }" ]]; then
  echo "SOFTBOOK_CET_REMOTE_BASE_URL is required." >&2
  exit 1
fi

if [[ "${TRACK}" != "cet4" && "${TRACK}" != "cet6" ]]; then
  echo "SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6." >&2
  exit 1
fi

if [[ -z "${MANUAL_TEST_PHONE// }" ]]; then
  MANUAL_TEST_PHONE="$(create_manual_test_phone)"
fi

if [[ ! "${MANUAL_TEST_PHONE}" =~ ^19[0-9]{9}$ ]]; then
  echo "SOFTBOOK_CET_MANUAL_TEST_PHONE must match 19xxxxxxxxx." >&2
  exit 1
fi

if [[ -z "${SMS_CODE// }" ]]; then
  echo "SOFTBOOK_CET_TEST_CODE must not be blank." >&2
  exit 1
fi

echo "==> Remote Maestro acceptance account"
echo "Phone: ${MANUAL_TEST_PHONE}"
echo "Code: ${SMS_CODE} (dev fixed code)"

start_metro_if_needed

echo "==> Clearing installed iOS app before remote Maestro launch"
xcrun simctl uninstall "${IOS_DEVICE}" "${IOS_BUNDLE_ID}" >/dev/null 2>&1 || true

echo "==> Launching iOS app with CloudBase runtime profile"
SOFTBOOK_CET_IOS_LAUNCH=1 \
SOFTBOOK_CET_MANUAL_TEST_PHONE="${MANUAL_TEST_PHONE}" \
SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
"${ROOT_DIR}/infra/cloudbase/smoke-ios-runtime.sh"

echo "==> Running Maestro against the already-launched remote runtime app"
(
  cd "${ROOT_DIR}/apps/mobile"
  JAVA_HOME="${MAESTRO_JAVA_HOME}" \
  PATH="${MAESTRO_JAVA_HOME}/bin:${PATH}" \
  MAESTRO_CLI_NO_ANALYTICS=1 \
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
  maestro test \
    --no-ansi \
    -e SOFTBOOK_CET_MAESTRO_PHONE="${MANUAL_TEST_PHONE}" \
    -e SOFTBOOK_CET_MAESTRO_CODE="${SMS_CODE}" \
    "${MAESTRO_FLOW}"
)
