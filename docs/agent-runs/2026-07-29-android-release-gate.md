# Agent Run Record: Android release gate

## Task summary

- Date: 2026-07-29
- Branch: `cross/android-release-gate`
- Summary: Removed debug signing from Android Release, added receiver-owned environment-injected signing, added a JDK 17 Android Release CI gate, and added an Android remote Maestro entrypoint. No APK was signed, distributed, or run on a real Android device.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- iOS and Android have equal mobile priority and both must carry the main learning flow, review, physical space, core interactions, audio resources, and membership constraints.
- A repository debug keystore is not an acceptable receiver release identity.
- A successful compile does not prove a signed receiver build, production SMS delivery, remote runtime behavior, or real-device UX.

## Implementation hypothesis changed

- Android Release is unsigned when receiver signing variables are absent and fails closed on partial signing configuration.
- A receiver can inject its keystore path, store password, key alias, and key password through CI environment variables; none is stored in the repository.
- Pull-request CI compiles the unsigned Release APK on Temurin JDK 17 and verifies the expected artifact exists.
- Android remote smoke reuses the complete stable-selector remote flow through a dedicated Android Maestro entrypoint.

## Workspace boundary and read scope

- Active scope: Android Gradle configuration, mobile package scripts and operator README, Maestro harness, PR workflow, repository delivery governance, and focused regression tests.
- No user-visible screen, copy, layout, interaction, card payload, audio asset, CloudBase data, receiver secret, or signing keystore was changed.
- Generated Android build outputs remain ignored and are not product truth or committed evidence.

## Files changed

- `apps/mobile/android/app/build.gradle`: receiver release signing boundary and explicit verification task.
- `apps/mobile/package.json`, `apps/mobile/README.md`: unsigned Release build and Android smoke commands plus secret handling.
- `apps/mobile/e2e/maestro/android-remote-smoke.yaml`: Android remote full-flow entrypoint.
- `.github/workflows/pr-gates.yml`: JDK 17 unsigned Android Release job.
- `.github/pull_request_template.md`: Android Release validation item.
- `scripts/test_android_release_boundary.mjs`: signing, CI, and smoke-entry regressions.
- `scripts/harness_validator/sections/governance_contracts.py`, `scripts/test_validate_harness_runner.py`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`: required-check governance.

## Commands run

- `node --test scripts/test_android_release_boundary.mjs` -> 3 tests passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/test_validate_harness_runner.py` -> 21 tests passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 18 tests passed.
- `python3 scripts/validate_harness.py --skip-remote-guard --format text` -> repository-local validation passed; completeness is partial because the remote guard was intentionally skipped until branch protection registers the new check.
- `./gradlew :app:verifyReleaseSigningBoundary --no-daemon` with the available JDK 26 -> passed and reported an unsigned CI artifact.
- The same task with only `SOFTBOOK_ANDROID_RELEASE_STORE_FILE` set -> failed with `Android release signing is partially configured.` as required.
- Baseline `./gradlew :app:assembleRelease --no-daemon` with JDK 26 -> failed in Android JDK image transformation; this is why CI pins JDK 17 and is not recorded as a passing build.
- `git diff --check` -> passed.
- `scripts/run_local_gates --profile dev` -> 19/20 passed plus the declared dev-only Node 25.9.0 versus required 22.13.0 safe exception; no failed gate.

## Validation results

- Static and Gradle regressions prevent Android Release from falling back to `signingConfigs.debug`.
- Missing receiver signing variables produce an unsigned build plan; one to three configured values fail during Gradle configuration; four values require an existing store file and select the receiver release signing config.
- The Android Maestro entrypoint points to the full remote login, Learning, five-interaction, Space, and Statistics selector flow.
- The actual JDK 17 `assembleRelease` result remains delegated to the new GitHub `android-release` job and must be green before merge.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none in the signing/configuration/CI harness scope; the remote Android Release build remains a required merge gate.
- Review summary: The previous Release-to-debug-keystore fallback was a delivery defect. The new boundary separates unsigned PR compilation from receiver-owned signing, fails closed on partial configuration, and adds a repeatable Android compile check without claiming device acceptance.

## User-visible UI impact

- N/A. No screen, visual state, interaction behavior, accessibility behavior, or product copy changed.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not modified by this branch.

## Risks and open questions

- No compatible JDK 17 is installed in the local shell, so the full Release build must be proven by the pinned remote job.
- No receiver keystore or signed AAB/APK exists; receiver signing and distribution remain external release evidence.
- No Android emulator or physical device smoke was run. The dedicated flow is an executable acceptance artifact, not a passing result.
- Production SMS, final CET4 content/audio evidence, remote synchronization, background/interruption audio behavior, and real-device accessibility remain separate gates.

## Follow-up

- Require `android-release` in `main` branch protection after the job is registered and verify the full remote harness against that setting.
- Run the Android remote Maestro flow on at least one emulator and one physical device after a receiver runtime and lifecycle-managed SMS account exist.
- Build the receiver-signed closed-beta artifact in secure CI and record its signing identity and SHA-256 without storing the keystore or passwords.
