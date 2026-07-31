# Agent Run Record: Android receiver-signed Release evidence

## Task summary

- Date: 2026-07-30; rebased and revalidated against current `origin/main` on 2026-08-01
- Branch: `cross/android-signed-release`
- Base: `origin/main` at `345b01483896ea39cb9e8ed42b4b1ba0608c7486`
- Summary: Added a fail-closed receiver-owned Android signed APK workflow that separates PR unsigned compilation from release signing, verifies the APK with Android SDK `apksigner`, binds the exact APK digest and size to a GitHub Release asset, removes private intermediate state before publishing a public raw report, and requires the report to sit inside the current typed `external-capability-evidence.v1` policy wrapper. No receiver keystore was accessed, no real APK was signed or distributed, and no Android device result is claimed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `docs/agent-runs/2026-07-29-android-release-gate.md`

## Product truth used

- iOS and Android have equal mobile priority; Android cannot be called deliverable solely because an unsigned PR artifact compiles.
- Receiver signing identity and secrets belong to the receiver environment and must not enter the repository or personal database.
- A passing repository test is not a receiver-signed binary, archived release, physical-device result, or launch approval.

## Implementation hypothesis changed

- Gradle now exposes mutually exclusive explicit signed and unsigned Release modes. Signed mode requires all four receiver signing values; unsigned mode rejects them.
- `scripts/build_android_signed_release.mjs` implements `build`, `finalize`, `verify`, and `discard` operations. Mutating build/finalize operations require clean `main` exactly equal to `origin/main`.
- A signed build is accepted only after `apksigner verify --verbose --print-certs --Werr` reports exactly one signing certificate and APK Signature Scheme v2 or newer.
- The ignored, mode-0600 build state contains artifact identity but no password. Private state and public reports use strict JSON; exclusive randomized temporary files, regular-file checks, path confinement, and symbolic-link rejection protect their write/read boundaries. Finalization requires an authenticated GitHub Release asset digest and size that match the locally verified APK, then removes the private state before publishing `android-signed-release.v1`.
- `android-distribution/release-signing` is capability-eligible but never gate-eligible through this report alone. Its repository evidence must be `external-capability-evidence.v1`, satisfy the exact operational policy checks, rehash all tracked raw artifacts, and contain exactly one semantic `android-signed-release.v1` raw report bound to the reachable commit, product-owner verifier, archive/observation time, and hashed receiver target.

## Workspace boundary and read scope

- Active scope: Android Gradle signing boundary, mobile operator command, signed-release evidence tool and tests, launch-readiness evidence validation, runtime delivery status, and this run record.
- No user-visible UI, card payload, audio asset, CloudBase data, personal database, receiver account, GitHub Release asset, signing keystore, password, or real-device state was modified.
- PR #460's unsigned Android Release prerequisite is already merged on current `main`; this branch was rebased directly onto that integrated history.

## Files changed

- `apps/mobile/android/app/build.gradle`: explicit mutually exclusive signed/unsigned modes and fail-closed signing verification.
- `apps/mobile/package.json`, `apps/mobile/README.md`: signed-release command and receiver two-phase operating procedure.
- `scripts/build_android_signed_release.mjs`: private-state build verification, authenticated archive binding, public report, revalidation, and discard operations.
- `scripts/test_build_android_signed_release.mjs`, `scripts/test_android_release_boundary.mjs`: signing, secret, state, tamper, certificate, signature-scheme, CLI, and Gradle boundary regressions.
- `scripts/validate_launch_readiness.mjs`, `scripts/test_validate_launch_readiness.mjs`: semantic enforcement for Android release-signing evidence.
- `spec/runtime-boundaries.json`: local implementation status and receiver secret/evidence boundaries.

## Commands run

- `node --test scripts/test_build_android_signed_release.mjs scripts/test_android_release_boundary.mjs scripts/test_validate_launch_readiness.mjs` -> 51 tests passed.
- `node scripts/validate_launch_readiness.mjs` -> repository evidence was valid; launch remained honestly not ready with 5 pending, 5 blocked, and 0 passed gates.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 206 tests passed.
- `npm test -- --runInBand` in `apps/mobile` -> 44 suites and 424 tests passed.
- `npm run lint` in `apps/mobile` -> passed with 0 errors and 14 pre-existing inline-style warnings.
- `npm run typecheck` in `apps/mobile` -> passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API had 0 known vulnerabilities.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/lenkin/Library/Android/sdk npm run android:release:unsigned` -> passed in 1m04s, 265 Gradle tasks, and produced the expected unsigned Release APK.
- `./gradlew -p android :app:verifyReleaseSigningBoundary -PsoftbookRequireSignedRelease=true --no-daemon` without signing variables -> failed during configuration with `Signed Android release requires complete receiver signing configuration.` as required.
- `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK` with the remote required-check guard enabled.
- `scripts/run_local_gates --profile dev` -> 19/20 passed plus the declared dev-only Node 25.9.0 versus required 22.13.0 safe exception; 0 failed gates; report `exports/local-gates/20260731T211911Z-d37834bf-dev-70988/report.json`.
- `git diff --check` -> passed.

## Validation results

- Unit integration proves complete signing configuration can produce a mode-0600 state without leaking either test password, while partial configuration fails.
- `apksigner` parsing rejects v1-only output and more than one certificate identity.
- Finalization rejects a changed local APK, a mismatched or digest-less GitHub Release asset, a non-human verifier, duplicate-key JSON, symbolic-link traversal, and a private state whose artifact path was redirected.
- The public report is strict-schema, contains the exact APK/certificate hashes and signature schemes, and can be rechecked against GitHub asset metadata.
- Readiness evidence for `android-distribution/release-signing` cannot use a bare signed-release report or a structurally unrelated file. The typed wrapper, policy checks, tracked raw artifacts, hashes, commit, verifier, time, and target bindings are all validated independently.

## Binary evidence

- Evidence manifest: N/A
- Signed APK archive: N/A
- Reason: no receiver signing identity or release asset was supplied or used in this repository implementation task.

## Agent review status

- Reviewer: Codex
- Status: passed for the repository signing workflow and evidence-validation scope.
- Blocking findings: none in the implemented scope. Real receiver signing, archive upload, real-device smoke, and product-owner release approval remain explicit external acceptance work and are not represented as completed.
- Review summary: Mutating operations are restricted to exact clean `main`, signing secrets remain environment-only, strict/exclusive file handling fails closed, the verified local artifact is bound to authenticated immutable release metadata, and launch-readiness validates the typed capability wrapper plus dedicated raw report rather than trusting an arbitrary hashed file. The workflow preserves the distinction between executable delivery tooling and actual receiver evidence.

## User-visible UI impact

- None. This branch changes build and delivery evidence only, so no new design artifact or design-review checklist is required.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not read or modified.

## Risks and open questions

- The workflow intentionally does not create or rotate a receiver keystore; the receiver must establish that operational policy outside the repository.
- GitHub Release must expose its authenticated `sha256:` asset digest. A missing digest fails closed rather than downloading and trusting an unbound mutable location.
- The implementation does not prove Play/AppGallery channel signing, installation, Android physical-device behavior, remote CloudBase behavior, SMS delivery, or content/audio readiness.
- A passing repository workflow still does not satisfy keystore custody, backup custody, channel distribution, device installation, or launch gates; those remain external evidence.

## Follow-up

- Open the PR from this rebased branch, complete Agent review and required checks, and merge only when formal approval and all required checks pass.
- In the receiver secure CI, perform the real `build --apply`, upload the exact APK to a GitHub Release, complete `finalize --apply` with a human verifier, commit the raw report, and wrap it in exact `external-capability-evidence.v1` evidence with the required custody/current-state checks and tracked raw artifacts.
- Run the archived signed APK on at least one real Android device through the remote main flow; retain that as separate device-matrix evidence rather than folding it into signing evidence.
