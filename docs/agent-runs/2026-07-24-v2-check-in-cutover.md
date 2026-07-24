# Agent Run Record: V2 Daily Check-In Cutover

## Task summary

- Date: 2026-07-24
- Branch: `cross/v2-check-in-cutover`
- PR: `#441` (`https://github.com/LENKIN233/softbook_cet/pull/441`)
- Product-owner decision: the user explicitly approved this repository-local
  cutover slice. This is not formal card-content approval, deployment approval,
  or launch approval.
- Summary: remove active v1 daily/learning snapshot writes, add strict explicit
  `daily-check-in.v2`, preserve event and physical-space authority, and migrate
  the mobile durable queue without accepting counters as write authority.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Learning and review counts are derived from accepted `learning-events.v2`.
- Favorite and sleeping counts are derived from canonical physical-space state.
- Daily check-in is an explicit user action, not a client-authored progress
  snapshot.
- Account identity comes only from the active v2 session.
- Retained v1 daily and learning documents are read-only migration inputs.
- Green repository checks cannot create formal content approval, deployment, or
  launch readiness.

## Implementation hypothesis changed

- Added authenticated `POST /v2/progress/check-in` with exact `{day_key}` input
  and strict `daily-check-in.v2` output.
- Added independent `softbook_daily_check_ins` account/day records with
  monotonic idempotence in memory and CloudBase transactions.
- Kept check-in writes separate from event-derived daily progress and proved
  concurrent first-event/check-in preservation.
- Revalidated the exact five business fields on write and canonical read.
  CloudBase's adapter-owned `_id` is stripped; every other unknown field fails
  closed.
- Disabled `POST /v1/progress/daily-sync` and
  `POST /v1/learning/state-sync` globally with `410`; the production-wide v1
  guard remains `legacy_api_disabled`.
- Removed automatic mobile daily snapshot upload. Only the Statistics explicit
  action durably queues a credential-free account/day check-in command.
- Advanced local checked-in presentation only after durable queue persistence.
  A strict endpoint acknowledgement is followed by canonical bootstrap
  reconciliation before synchronized status is shown.
- Restored queued check-in state after restart only for an exact active
  account/day command. Event-derived counts cannot replace check-in
  confirmation, and stale local same-day state clears when no matching command
  exists.
- Migrated a legacy `sync_daily_progress` entry only when the full checked-in
  snapshot has a valid day, nonnegative integer counters, and a consistent
  total. The migration retains only account context and day; all other legacy
  daily snapshots are discarded.
- Updated the local mock and write smoke to exercise the scheduler selection,
  v2 check-in, both disabled legacy routes, learning events, space state, and
  canonical bootstrap.

## Workspace boundary and read scope

- Active truth/source read: referenced specs, active runtime contracts, mobile
  sync/bootstrap/App code, CloudBase function/store code, focused tests,
  Harness mirrors, metadata scanners, and delivery governance.
- Generated/dependency/cache/archive read: installed dependencies were executed
  by tests; ignored local-gate reports were read only as validation output.
- Historical acceptance log: retained unchanged as historical evidence, not
  treated as current route authority.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  modified or used as approval authority.

## Files changed

- Owner/runtime contracts: `spec/account-sync-contract.json`,
  `spec/runtime-boundaries.json`, `spec/evals.json`, and active CloudBase runtime
  documents.
- Backend: new `daily-check-in-v2.js`, API routing, independent memory/CloudBase
  storage, provisioning, old-route guards, and migration/concurrency/corruption
  tests.
- Mobile: strict check-in repository/runtime endpoint, durable command
  migration/replay, bootstrap recovery, explicit Statistics handler, and
  restart/storage/session-race tests.
- Local runtime: mock API and write smoke now verify v2 check-in and legacy
  snapshot-write removal.
- Harness/scanners: owner/runtime/eval mirrors, negative fixtures, collection
  provisioning checks, and check-in storage/helper metadata terms.

## Commands run

- `npm test -- --runInBand --watchAll=false --no-watchman` in `apps/mobile` ->
  38 suites and 348 tests passed.
- `npm run typecheck` in `apps/mobile` -> passed during implementation; repeated
  by the final local dev gates.
- `npm run lint` in `apps/mobile` -> zero errors and 14 pre-existing
  `react-native/no-inline-styles` warnings; repeated by the final local dev
  gates.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 100 tests passed.
- `PYTHONPATH=scripts python3 -m unittest
  scripts.test_learning_events_contract scripts.test_learning_scheduler_contract`
  -> 26 tests passed.
- `node scripts/test_check_design_metadata_leaks.mjs` -> 3 tests passed.
- Write-enabled isolated mock smoke -> v2 auth/bootstrap/card source/session,
  daily check-in, both legacy snapshot-write `410` guards, learning-event
  accepted/duplicate replay, space state, post-write bootstrap, and logout
  passed.
- `python3 scripts/validate_harness.py --mode local` -> all 15 selected local
  sections passed; completeness correctly remained partial because the remote
  delivery guard was not executed.
- `./scripts/run_local_gates --profile dev` -> complete
  `passed_with_exception`; 17 checks passed and the only exception was the
  allowed dev-only Node 25.9.0 versus 22.13.0 drift. Report:
  `exports/local-gates/20260724T124340Z-9f235025-dev-72787/report.json`.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12
  `./scripts/run_local_gates --profile pr --base origin/main --pr 441` ->
  complete 30/30 passed after recording the full Harness review evidence and
  restoring the topic branch's explicit remote-tracking mapping. Report:
  `exports/local-gates/v2-check-in-pr-passed.json`.
- `git diff --check` -> passed after final review.

## Validation results

- Backend strictness covers missing, null, scalar, array, empty, invalid-date,
  and unknown-field request bodies.
- Client strictness covers extra envelope/data fields, wrong schema/day,
  false acknowledgement, invalid timestamp, missing auth, and invalid calendar
  dates.
- Memory and CloudBase check-in are monotonic and idempotent. Independent
  function instances restore the same canonical record.
- CloudBase system `_id` is accepted only as adapter metadata; malformed or
  expanded business records fail with `daily_check_in_projection_invalid`.
- Concurrent first learning event and check-in preserve both outcomes without
  mutating the retained v1 baseline.
- Mobile card completion makes no daily snapshot request. Explicit check-in
  persists before local completion, sends only `day_key`, and retains failed or
  ambiguous commands for exact replay.
- Restart recovery preserves an exact pending account/day command as queued and
  does not let event-derived progress display it as synchronized.
- A strict check-in acknowledgement without bootstrap confirmation remains
  visibly unreconciled and cannot be overwritten by general progress hydration.
- Tracked worktree contents were unchanged by test and smoke execution apart
  from the intentional task diff and this run record.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed locally after path-by-path review and full regression.
- Blocking findings: none.
- Findings resolved before pass: CloudBase `_id` false corruption failure;
  restart loss of an exact queued check-in; ACK/bootstrap status overwrite;
  permissive partial legacy-snapshot migration; mock/backend legacy guard drift;
  and single-line Statistics status copy that was too long for the accepted
  phone layout.

## User-visible UI impact

- Design artifact source:
  `docs/design/decisions/mobile-core-surface-reset-v1.md`,
  `docs/design/mocks/mobile-core-surface-reset-v1.html`, and
  `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`.
- Implementation mapping:
  `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`,
  Statistics daily object and ledger rows.
- Mapping: only existing Statistics ledger status copy and state selection
  changed. Layout, tokens, color, navigation, card silhouette, and interaction
  structure did not change.
- Unimplemented gap: no new UI capability is authorized by this slice. Broader
  visual QA remains part of release validation.

## Design review checklist

- Q1: The active CET library and its single accent remain unchanged; check-in
  status adds no competing accent.
- Q2: The Statistics daily object remains focal, ledger status remains
  secondary, and navigation chrome remains tertiary.
- Q3: The accepted quiet Statistics ledger silhouette is unchanged.
- Q4: No gradient text, gamification chrome, full-width tab bar, pure black or
  white substitution, removed self-assess token, or serif was introduced.
- Q5: No geometry changed. New single-line status details were shortened to fit
  the existing constrained phone ledger instead of relying on truncation.
- Q6: Statistics retains its tabular number treatment; Learning remains
  system-sequenced, and flip still has exactly the two accepted self-assess
  choices.

## Card make external workspace impact

- N/A. No candidate card, review record, audio, approval batch, or exported
  payload changed.

## Risks and open questions

- Backend, mobile, mock, and contracts are repository-local and not deployed.
- Card source, membership, and physical-space v1 routes remain a development
  migration bridge; production still rejects every v1 route.
- Production SMS, payment entitlement, signed content publication, formal card
  approval, audio QC, and release validation remain pending.
- The local dev profile permits Node version drift; PR/release profiles remain
  pinned to Node 22.13.0 and Ruby 3.3.

## Follow-up

- PR `#441` now carries the passed Agent review and real-context strict local
  gate evidence. Merge only after the final reviewed HEAD reproduces the
  strict profile and every required GitHub check passes.
