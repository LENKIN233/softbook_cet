# Agent Run Record: Android receiver-signed Release evidence

## Task summary

- Date: 2026-07-30
- Branch: `cross/android-signed-release`
- Summary: Added a fail-closed receiver-owned Android signed APK workflow that separates PR unsigned compilation from release signing, verifies the APK with Android SDK `apksigner`, binds the exact APK digest and size to a GitHub Release asset, removes private intermediate state before publishing a public evidence report, and makes launch-readiness reject generic replacement evidence. No receiver keystore was accessed, no real APK was signed or distributed, and no Android device result is claimed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
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
- The ignored, mode-0600 build state contains artifact identity but no password. Finalization requires an authenticated GitHub Release asset digest and size that match the locally verified APK, then removes the private state before publishing `android-signed-release.v1`.
- `android-distribution/release-signing` repository evidence is valid only when the dedicated report passes semantic validation and its human verifier and archive verification time match the readiness record.

## Workspace boundary and read scope

- Active scope: Android Gradle signing boundary, mobile operator command, signed-release evidence tool and tests, launch-readiness evidence validation, runtime delivery status, and this run record.
- No user-visible UI, card payload, audio asset, CloudBase data, personal database, receiver account, GitHub Release asset, signing keystore, password, or real-device state was modified.
- The branch is stacked on PR #460 (`cross/android-release-gate`) because its unsigned Android Release boundary is a prerequisite. It must not be merged independently before that base is on `main`.

## Files changed

- `apps/mobile/android/app/build.gradle`: explicit mutually exclusive signed/unsigned modes and fail-closed signing verification.
- `apps/mobile/package.json`, `apps/mobile/README.md`: signed-release command and receiver two-phase operating procedure.
- `scripts/build_android_signed_release.mjs`: private-state build verification, authenticated archive binding, public report, revalidation, and discard operations.
- `scripts/test_build_android_signed_release.mjs`, `scripts/test_android_release_boundary.mjs`: signing, secret, state, tamper, certificate, signature-scheme, CLI, and Gradle boundary regressions.
- `scripts/validate_launch_readiness.mjs`, `scripts/test_validate_launch_readiness.mjs`: semantic enforcement for Android release-signing evidence.
- `spec/runtime-boundaries.json`: local implementation status and receiver secret/evidence boundaries.

## Commands run

- `node --test scripts/test_build_android_signed_release.mjs scripts/test_android_release_boundary.mjs scripts/test_validate_launch_readiness.mjs` -> 30 tests passed.
- `node scripts/validate_launch_readiness.mjs` -> tracked contracts remained structurally valid and honestly not launch-ready.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/lenkin/Library/Android/sdk npm run android:release:unsigned` -> passed, 265 Gradle tasks, and produced the expected 56 MiB `app-release-unsigned.apk`.
- `./gradlew -p android :app:verifyReleaseSigningBoundary -PsoftbookRequireSignedRelease=true --no-daemon` without signing variables -> failed during configuration with `Signed Android release requires complete receiver signing configuration.` as required.
- `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK` with the remote required-check guard enabled.
- `scripts/run_local_gates --profile dev` -> 19/20 passed plus the declared dev-only Node 25.9.0 versus required 22.13.0 safe exception; no failed gate.
- `git diff --check` -> passed.

## Validation results

- Unit integration proves complete signing configuration can produce a mode-0600 state without leaking either test password, while partial configuration fails.
- `apksigner` parsing rejects v1-only output and more than one certificate identity.
- Finalization rejects a changed local APK, a mismatched or digest-less GitHub Release asset, a non-human verifier, and a private state whose artifact path was redirected.
- The public report is strict-schema, contains the exact APK/certificate hashes and signature schemes, and can be rechecked against GitHub asset metadata.
- Readiness evidence for `android-distribution/release-signing` cannot be replaced by a structurally unrelated file even if its outer SHA-256 and size are accurate.

## Binary evidence

- Evidence manifest: N/A
- Signed APK archive: N/A
- Reason: no receiver signing identity or release asset was supplied or used in this repository implementation task.

## Agent review status

- Reviewer: Codex
- Status: passed for the repository signing workflow and evidence-validation scope.
- Blocking findings: none in the implemented scope. Real receiver signing, archive upload, real-device smoke, and product-owner release approval remain explicit external acceptance work and are not represented as completed.
- Review summary: Mutating operations are restricted to exact clean `main`, signing secrets remain environment-only, the verified local artifact is bound to authenticated immutable release metadata, and launch-readiness validates the dedicated report rather than trusting an arbitrary hashed file. The workflow preserves the distinction between executable delivery tooling and actual receiver evidence.

## User-visible UI impact

- None. This branch changes build and delivery evidence only, so no new design artifact or design-review checklist is required.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not read or modified.

## Risks and open questions

- The workflow intentionally does not create or rotate a receiver keystore; the receiver must establish that operational policy outside the repository.
- GitHub Release must expose its authenticated `sha256:` asset digest. A missing digest fails closed rather than downloading and trusting an unbound mutable location.
- The implementation does not prove Play/AppGallery channel signing, installation, Android physical-device behavior, remote CloudBase behavior, SMS delivery, or content/audio readiness.
- PR #460 still requires formal product-owner approval and merge before this stacked branch can be rebased and opened as an independent PR.

## Follow-up

- After PR #460 merges, rebase only this branch's new commit(s) onto current `origin/main`, rerun full gates, open the PR, complete Agent review, and merge only when required checks and formal approval pass.
- In the receiver secure CI, perform the real `build --apply`, upload the exact APK to a GitHub Release, complete `finalize --apply` with a human verifier, commit the report, and update the external-account readiness evidence with the exact report hash, byte size, verifier, and timestamp.
- Run the archived signed APK on at least one real Android device through the remote main flow; retain that as separate device-matrix evidence rather than folding it into signing evidence.
