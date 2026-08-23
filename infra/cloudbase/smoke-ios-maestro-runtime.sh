#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api"
BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL:-}"
TRACK="${SOFTBOOK_CET_LEARNING_TRACK:-cet4}"
IOS_DEVICE="${SOFTBOOK_CET_IOS_DEVICE:-booted}"
IOS_SIMULATOR="${SOFTBOOK_CET_IOS_SIMULATOR:-iPhone 17}"
IOS_BUNDLE_ID="${SOFTBOOK_CET_IOS_BUNDLE_ID:-com.softbook.cet}"
METRO_PORT="${SOFTBOOK_CET_METRO_PORT:-8081}"
SMS_CODE="${SOFTBOOK_CET_TEST_CODE:-2468}"
MAESTRO_PHONE="${SOFTBOOK_CET_MAESTRO_PHONE:-}"
CONTRACT_TEST_PHONE="${SOFTBOOK_CET_TEST_PHONE:-}"
SMOKE_LIFECYCLE_MANIFEST="${SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST:-}"
SMOKE_LIFECYCLE_ACTIVE="0"
MAESTRO_FLOW="${SOFTBOOK_CET_IOS_MAESTRO_FLOW:-${ROOT_DIR}/apps/mobile/e2e/maestro/ios-remote-smoke.yaml}"
MAESTRO_JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"
METRO_PID=""
RESOLVED_IOS_DEVICE=""

create_maestro_test_phone() {
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
  local cleanup_failed="0"

  if [[ "${SMOKE_LIFECYCLE_ACTIVE}" == "1" ]]; then
    echo "==> Removing exact CloudBase dev smoke records"
    if ! node "${ROOT_DIR}/infra/cloudbase/smoke-record-lifecycle.mjs" \
      cleanup \
      --manifest "${SMOKE_LIFECYCLE_MANIFEST}" \
      --apply; then
      cleanup_failed="1"
    fi
    SMOKE_LIFECYCLE_ACTIVE="0"
  fi

  if [[ -n "${METRO_PID}" ]]; then
    kill_process_tree "${METRO_PID}"
  fi

  return "${cleanup_failed}"
}

prepare_smoke_lifecycle() {
  local prepared

  if [[ "${BASE_URL}" != "${DEV_BASE_URL}" ]]; then
    return
  fi
  if [[ -z "${SMOKE_LIFECYCLE_MANIFEST}" ]]; then
    SMOKE_LIFECYCLE_MANIFEST="${ROOT_DIR}/exports/cloudbase-smoke/maestro-$(date -u +%Y%m%dT%H%M%SZ)-$$/manifest.json"
  fi
  prepared="$(
    SOFTBOOK_CET_TEST_PHONE="${CONTRACT_TEST_PHONE}" \
    SOFTBOOK_CET_MAESTRO_PHONE="${MAESTRO_PHONE}" \
    node "${ROOT_DIR}/infra/cloudbase/smoke-record-lifecycle.mjs" \
      prepare \
      --manifest "${SMOKE_LIFECYCLE_MANIFEST}" \
      --phone-count 2 \
      --format tsv
  )"
  IFS=$'\t' read -r CONTRACT_TEST_PHONE MAESTRO_PHONE <<<"${prepared}"
  SMOKE_LIFECYCLE_ACTIVE="1"
}

resolve_ios_target() {
  local resolved resolved_state resolved_name resolved_runtime

  resolved="$(
    node "${ROOT_DIR}/infra/cloudbase/resolve-ios-simulator.mjs" \
      --device "${IOS_DEVICE}" \
      --simulator "${IOS_SIMULATOR}" \
      --format tsv
  )"
  IFS=$'\t' read -r \
    RESOLVED_IOS_DEVICE \
    resolved_state \
    resolved_name \
    resolved_runtime <<<"${resolved}"

  if [[ -z "${RESOLVED_IOS_DEVICE}" ]]; then
    echo "Resolved iOS Simulator UDID must not be blank." >&2
    exit 1
  fi

  echo "==> Maestro target ${resolved_name} (${resolved_runtime}) ${RESOLVED_IOS_DEVICE} [${resolved_state}]"
}

on_exit() {
  local exit_code="$?"
  trap - EXIT
  if ! cleanup; then
    exit_code="1"
  fi
  exit "${exit_code}"
}

trap 'exit 130' INT TERM
trap on_exit EXIT

if [[ -z "${BASE_URL// }" ]]; then
  echo "SOFTBOOK_CET_REMOTE_BASE_URL is required." >&2
  exit 1
fi

if [[ "${TRACK}" != "cet4" && "${TRACK}" != "cet6" ]]; then
  echo "SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6." >&2
  exit 1
fi

if [[ -z "${MAESTRO_PHONE// }" ]]; then
  MAESTRO_PHONE="$(create_maestro_test_phone)"
fi

if [[ ! "${MAESTRO_PHONE}" =~ ^19[0-9]{9}$ ]]; then
  echo "SOFTBOOK_CET_MAESTRO_PHONE must match 19xxxxxxxxx." >&2
  exit 1
fi

if [[ -z "${SMS_CODE// }" ]]; then
  echo "SOFTBOOK_CET_TEST_CODE must not be blank." >&2
  exit 1
fi

if [[ ! -f "${MAESTRO_FLOW}" ]]; then
  echo "SOFTBOOK_CET_IOS_MAESTRO_FLOW must identify an existing file." >&2
  exit 1
fi

if [[ ! -x "${MAESTRO_JAVA_HOME}/bin/java" ]]; then
  echo "JAVA_HOME must identify a Java runtime for Maestro." >&2
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro must be installed and available on PATH." >&2
  exit 1
fi

echo "==> Preparing isolated automated Maestro acceptance inputs"

resolve_ios_target
start_metro_if_needed

echo "==> Clearing installed iOS app before remote Maestro launch"
xcrun simctl uninstall "${RESOLVED_IOS_DEVICE}" "${IOS_BUNDLE_ID}" >/dev/null 2>&1 || true

prepare_smoke_lifecycle

echo "==> Launching iOS app with CloudBase runtime profile"
SOFTBOOK_CET_IOS_LAUNCH=1 \
SOFTBOOK_CET_SMOKE_LIFECYCLE_OWNER=external \
SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST="${SMOKE_LIFECYCLE_MANIFEST}" \
SOFTBOOK_CET_TEST_PHONE="${CONTRACT_TEST_PHONE}" \
SOFTBOOK_CET_MAESTRO_PHONE="${MAESTRO_PHONE}" \
SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
SOFTBOOK_CET_IOS_DEVICE="${RESOLVED_IOS_DEVICE}" \
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
    --udid "${RESOLVED_IOS_DEVICE}" \
    -e SOFTBOOK_CET_MAESTRO_PHONE="${MAESTRO_PHONE}" \
    -e SOFTBOOK_CET_MAESTRO_CODE="${SMS_CODE}" \
    "${MAESTRO_FLOW}"
)

cat <<EOF
==> Automated iOS Simulator UI acceptance complete
automated_simulator_launch_verified=true
automated_simulator_ui_evidence_verified=true
automated_real_device_evidence_verified=false
gate_eligible=false
EOF
