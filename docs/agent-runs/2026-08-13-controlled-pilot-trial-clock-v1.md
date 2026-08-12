# Agent Run Record: controlled pilot trial clock

## Task summary

- Date: 2026-08-13
- Branch: `module/controlled-pilot-trial-clock-v1`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/501`
- Summary: Implement the exact server-authoritative 120-hour trial from the first successful eligible Learning Session through membership, Bootstrap, content access, mobile parsing, display, and runtime smoke.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`
- `docs/design/decisions/mobile-daylight-studio-v1.md`
- `docs/design/mapping/mobile-daylight-studio-implementation-map-v1.md`
- `docs/design/search-runs/2026-08-11-mobile-daylight-studio/candidate-proofs/sbv-09-daylight-studio.html`

## Product truth used

- Authentication is required before Learning but does not itself consume the trial.
- The five-day complete trial begins on the first entry counted as membership trial. For remote runtime, the Learning Session is the sole start authority after canonical content/access validation and eligible card selection.
- Remote clients display the server clock and never create, extend, expire, or reconstruct entitlement time from a device clock.
- After trial expiry, basic Learning remains available while full library, Space, and review require entitlement.
- Controlled-pilot content and simulated runtime artifacts remain `gate_eligible=false` and do not replace formal beta or launch evidence.

## Implementation hypothesis changed

- Added canonical `trial_started_at`, `trial_expires_at`, and server-derived `trial_remaining_seconds` across membership, Bootstrap, content manifest, and Learning Session reads.
- Added an exact 120-hour trial transition that atomically expires to free at the boundary and increments the canonical membership revision once.
- Replaced the v2 client trial mutation with a Learning Session-only activation transaction that rechecks the persisted selection cursor before changing membership.
- Removed the remote trial-start mutation and its offline queue/replay path from mobile; legacy persisted queue entries are discarded during sanitation.
- Updated the remote mobile state from each strict Learning Session clock without triggering a membership-dependent reload loop.
- Kept the development-only v1 trial alias for migration tests; non-development v1 remains disabled.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs/contracts/design artifacts, current runtime/mobile implementations, tests, and delivery governance.
- Generated/dependency/cache/archive read: installed backend/mobile dependencies only while running existing checks; no archive was used as product truth.
- External workspace read: none. This change consumes the already approved exact 120-card handoff through its repository runtime smoke and does not produce or approve card content.

## Files changed

- `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`: define the remote trial clock and accurately record repository-local implementation versus undeployed work.
- CloudBase API, Bootstrap, content-manifest, Learning Session, mocks, smokes, contracts, and tests: implement the transaction, expiry, strict response fields, candidate runtime coverage, and exact boundary assertions.
- Mobile membership/Learning repositories, models, App state, mutation queue, and tests: remove client start authority, strictly consume the server clock, render remaining days in the accepted location, and drop legacy queued starts.
- `docs/agent-runs/2026-08-13-controlled-pilot-trial-clock-v1.md`: preserve this runtime/UI delivery context.

## Commands run

- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npx tsc --noEmit --pretty false` in `apps/mobile` -> passed.
- Focused mobile Jest run for App, membership, Learning Session, bootstrap, persistence, runtime config, and mutation queue -> 12 suites / 253 tests passed before final strictness additions; final focused App/membership/session run -> 3 suites / 103 tests passed.
- Full mobile Jest run -> 46 suites / 498 tests passed.
- Full backend Node test run -> 252/252 passed; focused API, Learning Session, controlled-pilot round, card-source, and exact candidate runtime subset -> 84/84 passed after self-review fixes.
- Local mock plus `smoke-softbook-api.mjs` with isolated identity, writes, and membership mutations -> passed; Learning Session returned `trial`, exact 120-hour timestamps, and `trial_remaining_seconds=432000` before event/Space/purchase flow.
- `git diff --check` and JSON/Node syntax checks -> passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/validate_harness.py --mode local` and `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Login and direct `/v2/membership/start-trial` cannot consume the remote trial.
- A valid selected-and-confirmed Learning Session starts the trial exactly once; empty selection, bad content, unavailable entropy, and cursor failures do not start it.
- Memory and CloudBase stores return one second just before expiry, atomically persist `trial -> free` at the exact boundary, and do not increment revision again on replay.
- Membership, Bootstrap, Learning Session, content access, mobile parser, App state, and mock smoke all share the same server clock contract.
- The App displays Learning Session-derived remaining days and no longer queues or retries a retired client trial mutation.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex self-review, explicitly approved by the user
- Status: Passed locally; required PR checks pending
- Blocking findings: none after fixing the state-dependent reload risk, strict 120-hour validation gaps, stale scheduler dependency, and smoke drift found during self-review.

## User-visible UI impact

- Design source: accepted Daylight Studio proof/decision and implementation map listed above. The proof already defines the membership location and “试用还剩 5 天” content; this change binds that copy to canonical server remaining seconds without changing layout, palette, or component silhouette.
- Interaction/motion artifact: N/A; no core card interaction or motion changes.
- Implementation mapping: existing Mine membership summary -> `MembershipState.trialRemainingSeconds` from strict Bootstrap/Learning Session parsing.
- Unimplemented gap: real-device confirmation remains pending until receiver deployment.
- Q1: no library identity changed; the membership copy uses the existing brand-violet account surface and adds no competing accent.
- Q2: the existing account/membership card remains focal; remaining time is secondary status and chrome remains tertiary.
- Q3: the accepted Mine membership silhouette is unchanged; no new card or interaction family was introduced.
- Q4: no forbidden gradient text, gamification chrome, full-width tab bar, serif, pure black/white, or self-assess change was introduced.
- Q5: no layout dimensions changed; existing compact/phone containment tests still pass, while real-device proof remains pending.
- Q6: Learning remains the single-card primary path; flip retains exactly `有把握` / `再回看`.

## Card make external workspace impact

- None. No candidate content, approval, payload, or audio-QC artifact was created or modified. The existing 120-card candidate smoke remains non-gate evidence.

## Risks and open questions

- Repository implementation is not deployed; receiver profile/secrets and execution remain pending.
- The separate audited pilot-entitlement overlay still needs implementation before receiver grants can be operated.
- All 24 referenced audio assets still require identified-human perceptual QC.
- Receiver deletion-worker execution and real iOS/Android evidence remain pending.

## Follow-up

- Complete PR review and required gates, merge, then implement the audited pilot entitlement as a separate change before receiver deployment and device validation.
