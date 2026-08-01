# Agent Run Record: CET4 Controlled Pilot Runtime

## Task summary

- Date: 2026-08-01
- Branch: `infra/controlled-pilot-runtime`
- PR: pending
- Summary: Implemented the repository-side controlled-pilot backend boundary: atomic 120-hour Learning Session trial activation, gate-isolated 120/60 pilot releases, signed private content access, audited pilot entitlement overlays, retryable account deletion, and dry-run-first receiver deployment/publication tools.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- `product_truth`: Login, account browsing, invalid content, selection failure and cursor persistence failure must not consume trial time. The first valid Learning Session atomically persists or confirms its server cursor and writes `trial_started_at` plus `trial_expires_at` exactly 120 continuous hours apart.
- `product_truth`: Controlled pilot accepts exactly 120 CET4 cards and exposes exactly the approved first 60 after trial expiration. It cannot accept CET6, development cards, formal release artifacts, expired pilot releases, or any `gate_eligible=true` artifact.
- `product_truth`: Continued pilot access is a server-side audited overlay. It does not overwrite base membership, cannot be self-issued by a client, and never creates a payment path.
- `product_truth`: Account deletion remains login-blocking until account, learning, Space, membership, beta/pilot entitlement, challenge and phone-only rate-limit data are removed. Clean registration is permitted only after completion.
- `product_truth`: Local tests, dry-runs and deployment packaging are not receiver deployment, real SMS, private-audio device playback, approved 120-card content, beta evidence or launch readiness.

## Implementation hypothesis changed

- Added `controlled_pilot` as a production-like runtime mode: v1 is disabled, real SMS/client-IP/secret requirements apply, and every content-bearing v2 route enforces an active unexpired `pilot-content-release.v1`.
- Added a transaction boundary that couples Learning Session cursor persistence/confirmation with first-trial activation. Membership reads expire trials server-side and apply beta then pilot overlays without mutating the base timeline.
- Added a controlled-pilot publisher and CloudBase adapter that verify the exact bundle/profile, approval, zero-blocker audit, card distribution, box/catalog mapping, audio bytes, human QC records and hashes; upload/reread private audio; verify staged content; activate last; and reread the active release.
- Added a dry-run-first pilot entitlement command with exact pilot/time/profile binding, compare-and-set mutation, immutable audit history, reread verification and PII-redacted public reports.
- Added a leased, retryable account-deletion worker and deployment packaging for a separate non-HTTP timer-triggered function.
- Added the pilot entitlement collection to provisioning, receiver preflight, identity probes and lifecycle cleanup.

## Workspace boundary and read scope

- Active repository truth/source read: only the referenced specs, relevant CloudBase runtime/contracts, tests, delivery helpers and runtime files.
- External content workspace: `/Users/lenkin/programing/card make` was not modified in this run. No repository seed card or test fixture was counted as an approved pilot card.
- Generated local-gate output is recorded only as local validation and is not treated as formal evidence.

## Files changed

- Runtime and trial authority: `infra/cloudbase/functions/softbook-api/index.js`, `learning-scheduler-v1.js`, `bootstrap-v2.js`, `learning-events-v2.js`, `space-actions-v2.js`, `content-manifest-v1.js`, `content-release-runtime.js`, `auth-v2.js`, and `sms-provider.js`.
- Account deletion: `account-deletion-worker-v1.js` plus auth and worker tests.
- Pilot publication/deployment: `controlled-pilot-publisher-v1.mjs`, `cloudbase-pilot-receiver-adapter.mjs`, `manage-controlled-pilot.mjs`, `deploy-controlled-pilot-runtime.mjs`, and generalized receiver deploy helpers.
- Pilot entitlement: `pilot-entitlement-v1.mjs`, `manage-pilot-entitlement.mjs`, beta timestamp preservation, and unit/CLI tests.
- Receiver collections/lifecycle: `deployment-safety.mjs`, `provision-softbook-nosql.mjs`, `smoke-record-lifecycle.mjs`, and lifecycle tests.
- Runtime documentation: CloudBase README, controlled-pilot runtime contract, auth runtime contract, and this run record.

## Commands run

- `node --check` for all new publisher, adapter, deploy, entitlement, API, deletion-worker and release-runtime modules -> passed.
- `node --test infra/cloudbase/functions/softbook-api/test/controlled-pilot-publisher-v1.test.js` -> passed, 4 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 235 tests.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `node infra/cloudbase/test-smoke-record-lifecycle.mjs` -> passed, 11 tests.
- `git diff --check` -> passed.
- `./scripts/run_local_gates --profile dev --base origin/main --verbose` -> `PASSED_WITH_EXCEPTION`, 23/24 passed. The only exception is declared dev-only Node version drift (actual 25.9.0, expected 22.13.0); all executed harness, mobile, Web, backend, metadata, launch-contract and build checks passed. Report: `exports/local-gates/20260801T111943Z-9d0552d6-dev-73423/report.json`.
- PR checks: pending.

## Validation results

- Login and all failed/empty Learning Session paths leave `trial_available` unchanged; the first valid card starts one exact 120-hour timeline and repeated session requests are idempotent.
- At exact expiry, the server resolves to `free`; a valid 120-card pilot exposes exactly 60 cards. Formal and controlled-pilot releases are mutually rejected by the opposite runtime.
- Concurrent unseen learning events require the one current server selection; rejected clients must refresh the session before retry, preventing local reorder authority.
- Pilot entitlement grant/revoke rederive server stages, preserve base trial timestamps, reject event collisions and profile drift, and return only an account fingerprint.
- Deletion is retryable and idempotent, removes the login lock last, and a completed deletion permits same-phone registration from a clean state.
- Pilot publication fails on changed audio bytes and requires each audio asset to bind an approved manifest row, human reviewer/time, ten required QC checks, per-card QC coverage and a hashed QC record.
- Every mutating operator command defaults to dry-run and apply refuses any branch that is not clean exact `main` at `origin/main`.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none
- Review summary: Reviewed trial atomicity and time boundaries, transaction conflict behavior, overlay ordering, PII exposure, deletion ordering/retry semantics, receiver target allowlisting, secret handling, formal/pilot publisher isolation, release expiry, audio hash/QC binding, and dry-run/apply safety. The review found and resolved two issues before pass: pilot premium initially disappeared after a Learning Session commit because only beta overlay was returned, and the pilot audio QC verifier initially trusted a shallow asset list and resolved QC records from the wrong object. The final implementation applies beta then pilot overlay and verifies hashed human QC records from the validated bundle directory.

## User-visible UI impact

- None in this PR. No React Native screen, navigation, visual token, copy, interaction or motion implementation is changed.
- Mobile wiring remains a separate PR and must use the accepted design-only authority for pilot identity, first-card trial notice, five-card completion and pilot membership state.

## External execution impact

- No CloudBase function, collection, SMS provider, audio object, TestFlight build or Android closed-test build was changed by this run.
- No entitlement was granted or revoked and no account was deleted externally.
- Deployment/publication commands were validated locally in dry-run/test adapters only; real receiver apply remains gated on approved inputs, receiver access, clean exact `main` and explicit apply.

## Risks and open questions

- The contract and design PRs are stacked and still require protected product-owner approval/merge before this runtime PR can be merged and before user-visible mobile implementation can use the design as accepted authority.
- The approved 120-card payload and all referenced audio/QC remain external content deliverables from `/Users/lenkin/programing/card make`.
- Receiver CloudBase, real SMS, timer execution logs, account deletion drill, private audio device playback and rollback evidence remain pending and cannot be replaced with repository tests.
- Client work must remove remote start-trial mutations, parse the new timestamp and `pilot_premium` fields, use Learning Session as the only trigger, and implement server-confirmed five-card completion without local scheduling.

## Follow-up

- Open a stacked runtime PR against the contract branch and retarget it to `main` after the contract PR merges.
- After the design-only PR is accepted, implement iOS/Android wiring and the accepted design mapping in a separate topic branch/PR.
- Consume only an externally approved 120-card export for dry-run/import/audit/runtime smoke.
- Execute receiver deployment, SMS, private audio, deletion and rollback drills only after the merged commit is on clean exact `main` and external accounts are available.
