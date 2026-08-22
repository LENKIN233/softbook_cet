# Agent Run Record: installed-client minimum-version enforcement

## Task summary

- Date: 2026-08-22
- Branch: `module/installed-client-min-version-v1`
- PR: https://github.com/LENKIN233/softbook_cet/pull/510
- Summary: Add fail-closed comparison of the actual installed native iOS or
  Android version against remote Bootstrap release metadata and the independently
  verified signed content manifest, without treating repository tests as
  deployment or real-device evidence.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- No product definition changes. Softbook remains an authenticated CET4/6
  single-card learning product with shared account state, physical Space, and
  audio attached to cards rather than treated as an interaction family.
- Remote release content must fail closed when the installed app cannot safely
  consume it. A valid minimum-version string alone is not evidence that the
  installed client meets that minimum.
- Controlled-pilot artifacts and repository acceptance remain
  `gate_eligible=false`; they cannot replace formal CET4 whole-track approval,
  complete identified-human audio QC, receiver deployment, device evidence, or
  closed-beta/launch evidence.

## Implementation hypothesis changed

- iOS and Android expose synchronous `NativeModules.SoftbookAppInfo` constants
  with the actual native `platform` and release `version`. The JS boundary
  requires the native platform to match React Native `Platform.OS`.
- Installed and minimum values use strict semantic versions with a required
  `x.y.z` core. Comparison follows semantic-version prerelease precedence:
  numeric identifiers compare numerically, alphanumeric identifiers compare
  lexically, and stable releases sort after prereleases. Missing components are
  never filled and a native value such as `1.0` is never coerced to `1.0.0`.
- Remote Bootstrap parses its exact response first, then applies the actual
  native platform minimum before returning canonical state. Failure therefore
  precedes App hydration, mutation replay, learning enablement, and
  product-state writes. Development/null-release content skips only because it
  has no release minimum; fully local runtime does not read native identity.
- The content-manifest repository parses the exact formal or controlled-pilot
  wire shape and verifies the pinned-key Ed25519 signature before it trusts or
  compares the signed minimum. It then independently rejects missing, invalid,
  mismatched, unsupported, or below-minimum native identity before returning a
  verified manifest to Learning.
- The in-memory controlled-pilot mobile acceptance report deliberately retains
  `installed_client_minimum_version_enforced=false`; an injected/mocked
  repository path is not an installed release or real-device proof.

## Workspace boundary and read scope

- Active truth/source read: the listed specs and runtime contracts; current
  mobile Bootstrap, content-manifest, runtime configuration, native iOS/Android
  bridge, release-build tooling, and focused tests.
- Generated/dependency/cache/archive read: dependency trees may be installed
  from committed lockfiles for validation only; generated build outputs and
  local caches are not product or release truth.
- External workspace read: none. `/Users/lenkin/programing/card make` content,
  approvals, and audio-QC records are outside this runtime task and are not
  modified.

## Files changed

- `apps/mobile/src/runtime/installedClientVersion.ts` and
  `apps/mobile/__tests__/installedClientVersion.test.ts`: strict installed
  native identity read, validation, semantic-version comparison, and minimum
  gate.
- `apps/mobile/src/bootstrap/accountBootstrapRepository.ts`, its repository
  tests, and runtime-config tests: early remote Bootstrap gate before returning
  the canonical snapshot and default native-provider wiring.
- `apps/mobile/src/audio/contentManifestRepository.ts`,
  `contentManifestRuntimeConfig.ts`, `apps/mobile/src/learning/learningRepository.ts`,
  their focused tests, and the controlled-pilot acceptance fixture: independent
  signed-manifest gate after Ed25519 verification with an injectable test-only
  identity provider.
- `apps/mobile/android/app/src/main/java/com/softbook/cet/runtime/SoftbookAppInfoModule.kt`,
  `SoftbookAudioPlayerPackage.kt`, and `apps/mobile/android/app/build.gradle`:
  register the synchronous native module and expose actual
  `BuildConfig.VERSION_NAME` as Android `1.0.0`.
- `apps/mobile/ios/SoftbookCET/SoftbookAppInfo.m` and
  `apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj`: expose
  `CFBundleShortVersionString` and use iOS marketing version `1.0.0`.
- `scripts/build_android_signed_release.mjs` and
  `scripts/test_build_android_signed_release.mjs`: require a strict stable
  three-part Android `version_name` in source identity, private release state,
  and public signed-release evidence.
- `scripts/test_validate_launch_readiness.mjs`: keep the valid Android signing
  evidence fixture aligned with the native `1.0.0` identity.
- `infra/cloudbase/release-delivery-v1.mjs` and its backend contract tests:
  validate release-profile minimums as strict semantic versions and preserve
  full prerelease precedence when selecting the single formal minimum from the
  iOS/Android values.
- `spec/runtime-boundaries.json`, `infra/cloudbase/bootstrap-v2-runtime-contract.md`,
  `infra/cloudbase/content-manifest-v1-runtime-contract.md`,
  `infra/cloudbase/mobile-runtime-contract.md`, and
  `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`: record the local
  implementation and preserve deployment, device, QC, and gate non-claims.
- `docs/agent-runs/2026-08-22-installed-client-minimum-version.md`: this durable
  run record.

## Commands run

- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed 47
  suites and 530 tests; the pretest metadata and dependency compatibility scans
  also passed.
- `node --test scripts/test_build_android_signed_release.mjs` -> passed 11/11,
  including rejection of two-part and leading-zero Android release versions.
- `node --test scripts/test_validate_launch_readiness.mjs` -> passed 38/38.
- `node --test test/release-delivery-v1.test.js` in the CloudBase backend ->
  passed 15/15, including official prerelease ordering, malformed-input
  rejection, and `beta.11 > beta.2` publisher selection.
- JDK 17 `./gradlew :app:compileDebugKotlin --no-daemon` in
  `apps/mobile/android` -> `BUILD SUCCESSFUL`; generated
  `BuildConfig.VERSION_NAME` is `1.0.0`.
- `xcodebuild -quiet -workspace ios/SoftbookCET.xcworkspace -scheme SoftbookCET
  -configuration Release -sdk iphonesimulator -destination
  'generic/platform=iOS Simulator' -derivedDataPath
  /private/tmp/softbook-app-info-ios-derived CODE_SIGNING_ALLOWED=NO
  CODE_SIGNING_REQUIRED=NO build` in `apps/mobile` -> exit 0. The built app has
  `CFBundleIdentifier=com.softbook.cet` and
  `CFBundleShortVersionString=1.0.0`; `SoftbookAppInfo.o` exists for arm64 and
  x86_64.
- `python3 scripts/validate_harness.py --mode full` -> `HARNESS VALIDATION OK`
  with the remote repository guard executed.
- `./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/installed-client-min-version-dev.json` -> final run passed
  24/24, including mobile, Web, CloudBase backend, governance, metadata, build,
  and tracked-worktree checks. The first run correctly exposed one stale
  two-part Android evidence fixture and absent worktree dependency trees; the
  fixture was corrected, locked dependencies were installed, and the final run
  passed without exceptions.
- `node scripts/validate_agent_run_evidence.mjs` -> passed with no evidence
  manifests introduced by this task.
- `jq empty spec/runtime-boundaries.json` and `git diff --check` -> passed.

## Validation results

- Strict semantic-version comparison, native identity failure modes, local and
  development non-read boundaries, Bootstrap early rejection, controlled-pilot
  platform selection, and post-signature manifest ordering all passed focused
  tests and the complete mobile suite.
- Full mobile lint/typecheck/Jest, Web lint/typecheck/Vitest/build, CloudBase
  backend tests, launch-governance tests, full remote-aware harness, Android
  Kotlin compilation, and iOS Release simulator build passed.
- Runtime-boundary JSON parsing, run-record/evidence validation, metadata scans,
  workspace integrity, and whitespace validation passed.
- Deployment and real-device proof: not run and not claimed.
- Controlled-pilot in-memory acceptance capability remains
  `installed_client_minimum_version_enforced=false`; `gate_eligible=false` is
  unchanged.

## Binary evidence

- Evidence manifest: N/A. The local simulator/compile outputs are generated
  validation artifacts only; no screenshot, recording, app binary, or device
  artifact is retained or promoted as release evidence.
- Archive: N/A.

## Agent review status

- Reviewer: independent Codex review agent `/root/min_version_review`.
- Status: Passed.
- Blocking findings: None. The review initially found that formal release
  delivery used lexical prerelease ordering and accepted non-strict inputs; the
  comparator, validation, and regression tests were corrected, then the reviewer
  independently reran the focused suite and passed the final diff.

## User-visible UI impact

- No screen, layout, interaction family, motion, navigation, copy, or visual
  token changes.
- Unsupported remote releases fail before canonical product state is returned;
  this task adds no new user-facing upgrade screen and makes no screenshot or
  device-rendering claim.

## Card make external workspace impact

- None. No candidate card, review, approval, audit, audio asset, or audio-QC
  record is read, created, or modified.

## Risks and open questions

- Repository tests and simulator builds do not prove that a
  receiver-distributed iOS/Android binary exposes the expected native constants
  on a physical device.
- Production content-manifest public-key values, release injection, receiver
  deployment, private audio delivery/playback, formal content approval, and
  identified-human audio QC remain separate incomplete work.
- The controlled-pilot acceptance runner remains intentionally incapable of
  making a native installed-version claim; its false capability flag must not
  be flipped by mocked JS coverage.

## Follow-up

- Publish the PR and merge only after its required GitHub checks pass.
- In a receiver-owned environment, inject the release key, deploy the exact
  runtime, install signed iOS/Android builds, and capture real-device evidence
  for equal/above-minimum acceptance and below-minimum fail-closed behavior.
