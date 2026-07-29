# Agent Run Record: CloudBase receiver delivery

## Task summary

- Date: 2026-07-29
- Branch: `infra/cloudbase-receiver-delivery`
- Summary: Implemented a dry-run-first receiver delivery command, concrete CloudBase release adapter, and configurable production SMS webhook boundary. No CloudBase write, deployment, SMS delivery, or release activation was performed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- This release scope is CET4 closed beta; formal publication still requires the complete 1,180-card payload, 301 audio assets and QC records, the complete audit, human CET review, and one final whole-track user approval.
- Receiver delivery must be reproducible in a new receiver-owned CloudBase environment without personal-development users, learning data, fixed verification codes, credentials, or private signing keys in tracked files.
- Publication activates content only after all evidence and uploaded bytes have been verified; rollback changes a verified release pointer and does not delete learning data.
- Passing repository tests is not evidence that a receiver environment, production SMS gateway, or iOS/Android device flow works remotely.

## Implementation hypothesis changed

- `infra/cloudbase/deliver-release.mjs` now exposes `preflight`, `provision`, `deploy`, `publish`, `verify`, and `rollback`; all mutating commands are dry-run unless `--apply` is explicit.
- Write application requires Node 22.13.0, a clean `main` exactly equal to `origin/main`, a receiver-owned profile, successful remote inspection, and valid environment-injected secrets.
- The receiver adapter uploads each private audio asset to an immutable release/hash path, re-downloads it, checks byte length and SHA-256, stages exact runtime content with evidence hashes, verifies the stage, and changes the active pointer last.
- Receiver deployment builds and tests an isolated lockfile-resolved function artifact and uses a temporary mode-0600 CloudBase configuration. Production runtime uses a receiver-owned HTTPS SMS webhook and excludes `SOFTBOOK_SMS_DEV_CODE`.
- Read-only verification checks the active release, bundle, API route, collection catalog, and zero imported user-data baseline for the initial handoff.

## Workspace boundary and read scope

- Active repository scope: task-relevant product/runtime/governance specs, CloudBase delivery contracts and implementation, authentication runtime, release publisher, and tests.
- External content workspace `/Users/lenkin/programing/card make` was not modified or used to produce content in this run.
- No candidate card, audio asset, QC verdict, approval record, personal CloudBase record, or receiver secret was read or changed.
- Generated, dependency, archive, and machine-local data were not used as product truth.

## Files changed

- `infra/cloudbase/cloudbase-receiver-adapter.mjs`: CloudBase command adapter, asset upload/download verification, evidence-bound version staging, activation-last release pointer, and verified retained rollback.
- `infra/cloudbase/deliver-release.mjs`: unified dry-run-first receiver preflight, provisioning, isolated deployment, publication, verification, and rollback command.
- `infra/cloudbase/functions/softbook-api/sms-provider.js`, `index.js`: production HTTPS SMS webhook adapter and runtime wiring.
- `infra/cloudbase/functions/softbook-api/test/cloudbase-receiver-adapter.test.js`, `deliver-release.test.js`, `sms-provider.test.js`: fail-closed and ordering regressions.
- `infra/cloudbase/release-delivery-v1.mjs` and its test: accept actual CloudBase region identifiers with optional numeric zones.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `infra/cloudbase/release-bundle-v1-runtime-contract.md`, `infra/cloudbase/README.md`, `AGENTS.md`: production SMS and receiver delivery boundaries/status.

## Commands run

- `git diff --check` -> passed.
- `python3 -m json.tool spec/account-sync-contract.json` and `spec/runtime-boundaries.json` -> passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 170 tests passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API reported zero known vulnerabilities.
- `scripts/run_local_gates --profile dev` -> 19/20 passed plus the declared dev-only Node 25.9.0 versus required 22.13.0 safe exception; no failed gate.
- CloudBase CLI help and read-only inspection performed during implementation planning; no write command was applied.

## Validation results

- Tests prove dry-run defaults, exact receiver environment/catalog inspection, allowlisted provisioning, topic-branch write rejection, temporary secret configuration, fixed-code exclusion, private asset re-download verification, exact staged locator checks, parent-release checks, activation-last ordering, and rollback without deletion.
- All 170 backend tests pass, including the pre-existing authentication, learning-event, scheduling, content-manifest, membership, and space-action contracts.
- Dependency audit reports zero known vulnerabilities at this point in time.
- No real receiver profile, final release bundle, receiver secrets, or empty CloudBase environment was available, so provision/deploy/publish/verify/rollback apply mode remains unexecuted.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none in the repository-local receiver adapter and delivery-command scope.
- Review summary: The review verified explicit dry-run behavior, exact-main write protection, secret non-persistence, production fixed-code exclusion, uploaded-byte re-verification, evidence-bound staging, activation-last ordering, and non-destructive rollback. Real receiver and device evidence remains an explicit release gate.

## User-visible UI impact

- N/A. No screen, copy, visual state, gesture, accessibility behavior, or player behavior changed.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not modified, and no content or approval state changed.

## Risks and open questions

- The CloudBase CLI output and mutation behavior are verified by local fixtures and CLI surface inspection, not by a new receiver environment drill.
- The production SMS webhook contract has not yet been exercised against a real receiver-owned SMS gateway or lifecycle-managed test account.
- `verify` enforces a zero-user-data initial handoff baseline; it is intended for the first receiver delivery, not for verification after beta users start generating data.
- Final CET4 content remediation, human review, 301/301 audio QC, whole-track user approval, signed release bundle creation, dual-device smoke, and beta-entitlement audit remain incomplete.
- Current personal CloudBase development data is not included in this implementation or delivery path.

## Follow-up

- After the receiver provides a new CloudBase environment, profile, CI secrets, and SMS gateway, run `preflight` and review the dry-run plans before any apply operation.
- After the approved CET4 payload and complete audio evidence exist, construct the final bundle and execute provision -> deploy -> publish -> verify plus rollback rehearsal on clean exact `main` with Node 22.13.0.
- Run iOS and Android real-device authentication, learning, audio, synchronization, restart recovery, Space, and Statistics smoke before closed-beta release approval.
