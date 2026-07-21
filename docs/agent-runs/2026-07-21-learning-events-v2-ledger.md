# Agent Run Record: Learning events v2 backend ledger

## Task summary

- Date: 2026-07-21
- Branch: `infra/learning-events-v2-ledger`
- PR: https://github.com/LENKIN233/softbook_cet/pull/436
- Summary: Implement the repository-local CloudBase `learning-events.v2`
  endpoint, immutable account-scoped event ledger, cursor fork detection,
  transactional server sequence and projections, retained content lookup, v1
  migration boundary, and bootstrap reads without claiming mobile adoption,
  deployment, scheduling, formal content approval, or launch readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login remains required before learning, and account learning state remains
  server-authoritative across release surfaces with at least daily-level
  consistency.
- Exact same-card cross-device resume is not required.
- A card completion is the progress unit. The visible result remains the
  existing two-state `passed` / `review_needed` mapping rather than a new
  four-grade interaction.
- Physical-space favorite/sleep state, check-in, membership, scheduling,
  content approval, and production publication retain separate authorities.
- A green backend test cannot become formal approval or launch evidence.

## Implementation hypothesis changed

- `POST /v2/learning/events` now derives account identity only from an active
  v2 session, rederives the stored account key from the signed-session phone,
  and validates a strict `learning-events.v2` batch.
- Event and device-cursor keys are account-scoped hashes. Exact replay returns
  the original server sequence; changed payloads and cursor forks reject the
  complete request with HTTP 409.
- Memory and CloudBase adapters share one transaction algorithm for immutable
  events, cursor bindings, account sequence, per-track latest-card state, and
  per-day learning/review aggregates.
- The CloudBase adapter handles the real transaction `doc().get()` object shape,
  uses no transaction `where` calls, and caps a request at 9 events. The
  maximum all-track migration fixture uses 91 operations, retaining headroom
  below the platform limit of 100.
- Bounded legacy learning pages are read before the first-event transaction. A
  deterministic account revision fence is incremented by v1 writes and marked
  migrated with the first v2 event, forcing a complete preflight retry on races.
- Legacy physical-space discovery was moved outside its transaction as well;
  only the deterministic canonical account document is read and merged inside.
- Stored event payloads are rehashed before duplicate acknowledgement. Missing
  or corrupt session identity, sequence, cursor, event, full learning/daily
  projection, migrated v1 event, or content-registry metadata fails closed.
- Offline events may reference a retained prior content version. Current and
  historical version status is explicit, and production still requires a
  matching published release.
- The first accepted v2 event migrates valid v1 state for both tracks as
  sequence-zero baselines, so entering through one track cannot discard the
  other track. Later v1 learning snapshots are rejected. The development daily
  bridge may only merge monotonic check-in; learning counters remain derived
  from v2 events and favorite/sleeping counts come from canonical space.
- The card-source importer archives replaced versions and registers the new
  active version. Import and audit queries use CloudBase `QUERY`, not the
  unsupported `FIND` command type.

## Workspace boundary and read scope

- Active source read: the referenced specs, CloudBase function/store/import and
  audit code, mobile progress/mutation repositories, Harness mirrors, tests,
  workflows, and recent Agent run records.
- Generated/dependency/cache read: ignored local-gate reports and installed
  dependencies were used only as validation evidence, never product truth.
- Remote read: read-only CloudBase audit of the current CET4 and CET6
  development card-source documents. No remote write or deployment occurred.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  modified because this change neither produces nor approves card content.

## Files changed

- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, and
  `spec/evals.json`: record the implemented-local backend status, integrity and
  migration rules, non-claims, and regression expectations.
- `infra/cloudbase/learning-events-v2-runtime-contract.md`, bootstrap/mobile
  runtime contracts, and `infra/cloudbase/README.md`: document the endpoint,
  storage, retained content, daily bridge, separate authorities, and remaining
  launch gaps.
- `infra/cloudbase/functions/softbook-api/learning-events-v2.js`: strict request,
  identity, time, grade, content, and acknowledgement handling.
- `infra/cloudbase/functions/softbook-api/learning-events-v2-store.js`: shared
  transactional ledger/projection algorithm and account-scoped document keys.
- `infra/cloudbase/functions/softbook-api/index.js`, `auth-v2.js`, and
  `bootstrap-v2.js`: route wiring, account-key propagation, migrated v1 write
  boundary, projection reads, and canonical space overlays.
- Card-source import/audit helpers and NoSQL provisioning: retain prior content
  versions, use the supported CloudBase query protocol, and provision the five
  new collections.
- Backend and contract tests plus the product-contract Harness mirror: cover
  memory/CloudBase parity, replay/conflict/rollback/concurrency, corruption,
  migration, pagination, content retention, and non-claim drift.
- `docs/agent-runs/2026-07-21-learning-events-v2-ledger.md`: this record.

## Commands run

- Exact Node 22.13.0 `npm ci --ignore-scripts` in the CloudBase function ->
  clean lockfile install, 79 production packages audited, zero known findings.
- Exact Node 22.13.0 `npm test` in the CloudBase function -> 71/71 passed after
  transaction fakes were aligned with the real SDK's object-return and doc-only
  behavior.
- `python3 scripts/test_learning_events_contract.py` -> 10/10 passed.
- `python3 scripts/validate_harness.py --mode local --section
  product_contract_mirrors --format text` -> selected truth layer passed with
  expected partial completeness.
- Exact Node 22.13.0 and Python 3.12.13
  `python3 scripts/validate_harness.py --mode local --format text --profile` ->
  all 15 local Harness sections passed. An earlier invocation accidentally
  selected system Python 3.9 after narrowing `PATH`; that environment-only
  failure was corrected and is not treated as a pass.
- Exact Node 22.13.0 and Python 3.12.13
  `scripts/run_local_gates --profile dev --output
  exports/local-gates/learning-events-v2-dev.json` -> 18/18 passed, including
  mobile lint/typecheck/Jest, backend tests, Maestro and launch contracts,
  metadata scans, and tracked-worktree integrity.
- Exact Node 22.13.0 `npm audit --omit=dev` in both mobile and backend -> zero
  known findings after rebuilding the stale local backend dependency tree.
- CloudBase CLI 3.2.2 help plus the official RunCommands contract -> confirmed
  query operations require `CommandType: QUERY`.
- Official CloudBase transaction contract -> confirmed transaction `where` is
  unsupported and one transaction is limited to 100 operations; implementation
  and negative tests now enforce those limits.
- Read-only `node infra/cloudbase/audit-card-sources.mjs --track cet4` -> five
  development cards, all five interaction families, `release_id=none`.
- Read-only `node infra/cloudbase/audit-card-sources.mjs --track cet6` -> five
  development cards, all five interaction families, `release_id=none`.
- `git diff --check` -> passed.

## Validation results

- New and duplicate events preserve one immutable account sequence and never
  double-increment projections.
- Event-ID mutation, device-cursor fork, invalid content, invalid time, and one
  invalid event in a mixed batch reject atomically.
- CloudBase concurrency converges, and injected transaction failure leaves no
  event, cursor, sequence, learning, or daily-progress partial write.
- A v1 revision change after migration preflight forces a fresh bounded snapshot;
  no transaction test path permits `where`, and an atomic batch above 9 is
  rejected during configuration. A maximum nine-event, all-track migration
  uses 91 transaction operations in the limit-enforcing fake.
- Legacy pagination and sequence-zero migration preserve valid baseline state
  for both tracks;
  migrated daily writes cannot overwrite v2 learning or canonical space counts.
- Corrupt current/historical content status, expired retention, mismatched
  payload digest, orphaned projection, and corrupt sequence fail closed.
- The live development environment remains development-only: CET4 and CET6
  each expose five cards and no published release.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, generated report, or binary product
  artifact is created or tracked by this backend change.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none open. Final staged review found and resolved a
  cross-track migration defect that would have discarded the untouched track's
  legacy baseline after the first v2 event. Memory and CloudBase regressions now
  preserve both tracks, and the maximum-operation fixture retains nine
  operations of headroom.
- Remote status: GitHub required checks still must execute and pass before
  merge; this local review does not replace them.

## User-visible UI impact

- None. No screen, component, copy, motion, visual token, or interaction UI is
  changed. The mobile client does not emit v2 events in this change.

## Card make external workspace impact

- None. No card payload, review, formal approval, or audio record changed.
- Green backend and content-hash validation do not create approved batches or a
  production content release.

## Risks and open questions

- The endpoint and collections are repository-local and are not deployed.
- Mobile durable event allocation, queue replay, and legacy learning-write
  removal are still pending.
- The server scheduler/FSRS adapter and scheduler cursor remain unimplemented.
- Current remote card sources are five-card development seeds with no release;
  approved full content, signed packs, audio, and publication remain pending.
- The CommonJS CloudBase/NoSQL adapter is staging infrastructure, not the final
  TypeScript CloudBase Run/PostgreSQL production service.
- Real SMS, payment authority, deletion completion, observability, compliance,
  and launch gates remain outside this change.

## Follow-up

- Complete final staged review, strict PR profile, GitHub required checks, and
  merge without bypass.
- After this backend slice merges, adopt durable `learning-events.v2`
  production/replay in the mobile runtime before starting the server scheduler.
