# Agent Run Record: iOS runtime device target

## Task summary

- Date: 2026-07-28
- Branch: `infra/ios-runtime-device-target`
- PR: https://github.com/LENKIN233/softbook_cet/pull/451
- Summary: Make the local iOS CloudBase and Maestro acceptance wrappers resolve one exact Simulator UDID, fail before remote writes when local prerequisites fail, and preserve unfiltered React Native build diagnostics.

## Referenced specs

- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Remote iOS acceptance must preserve the existing authentication, learning, membership, synchronization, and physical-space contracts.
- A development CloudBase deployment or smoke result is not production readiness, formal content approval, or launch readiness.
- Product truth and user-visible behavior are unchanged by this tooling change.

## Implementation hypothesis changed

- Local iOS acceptance now resolves one available Simulator to an exact UDID and uses that same UDID for uninstall, React Native build/install, `simctl launch`, and Maestro.
- Launch inputs, target resolution, JS runtime-profile tests, the debug build, and installed app lookup must pass before the wrapper starts its remote write smoke; Maestro also preflights its flow, Java runtime, and CLI.
- A wrapper-started Metro process is stopped after a failed build or interruption; a reused Metro process remains outside wrapper ownership.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, the referenced specs, `.github/workflows/pr-gates.yml`, `README.md`, `infra/cloudbase/README.md`, `infra/cloudbase/smoke-ios-runtime.sh`, `infra/cloudbase/smoke-ios-maestro-runtime.sh`, `scripts/local_gates/catalog.py`, and related tests.
- Generated/dependency/cache/archive read: ignored local gate and CloudBase probe reports needed to diagnose the failed iOS acceptance and confirm cleanup; no generated artifact was committed.
- External workspace read: none.

## Files changed

- `infra/cloudbase/resolve-ios-simulator.mjs`: add deterministic Simulator inventory parsing, exact target resolution, structured output, and fail-closed CLI behavior.
- `infra/cloudbase/test-resolve-ios-simulator.mjs`: cover target precedence, ambiguity, unavailable devices, CLI exit codes, launch order, local preflight failures, and Maestro device pinning.
- `infra/cloudbase/smoke-ios-runtime.sh`: resolve and boot one target, build with `--udid --verbose` before remote writes, and clean up owned Metro processes on failure.
- `infra/cloudbase/smoke-ios-maestro-runtime.sh`: pin uninstall, runtime launch, and Maestro to the same resolved UDID.
- `scripts/local_gates/catalog.py`, `scripts/test_run_local_gates.py`, `.github/workflows/pr-gates.yml`: add the resolver regression suite to local and GitHub gates.
- `README.md`, `infra/cloudbase/README.md`: document target selection, execution order, diagnostics, and process ownership.

## Commands run

- `node --test infra/cloudbase/test-resolve-ios-simulator.mjs` -> 14 tests passed.
- `bash -n infra/cloudbase/smoke-ios-runtime.sh` -> passed.
- `bash -n infra/cloudbase/smoke-ios-maestro-runtime.sh` -> passed.
- `python3 -m unittest discover -s scripts -p 'test_*.py'` -> 94 tests passed.
- `node --test scripts/test_check_design_metadata_leaks.mjs scripts/test_validate_launch_readiness.mjs infra/cloudbase/test-resolve-ios-simulator.mjs` with Node 22.13.0 -> 30 tests passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed with full remote semantics.
- Mobile metadata scans, lint, typecheck, and Jest with Node 22.13.0 -> passed; 39 suites and 371 Jest tests passed.
- CloudBase function `npm test` with Node 22.13.0 -> 137 tests passed.
- `scripts/run_local_gates --profile dev` -> report failed before command gates because this managed Codex sandbox rejects nested `sandbox-exec` with exit 71; the same catalog commands were run directly and passed.
- Live `resolve-ios-simulator.mjs` against `simctl` -> failed closed before remote writes because CoreSimulatorService is unavailable to the current Codex process.

## Validation results

- Resolver and wrapper regression coverage passes on Node 22.13.0.
- Existing Harness, launch contract, metadata, mobile, and backend behavior remains green when invoked directly.
- Launch readiness remains structurally valid and honestly reports `ready=false`.
- A real iOS debug build and Maestro run has not passed in the current environment; no result in this record claims otherwise.
- The tracked worktree remained unchanged outside the listed files during validation.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: pending
- Status: pending
- Blocking findings: formal Agent review and GitHub required checks have not run yet.

## User-visible UI impact

- N/A. No product screen, interaction, or visual authority changed.

## Card make external workspace impact

- N/A. The external content workspace was not read or modified.

## Risks and open questions

- CoreSimulatorService is unavailable from the current managed Codex process, so the exact host Xcode failure cannot yet be reproduced with the new verbose path.
- The remote contract smoke still creates isolated development records after it begins. Exact post-run cleanup is currently operational and must be automated in a separate guarded change.
- The development CloudBase runtime is not a production backend and does not satisfy launch readiness.

## Follow-up

- Complete Agent review and required GitHub checks, then merge only if both pass.
- Rerun the full remote iOS Maestro acceptance on a host process with working CoreSimulator access, clean exact test records, and verify the CloudBase collection baseline.
- Add fail-safe, exact-scope automatic cleanup for development remote smoke records without exposing a production deletion surface.
