#!/usr/bin/env bash
set -euo pipefail
[[ "${CI:-}" == "true" ]] || { echo 'CI-only: use an explicit disposable device with run_experience_acceptance.mjs locally.'; exit 2; }
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
output_dir="${RUNNER_TEMP:?}/softbook-experience"
# Hosted runner devices are disposable; select an available iPhone runtime.
device_id="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=[x for v in json.load(sys.stdin)["devices"].values() for x in v if x["name"].startswith("iPhone")]; assert d, "No iPhone Simulator available"; print(d[0]["udid"])')"
xcrun simctl boot "$device_id" || xcrun simctl bootstatus "$device_id" -b
xcrun simctl bootstatus "$device_id" -b
npm --prefix apps/mobile start -- --port 8081 > "$RUNNER_TEMP/experience-metro.log" 2>&1 &
metro_pid=$!
trap 'kill "$metro_pid" 2>/dev/null || true; xcrun simctl shutdown "$device_id" 2>/dev/null || true' EXIT
for attempt in {1..60}; do
  if curl --silent --fail http://127.0.0.1:8081/status | grep -q packager-status:running; then break; fi
  kill -0 "$metro_pid"
  sleep 1
done
curl --silent --fail http://127.0.0.1:8081/status
xcodebuild -workspace apps/mobile/ios/SoftbookCET.xcworkspace -scheme SoftbookCET \
  -configuration Debug -destination "id=$device_id" \
  -derivedDataPath "$RUNNER_TEMP/softbook-experience-derived" CODE_SIGNING_ALLOWED=NO build \
  > "$RUNNER_TEMP/experience-build.log" 2>&1
xcrun simctl install "$device_id" "$RUNNER_TEMP/softbook-experience-derived/Build/Products/Debug-iphonesimulator/SoftbookCET.app"
node scripts/run_experience_acceptance.mjs --device "$device_id" --output "$output_dir"
