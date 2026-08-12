# Agent Run Record: controlled pilot bundle builder v1

## Task summary

- Date: 2026-08-12
- Branch: `cross/controlled-pilot-bundle-builder-v1`
- PR: pending
- Summary: Added a production, dry-run-first assembler that converts the exact approved CET4 120-card candidate handoff and complete formal audio QC into a publisher-verified controlled-pilot bundle.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Candidate card production and approval remain in the external `card make` workspace; this repository consumes only exported and approved artifacts.
- The controlled pilot is exactly 120 approved CET4 cards with a 60-card free prefix and is always `gate_eligible=false`.
- Audio is a card resource and cannot be published without complete identified-human perceptual QC.

## Implementation hypothesis changed

- Added a local assembler that binds the approved candidate payload, exact approval, scoped audit, audio bytes and formal QC into `controlled-pilot-bundle.v1`, then calls the production publisher verifier before retaining output.
- Accepted valid ISO-8601 evidence timestamps with explicit offsets at the publisher boundary while the assembled bundle normalizes timestamps to UTC.

## Workspace boundary and read scope

- Active truth/source read: the listed product specs, controlled-pilot publisher/validator/runtime contract, and existing publisher tests.
- Generated/dependency/cache/archive read: the ignored generated runtime payload and technical audio bytes were read only to execute the real approved-batch fail-closed preflight; dependencies were installed from the committed lockfile in the isolated worktree.
- External workspace read: `/private/tmp/card-make-audio-review-station.weoJQI` and `/tmp/card-make-pilot-approval.1mhOrx` supplied approved content artifacts and showed that formal audio QC remains 0/24.

## Files changed

- `scripts/build_controlled_pilot_bundle.mjs`: dry-run-first production bundle assembler.
- `infra/cloudbase/controlled-pilot-publisher-v1.mjs`: accept valid offset ISO evidence timestamps.
- `infra/cloudbase/functions/softbook-api/test/controlled-pilot-publisher-v1.test.js`: run publisher fixtures through the real assembler and cover offset review time.
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`: record the implemented assembler and remaining external boundaries.
- `README.md`: document the explicit artifact-to-bundle command.
- `docs/agent-runs/2026-08-12-controlled-pilot-bundle-builder-v1.md`: this durable run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed.
- `npm ci` in `infra/cloudbase/functions/softbook-api` -> installed committed-lockfile dependencies, zero vulnerabilities.
- `node --test infra/cloudbase/functions/softbook-api/test/controlled-pilot-publisher-v1.test.js` -> passed, 7/7 after self-review additions.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> passed, 246/246 after self-review additions.
- `python3 scripts/test_validate_harness_runner.py && python3 scripts/test_harness_module_boundaries.py && python3 scripts/test_run_local_gates.py` -> passed, 68/68.
- `python3 scripts/validate_harness.py` -> passed.
- `scripts/run_local_gates --profile dev` -> `PASSED_WITH_EXCEPTION`, 23/24 passed; only the declared toolchain-version exception remained.
- Real approved-batch builder dry-run with the exact 120-card candidate payload and empty formal QC directory -> failed closed at `cet4-000001-audio`, finding exactly zero human QC records.

## Validation results

- Publisher/assembler integration, tamper, ISO-time and non-human-QC rejection tests: passed, 7/7.
- Exact approved-batch preflight: correctly blocked only at missing formal audio QC; content payload hash, approval binding, audit binding and corpus fingerprint were accepted before that boundary.
- Full backend suite: passed, 246/246.
- Harness/local-gate regression suites: passed, 68/68.
- Full harness: passed.
- Local dev gate profile: `PASSED_WITH_EXCEPTION`, 23/24 passed; only the declared toolchain-version exception remained.
- CI: pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex self-review under explicit user authorization
- Status: Passed after fixes
- Blocking findings: none; review tightened dry-run isolation, timestamp syntax and direct non-human-QC coverage before approval

## User-visible UI impact

- N/A. This is release tooling/runtime evidence handling; it does not change user-visible surfaces.

## Card make external workspace impact

- Read-only consumption of approved payload/review/approval/audit and formal audio-QC directory. No candidate cards or approval records were created or modified in this product repository change.

## Risks and open questions

- The exact 24 listening assets still have zero formal human perceptual QC records, so a real bundle must fail closed.
- No independent receiver CloudBase profile, credentials or deployment capability is available locally.
- Real iOS/Android device playback and five-card-round acceptance remain external execution evidence.

## Follow-up

- Complete the 24-entry identified-human audio review, generate/commit the resulting formal QC records in `card make`, rerun this builder with the real receiver profile, then run controlled-pilot preflight/deploy/publish/verify and device acceptance.
