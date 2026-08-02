# Agent Run Record: CET4 Controlled Pilot Runtime

## Task summary

- Date: 2026-08-01
- Branch: `infra/controlled-pilot-runtime`
- PR: https://github.com/LENKIN233/softbook_cet/pull/474
- Summary: Implemented the repository-side controlled-pilot backend boundary: atomic 120-hour Learning Session trial activation, server-derived remaining time, server-gated five-card round receipts and idempotent continuation, gate-isolated 120/60 pilot releases, signed private content access, audited pilot entitlement overlays, retryable account deletion, and dry-run-first receiver deployment/publication tools.

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
- `product_truth`: A five-card round boundary is the positive multiple-of-five cumulative account-and-track canonical learning `server_sequence`, never day-scoped progress. The server returns no next selection until the exact authenticated receipt is acknowledged.
- `product_truth`: Clients receive `trial_remaining_seconds` derived against each server response time and never manufacture remaining duration from device time.
- `product_truth`: Account deletion remains login-blocking until account, learning, Space, membership, beta/pilot entitlement, challenge and phone-only rate-limit data are removed. Clean registration is permitted only after completion.
- `product_truth`: Local tests, dry-runs and deployment packaging are not receiver deployment, real SMS, private-audio device playback, approved 120-card content, beta evidence or launch readiness.

## Implementation hypothesis changed

- Added `controlled_pilot` as a production-like runtime mode: v1 is disabled, real SMS/client-IP/secret requirements apply, and every content-bearing v2 route enforces an active unexpired `pilot-content-release.v1`.
- Added a transaction boundary that couples Learning Session cursor persistence/confirmation with first-trial activation. Membership reads expire trials server-side and apply beta then pilot overlays without mutating the base timeline.
- Added a controlled-pilot publisher and CloudBase adapter that verify the exact bundle/profile, approval, zero-blocker audit, card distribution, box/catalog mapping, audio bytes, human QC records and hashes; upload/reread private audio; verify staged content; activate last; and reread the active release.
- Added a dry-run-first pilot entitlement command with exact pilot/time/profile binding, compare-and-set mutation, immutable audit history, reread verification and PII-redacted public reports.
- Added a leased, retryable account-deletion worker and deployment packaging for a separate non-HTTP timer-triggered function.
- Added the pilot entitlement collection to provisioning, receiver preflight, identity probes and lifecycle cleanup.
- Added `pilot-round-v1`: deterministic account/pilot/content/count receipts, strict authenticated continue commands, transactionally revalidated projection counts, immutable idempotent continuation records, a Learning Session scheduling gate and formal-runtime route isolation.
- Added `softbook_pilot_round_continuations` to CloudBase provisioning, receiver preflight/identity probes, lifecycle cleanup and account deletion; reads accept only the CloudBase-owned `_id` beyond the exact seven-field business record.
- Added server-derived `trial_remaining_seconds` to membership, Bootstrap and Learning Session response surfaces; it is zero outside an active trial and is not persisted as entitlement authority.

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
- Five-card round authority: `pilot-round-v1.js`, `learning-scheduler-v1.js`, `index.js`, account-deletion collection coverage, and controlled-pilot/CloudBase adapter tests.
- Runtime documentation: CloudBase README, controlled-pilot runtime contract, auth runtime contract, and this run record.

## Commands run

- `node --check` for all new publisher, adapter, deploy, entitlement, API, deletion-worker and release-runtime modules -> passed.
- `node --test infra/cloudbase/functions/softbook-api/test/controlled-pilot-publisher-v1.test.js` -> passed, 4 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 235 tests.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `node infra/cloudbase/test-smoke-record-lifecycle.mjs` -> passed, 11 tests.
- `git diff --check` -> passed.
- `./scripts/run_local_gates --profile dev --base origin/main --verbose` -> `PASSED_WITH_EXCEPTION`, 23/24 passed. The only exception is declared dev-only Node version drift (actual 25.9.0, expected 22.13.0); all executed harness, mobile, Web, backend, metadata, launch-contract and build checks passed. Report: `exports/local-gates/20260801T111943Z-9d0552d6-dev-73423/report.json`.
- 2026-08-02 continuation: resolved an isolated exact Node 22.13.0 runtime with `npm exec --yes --package=node@22.13.0 -- node`, then reran controlled-pilot profile/bundle, publisher, runtime, deployment, entitlement and account-deletion-worker tests -> passed, 27 tests (16 pilot publication/runtime/deploy tests plus 11 entitlement/deletion tests).
- 2026-08-02 receiver capability audit: `tcb env list --json` succeeded with CloudBase CLI 3.6.4 and returned one `NORMAL` environment classified by the provider as an `体验版` test environment. No receiver-owned `controlled-pilot-profile.v1` was available, so no receiver preflight or mutation was attempted.
- 2026-08-02 secret-presence audit (values never read or printed): SMS provider variables and content-manifest signing key variables were absent from the process environment.
- 2026-08-02 five-card continuation: exact Node 22.13.0 full CloudBase API suite -> passed, 238 tests after adding the round gate, duplicate/offline replay, cross-midnight, cross-device, strict identity rejection, exact receipt acknowledgement, formal-route isolation, server remaining time and cross-instance CloudBase persistence/corruption coverage.
- 2026-08-02 lifecycle continuation: exact Node 22.13.0 `infra/cloudbase/test-smoke-record-lifecycle.mjs` -> passed, 11 tests; `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`; `git diff --check` -> passed.
- 2026-08-02 truth-status continuation: updated `spec/runtime-boundaries.json` from the obsolete schemas-only state to the exact repository-local runtime/mobile implementation and still-pending external execution boundary; `jq empty`, full `python3 scripts/validate_harness.py`, and `git diff --check` passed.
- PR checks: pending.

## Validation results

- Login and all failed/empty Learning Session paths leave `trial_available` unchanged; the first valid card starts one exact 120-hour timeline and repeated session requests are idempotent.
- At exact expiry, the server resolves to `free`; a valid 120-card pilot exposes exactly 60 cards. Formal and controlled-pilot releases are mutually rejected by the opposite runtime.
- Concurrent unseen learning events require the one current server selection; rejected clients must refresh the session before retry, preventing local reorder authority.
- Pilot entitlement grant/revoke rederive server stages, preserve base trial timestamps, reject event collisions and profile drift, and return only an account fingerprint.
- Deletion is retryable and idempotent, removes the login lock last, and a completed deletion permits same-phone registration from a clean state.
- Pilot publication fails on changed audio bytes and requires each audio asset to bind an approved manifest row, human reviewer/time, ten required QC checks, per-card QC coverage and a hashed QC record.
- Every mutating operator command defaults to dry-run and apply refuses any branch that is not clean exact `main` at `origin/main`.
- After the fifth newly accepted canonical event, repeated and cross-device Learning Session reads return the same completion receipt with `selection=null`; duplicate event replay and China activity-day rollover do not change the cumulative boundary. Exact continue replay returns the original acknowledgement, while count, receipt, content, identity or unknown-field drift fails closed.
- Formal/development runtime does not expose the pilot continue route. Account deletion and lifecycle cleanup include every continuation record by exact account ownership.

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
- The read-only 2026-08-02 CloudBase account inspection found only a provider-labelled test environment. It is not accepted as the independent receiver-owned controlled-pilot environment, and it was not bound into a profile or changed.

## Risks and open questions

- The contract and design PRs are stacked and still require protected product-owner approval/merge before this runtime PR can be merged and before user-visible mobile implementation can use the design as accepted authority.
- The approved 120-card payload and all referenced audio/QC remain external content deliverables from `/Users/lenkin/programing/card make`.
- Receiver CloudBase, real SMS, timer execution logs, account deletion drill, private audio device playback and rollback evidence remain pending and cannot be replaced with repository tests.
- The exact deployment Node version is locally obtainable, but the receiver profile, independent pilot environment, SMS credentials and content signing keys remain absent. These are external prerequisites, not repository test failures.
- Mobile implementation must continue to parse server `round_completion` and `trial_remaining_seconds`, POST only the exact receipt on the explicit primary action, and never count or acknowledge a round locally.
- Mobile wiring now exists in draft PR #475 with exact receipt persistence/continue, server-time display and no-payment pilot surfaces; it remains unmerged and does not replace receiver/device evidence.

## Follow-up

- Open a stacked runtime PR against the contract branch and retarget it to `main` after the contract PR merges.
- After the design-only PR is accepted, implement iOS/Android wiring and the accepted design mapping in a separate topic branch/PR.
- Consume only an externally approved 120-card export for dry-run/import/audit/runtime smoke.
- Execute receiver deployment, SMS, private audio, deletion and rollback drills only after the merged commit is on clean exact `main` and external accounts are available.
