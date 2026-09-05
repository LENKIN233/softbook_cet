#!/usr/bin/env bash
set -euo pipefail
[[ "${CI:-}" == "true" ]] || { echo 'CI-only: use an explicit disposable device with run_experience_acceptance.mjs locally.'; exit 2; }
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
: "${RUNNER_TEMP:?}"
case "${1:-}" in
  prepare)
    # Hosted runner devices are disposable; select an available iPhone runtime.
    device_id="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=[x for v in json.load(sys.stdin)["devices"].values() for x in v if x["name"].startswith("iPhone")]; assert d, "No iPhone Simulator available"; print(d[0]["udid"])')"
    echo "SOFTBOOK_EXPERIENCE_DEVICE_ID=$device_id" >> "${GITHUB_ENV:?}"
    xcrun simctl boot "$device_id" || xcrun simctl bootstatus "$device_id" -b
    xcrun simctl bootstatus "$device_id" -b
    ;;
  build)
    device_id="${SOFTBOOK_EXPERIENCE_DEVICE_ID:?}"
    # Keychain needs the simulated application identifier from local ad-hoc signing.
    # The separate distribution builds retain their Release signing boundary.
    RCT_NO_LAUNCH_PACKAGER=1 xcodebuild \
      -workspace apps/mobile/ios/SoftbookCET.xcworkspace -scheme SoftbookCET \
      -configuration Debug -destination "id=$device_id" \
      -derivedDataPath "$RUNNER_TEMP/softbook-experience-derived" \
      CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build \
      2>&1 | tee "$RUNNER_TEMP/experience-build.log"
    xcrun simctl install "$device_id" "$RUNNER_TEMP/softbook-experience-derived/Build/Products/Debug-iphonesimulator/SoftbookCET.app"
    ;;
  run)
    device_id="${SOFTBOOK_EXPERIENCE_DEVICE_ID:?}"
    npm --prefix apps/mobile start -- --port 8081 > "$RUNNER_TEMP/experience-metro.log" 2>&1 &
    metro_pid=$!
    trap 'kill "$metro_pid" 2>/dev/null || true; xcrun simctl shutdown "$device_id" 2>/dev/null || true' EXIT
    ready=false
    for attempt in {1..60}; do
      kill -0 "$metro_pid"
      if curl --max-time 2 --silent --fail http://127.0.0.1:8081/status | grep -q packager-status:running; then ready=true; break; fi
      sleep 1
    done
    if [[ "$ready" != true ]]; then
      echo 'Metro did not become ready within the bounded startup window.' >&2
      tail -50 "$RUNNER_TEMP/experience-metro.log" >&2
      exit 1
    fi
    # Use the URL observed from RCTBundleURLProvider. Cold Metro compilation is
    # environment preparation, not time spent finding the first app control.
    echo 'Preparing the iOS development bundle before the UI journey.'
    curl --connect-timeout 2 --max-time 180 --fail --show-error --silent \
      'http://localhost:8081/index.bundle?platform=ios&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=com.softbook.cet' \
      --output "$RUNNER_TEMP/experience-ios.bundle"
    node scripts/run_experience_acceptance.mjs --device "$device_id" --output "$RUNNER_TEMP/softbook-experience"
    ;;
  *) echo 'Usage: run_ios_experience_ci.sh prepare|build|run' >&2; exit 2 ;;
esac
