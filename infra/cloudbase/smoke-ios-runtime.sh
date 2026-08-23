#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api"
BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL:-}"
TRACK="${SOFTBOOK_CET_LEARNING_TRACK:-cet4}"
IOS_SIMULATOR="${SOFTBOOK_CET_IOS_SIMULATOR:-iPhone 17}"
IOS_DEVICE="${SOFTBOOK_CET_IOS_DEVICE:-booted}"
IOS_BUNDLE_ID="${SOFTBOOK_CET_IOS_BUNDLE_ID:-com.softbook.cet}"
LAUNCH_IOS="${SOFTBOOK_CET_IOS_LAUNCH:-0}"
ISOLATED_CONTRACT_PHONE="${SOFTBOOK_CET_SMOKE_ISOLATED_PHONE:-1}"
SMOKE_WRITE="${SOFTBOOK_CET_SMOKE_WRITE:-1}"
SMOKE_MEMBERSHIP_MUTATIONS="${SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS:-1}"
METRO_PORT="${SOFTBOOK_CET_METRO_PORT:-8081}"
SMS_CODE="${SOFTBOOK_CET_TEST_CODE:-2468}"
CONTRACT_TEST_PHONE="${SOFTBOOK_CET_TEST_PHONE:-}"
SMOKE_LIFECYCLE_OWNER="${SOFTBOOK_CET_SMOKE_LIFECYCLE_OWNER:-self}"
SMOKE_LIFECYCLE_MANIFEST="${SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST:-}"
SMOKE_LIFECYCLE_ACTIVE="0"
METRO_PID=""
RESOLVED_IOS_DEVICE=""
RESOLVED_IOS_DEVICE_STATE=""

prepare_ios_launch_inputs() {
  if [[ -z "${IOS_BUNDLE_ID// }" ]]; then
    echo "SOFTBOOK_CET_IOS_BUNDLE_ID must not be blank." >&2
    exit 1
  fi
}

require_binary_flag() {
  local name="$1"
  local value="$2"

  if [[ "${value}" != "0" && "${value}" != "1" ]]; then
    echo "${name} must be 0 or 1." >&2
    exit 1
  fi
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

resolve_ios_launch_target() {
  local resolved resolved_name resolved_runtime

  resolved="$(
    node "${ROOT_DIR}/infra/cloudbase/resolve-ios-simulator.mjs" \
      --device "${IOS_DEVICE}" \
      --simulator "${IOS_SIMULATOR}" \
      --format tsv
  )"
  IFS=$'\t' read -r \
    RESOLVED_IOS_DEVICE \
    RESOLVED_IOS_DEVICE_STATE \
    resolved_name \
    resolved_runtime <<<"${resolved}"

  if [[ -z "${RESOLVED_IOS_DEVICE}" ]]; then
    echo "Resolved iOS Simulator UDID must not be blank." >&2
    exit 1
  fi

  echo "==> iOS target ${resolved_name} (${resolved_runtime}) ${RESOLVED_IOS_DEVICE}"

  if [[ "${RESOLVED_IOS_DEVICE_STATE}" == "Shutdown" ]]; then
    xcrun simctl boot "${RESOLVED_IOS_DEVICE}"
  elif [[ "${RESOLVED_IOS_DEVICE_STATE}" != "Booted" ]]; then
    echo "iOS Simulator must be Booted or Shutdown, received ${RESOLVED_IOS_DEVICE_STATE}." >&2
    exit 1
  fi

  xcrun simctl bootstatus "${RESOLVED_IOS_DEVICE}" -b
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
    METRO_PID=""
  fi

  return "${cleanup_failed}"
}

prepare_smoke_lifecycle() {
  local prepared

  if [[ "${BASE_URL}" != "${DEV_BASE_URL}" ]]; then
    return
  fi

  if [[ "${ISOLATED_CONTRACT_PHONE}" != "1" || -n "${SOFTBOOK_CET_AUTH_TOKEN:-}" ]]; then
    echo "The allowlisted CloudBase dev smoke requires an isolated lifecycle-owned phone." >&2
    exit 1
  fi

  if [[ "${SMOKE_LIFECYCLE_OWNER}" == "external" ]]; then
    if [[ -z "${SMOKE_LIFECYCLE_MANIFEST}" || -z "${CONTRACT_TEST_PHONE}" ]]; then
      echo "External smoke lifecycle ownership requires a manifest and contract phone." >&2
      exit 1
    fi
    export SOFTBOOK_CET_TEST_PHONE="${CONTRACT_TEST_PHONE}"
    export SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST
    return
  fi

  if [[ "${SMOKE_LIFECYCLE_OWNER}" != "self" ]]; then
    echo "SOFTBOOK_CET_SMOKE_LIFECYCLE_OWNER must be self or external." >&2
    exit 1
  fi

  if [[ -z "${SMOKE_LIFECYCLE_MANIFEST}" ]]; then
    SMOKE_LIFECYCLE_MANIFEST="${ROOT_DIR}/exports/cloudbase-smoke/ios-$(date -u +%Y%m%dT%H%M%SZ)-$$/manifest.json"
  fi

  prepared="$(
    SOFTBOOK_CET_TEST_PHONE="${CONTRACT_TEST_PHONE}" \
    node "${ROOT_DIR}/infra/cloudbase/smoke-record-lifecycle.mjs" \
      prepare \
      --manifest "${SMOKE_LIFECYCLE_MANIFEST}" \
      --phone-count 1 \
      --format tsv
  )"
  IFS=$'\t' read -r CONTRACT_TEST_PHONE <<<"${prepared}"
  export SOFTBOOK_CET_TEST_PHONE="${CONTRACT_TEST_PHONE}"
  export SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST
  SMOKE_LIFECYCLE_ACTIVE="1"
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

require_binary_flag "SOFTBOOK_CET_IOS_LAUNCH" "${LAUNCH_IOS}"
require_binary_flag "SOFTBOOK_CET_SMOKE_ISOLATED_PHONE" "${ISOLATED_CONTRACT_PHONE}"
require_binary_flag "SOFTBOOK_CET_SMOKE_WRITE" "${SMOKE_WRITE}"
require_binary_flag \
  "SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS" \
  "${SMOKE_MEMBERSHIP_MUTATIONS}"
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

export SOFTBOOK_CET_SMOKE_WRITE="${SMOKE_WRITE}"
export SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS="${SMOKE_MEMBERSHIP_MUTATIONS}"
export SOFTBOOK_CET_SMOKE_ISOLATED_PHONE="${ISOLATED_CONTRACT_PHONE}"
export SOFTBOOK_CET_TEST_CODE="${SMS_CODE}"

if [[ "${LAUNCH_IOS}" == "1" ]]; then
  prepare_ios_launch_inputs
  echo "==> Resolving iOS launch target before remote smoke writes"
  resolve_ios_launch_target
fi

echo "==> Verifying JS runtime profile parsing"
(
  cd "${ROOT_DIR}/apps/mobile"
  npm test -- --runInBand --watchman=false __tests__/appRuntimeConfig.test.ts __tests__/installRuntimeConfig.test.ts
)

if [[ "${LAUNCH_IOS}" == "1" ]]; then
  echo "==> Building and installing iOS debug app before remote smoke writes"
  start_metro_if_needed
  (
    cd "${ROOT_DIR}/apps/mobile"
    SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
    SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
    SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
    SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
    npm run ios -- --udid "${RESOLVED_IOS_DEVICE}" --no-packager --port "${METRO_PORT}" --verbose
  )
  xcrun simctl get_app_container \
    "${RESOLVED_IOS_DEVICE}" \
    "${IOS_BUNDLE_ID}" \
    app >/dev/null
fi

prepare_smoke_lifecycle

echo "==> Verifying CloudBase REST contract for mobile runtime"
node "${ROOT_DIR}/infra/cloudbase/smoke-softbook-api.mjs"

if [[ "${LAUNCH_IOS}" != "1" ]]; then
  cat <<EOF
==> iOS launch skipped
automated_simulator_launch_verified=false
automated_simulator_ui_evidence_verified=false
automated_real_device_evidence_verified=false
gate_eligible=false

EOF
  exit 0
fi

echo "==> Relaunching iOS app with simulator child environment"
SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL="${SOFTBOOK_CET_REMOTE_BASE_URL}" \
SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_API_KEY="${SOFTBOOK_CET_REMOTE_API_KEY:-}" \
SIMCTL_CHILD_SOFTBOOK_CET_LEARNING_TRACK="${TRACK}" \
SIMCTL_CHILD_SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES="${SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES:-}" \
xcrun simctl launch --terminate-running-process "${RESOLVED_IOS_DEVICE}" "${IOS_BUNDLE_ID}"

cat <<EOF
==> Automated iOS Simulator launch verification complete
automated_simulator_launch_verified=true
automated_simulator_ui_evidence_verified=false
automated_real_device_evidence_verified=false
gate_eligible=false
EOF
