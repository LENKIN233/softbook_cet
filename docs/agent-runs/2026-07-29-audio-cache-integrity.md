# Agent Run Record: Audio cache integrity

## Task summary

- Date: 2026-07-29
- Branch: `module/audio-cache-integrity`
- PR: `#454` (`https://github.com/LENKIN233/softbook_cet/pull/454`)
- Summary: Added a release-key configuration boundary and a native content-addressed audio cache that verifies byte length and SHA-256 before returning a local file. This does not add playback or claim production readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Audio remains a required card resource and is not a separate interaction family.
- Audio must never autoplay; visible playback controls and transcript presentation remain governed by the accepted design and interaction contracts.
- Content and membership authority remain server-side. A client cache may verify and retain authorized bytes but cannot grant access or formal content approval.

## Implementation hypothesis changed

- Remote content-manifest mode now requires a release-supplied, allowlisted Ed25519 public-key map and remote authentication; missing configuration fails closed.
- `react-native-blob-util@0.24.10` provides direct-to-file native download, stat, move, removal, and SHA-256 operations on iOS and Android.
- The cache uses only signed content hashes in paths, verifies exact byte length and SHA-256 on hits and completed downloads, uses unique partial files, rejects non-200 responses and insecure URL/redirect chains, removes corrupt files, and deduplicates compatible in-process requests.
- Cache eviction, manifest-to-learning wiring, playback state, visible controls, device smoke, production key values, and Android native release-property injection remain pending.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, task-relevant specs and runtime contracts, mobile runtime/audio sources and tests, local-gate definitions, and delivery/run-record contracts.
- Generated/dependency/cache/archive read: targeted installed `react-native-blob-util` metadata, React Native autolink output, Gradle and CocoaPods build output, and ignored local-gate reports only for integration verification.
- External workspace read: none. `/Users/lenkin/programing/card make` was not accessed.

## Files changed

- `apps/mobile/src/audio/contentAssetCache.ts`: add the pure cache and integrity boundary.
- `apps/mobile/src/audio/reactNativeContentAssetCache.ts`: adapt native cache-directory, download, file, and hash APIs.
- `apps/mobile/src/audio/contentManifestRuntimeConfig.ts`: resolve remote manifest configuration through remote auth and a pinned release keyring.
- `apps/mobile/src/runtime/appRuntimeConfig.ts`, `apps/mobile/src/learning/learningRuntimeConfig.ts`, `apps/mobile/ios/SoftbookCET/AppDelegate.swift`: carry the manifest feature mode and public keys without persisting private material.
- `apps/mobile/package.json`, `apps/mobile/package-lock.json`, `apps/mobile/ios/Podfile.lock`, `apps/mobile/ios/SoftbookCET/PrivacyInfo.xcprivacy`: pin and integrate the native file dependency and its required-reason API declarations.
- Mobile tests: cover cache hits, corruption, HTTP and expiry failures, post-move verification, caller validation, shared hashes, native directory races, and real signature verification from runtime configuration.
- Metadata scanners, runtime contracts, README, and `spec/runtime-boundaries.json`: register the new runtime field and document implemented versus pending boundaries.

## Commands run

- `cd apps/mobile && npm install --save-exact react-native-blob-util@0.24.10` -> installed; npm reported zero vulnerabilities.
- `cd apps/mobile && PATH=/opt/homebrew/opt/ruby@3.3/bin:$PATH bundle exec pod install --project-directory=ios` -> passed with native autolinking and New Architecture codegen discovery.
- `cd apps/mobile/android && JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home ANDROID_HOME=/Users/lenkin/Library/Android/sdk ./gradlew :app:assembleRelease` -> passed, 265 tasks.
- `cd apps/mobile && npm test -- --runInBand --watchAll=false --no-watchman` -> 43 suites and 394 tests passed.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm run lint -- --quiet` -> passed.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 141 tests passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- Harness runner, learning contract, module boundary, local-gate runner, Maestro, iOS target, smoke lifecycle, design scanner, and launch contract tests -> 131 tests/checks passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API reported zero known vulnerabilities.
- `node scripts/validate_launch_readiness.mjs` -> contract valid and honestly `ready=false`.
- `./scripts/run_local_gates --profile dev --output exports/local-gates/audio-cache-integrity-dev.json` -> failed closed at network isolation because the managed Codex process cannot start nested `sandbox-exec`; remaining gates were deferred and were run individually where possible.
- local `xcodebuild` workspace probe -> unavailable because the managed process cannot connect to CoreSimulatorService; GitHub macOS CI remains required.

## Validation results

- Android Release packaging and both native-platform autolink discovery succeeded.
- Cache paths contain no asset ID, URL, token, account, or phone data; expiring URLs are not persisted and native redirects must remain credential-free HTTPS.
- Every returned local file has been checked against the signed manifest byte length and SHA-256. Corrupt hits and failed partial/final files are removed.
- Concurrent requests sharing a hash join only after each caller's asset/download identity is validated and declared byte lengths agree.
- Product launch readiness remains false and formal content approval remains unchanged.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none.
- Review summary: The review found and corrected per-caller validation bypass while joining a shared hash, a native cache-directory creation race, and unchecked HTTPS redirect downgrade. Regression coverage was added for each boundary; no code-level blocking finding remains. GitHub required checks are still mandatory before merge.

## User-visible UI impact

- N/A. No audio button, progress, transcript, playback, or other visible behavior is introduced.

## Card make external workspace impact

- N/A. No candidate or approved content was read, produced, changed, or imported.

## Risks and open questions

- Production public-key values and native release injection are not registered. Private signing keys must remain outside Git.
- The cache is not connected to a learning session or player and has not downloaded a real private CloudBase object on a physical device.
- Cache eviction policy is pending; the implementation currently relies on the operating-system cache directory.
- Local iOS build execution is blocked by the current managed process's CoreSimulatorService isolation; required GitHub iOS checks must pass before merge.

## Follow-up

- Register the production/staging public-key delivery path, connect the verified cache to the manifest-backed learning runtime, then implement the accepted explicit playback state and inline UI in a separate reviewed change.
