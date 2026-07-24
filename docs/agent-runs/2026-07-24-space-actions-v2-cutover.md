# Agent Run Record: Physical Space Actions v2 Cutover

## Task summary

- Date: 2026-07-24
- Branch: `cross/v2-space-state-cutover`
- PR: `#442` (`https://github.com/LENKIN233/softbook_cet/pull/442`)
- Product-owner decision: the user explicitly approved this repository-local
  physical-space cutover slice. This is not formal card-content approval,
  deployment approval, or launch approval.
- Summary: replace active v1 whole-snapshot physical-space sync with strict,
  immutable `space-actions.v2`, account-scoped canonical state, durable mobile
  action replay, and fail-closed bootstrap reconciliation.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Favorite is a physical-space tag. Sleep removes a card from active learning
  eligibility without deleting learning or scheduler history.
- Favorite and sleep are independent dimensions; an action in one dimension
  cannot overwrite the other.
- Account and product state are server-authoritative after authentication.
- Explicit user actions must be durable and must not be replaced by an
  unqueued device snapshot.
- Green repository checks cannot create formal content approval, deployment,
  or launch readiness.

## Implementation hypothesis changed

- Added authenticated `POST /v2/space/actions` with exact
  `space-actions.v2` input and `space-actions-ack.v2` output.
- Added immutable `softbook_space_actions` ledger records and account-scoped
  `softbook_space_states` projections. Exact replay returns `duplicate`; reuse
  of an action ID with different content rejects the complete batch with 409.
- Applied independent favorite and sleep clocks ordered by normalized
  `client_occurred_at` and then action ID. Memory and CloudBase commits include
  legacy migration, conflict reads, dimension merge, ledger inserts, and state
  write atomically.
- Required current track, normalized content version, and current card IDs.
  Production additionally requires a matching published content release.
- Migrated retained phone and phone-day space documents as read-only input
  using deterministic synthetic dimension actions.
- Disabled both `GET` and `POST /v1/space/state-sync` in every runtime with
  410; production continues to reject all v1 routes.
- Replaced mobile `sync_space_state` snapshots with credential-free
  `apply_space_action` commands persisted before optimistic UI authority.
- Migrated valid legacy queue snapshots into deterministic per-card favorite
  and sleep actions without retaining credentials, counters, or the original
  snapshot.
- Made canonical bootstrap the hydration base and overlaid only durable
  same-account and same-track pending actions. Same-track content updates
  rebind only the request envelope; immutable action fields and IDs do not
  change.
- Required strict ordered applied/stale/duplicate acknowledgements before
  queue removal, then refreshed canonical bootstrap before synchronized state
  or scheduler eligibility is accepted.
- Made remote space mode depend on remote canonical bootstrap at runtime
  configuration, so an invalid hybrid mode fails before the first user action.

## Workspace boundary and read scope

- Active truth/source read: referenced specs, active runtime contracts, mobile
  App/bootstrap/space/queue implementation, CloudBase API/store/scheduler
  implementation, focused tests, Harness mirrors, metadata scanners, and
  delivery governance.
- Generated/dependency/cache/archive read: installed dependencies were executed
  by tests; ignored local-gate reports were read only as validation output.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  modified or used as approval authority.

## Files changed

- Owner/runtime contracts: `spec/account-sync-contract.json`,
  `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/evals.json`,
  `AGENTS.md`, and active CloudBase runtime documents.
- Backend: new `space-actions-v2.js`, v2 routing, account canonical
  storage/ledger, bootstrap and scheduler reads, provisioning, v1 route guards,
  local mock, smoke coverage, and memory/CloudBase tests.
- Mobile: strict action repository/runtime endpoint, durable queue and legacy
  migration, canonical bootstrap parsing/overlay, App action persistence and
  replay, runtime dependency validation, and regression tests.
- Harness/scanners: owner/runtime/eval mirrors, GT-34, provisioning checks,
  negative fixtures, and action/ledger metadata terms.

## Commands run

- `npm test` in `infra/cloudbase/functions/softbook-api` -> 108 tests passed.
- `npm test -- --runInBand --watchAll=false --no-watchman` in `apps/mobile` ->
  38 suites and 361 tests passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed with zero errors.
- Targeted runtime configuration and App durability regressions -> 3 tests
  passed.
- `python3 scripts/validate_harness.py --mode local --profile` -> all 15
  selected local sections passed; completeness correctly remained partial
  because the remote delivery guard was not executed.
- Write-enabled isolated local mock smoke -> v2 auth/bootstrap/card
  source/session, daily check-in, learning event accepted/duplicate,
  space-action applied/duplicate, post-write bootstrap, all legacy snapshot
  guards, membership mutations, and logout passed.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12
  `./scripts/run_local_gates --profile dev --output
  exports/local-gates/space-actions-v2-final-dev.json` -> complete 18/18
  passed with network isolation and unchanged tracked-worktree digest.
- `git diff --check` -> passed before the run record was added and is repeated
  during delivery closeout.

## Validation results

- Backend request parsing rejects missing, scalar, null, empty, oversized,
  duplicate-ID, unknown-field, invalid-time, stale-content, unknown-card, and
  client-identity inputs before writes.
- Exact duplicate replay is idempotent; conflicting reuse of an action ID is
  atomic 409. A conflict in a later batch item leaves earlier items unwritten.
- Memory and CloudBase implementations preserve simultaneous writes and keep a
  maximum 20-action CloudBase transaction within 42 document operations.
- Stored state and ledger business schemas, ownership, clocks, digests,
  results, and acknowledgements are revalidated. Only CloudBase's `_id` adapter
  field is removable; other drift fails closed.
- Prototype-like card IDs are handled as data keys on backend and mobile maps.
- Mobile rejects malformed, expanded, unordered, cross-scope, and ambiguous
  acknowledgements, including impossible calendar timestamps.
- A remote action cannot change the UI or issue a request when durable queue
  storage fails. Favorite and sleep actions completed in one render turn
  preserve both dimensions.
- Late persistence completion cannot mutate a replacement auth session.
  Failed replay retains the exact action; same-track content refresh changes
  only the request envelope.
- Canonical bootstrap removes unqueued local authority, restores server state,
  and overlays only matching durable pending actions.
- Runtime configuration rejects remote space actions without remote canonical
  bootstrap.
- Test and smoke execution changed no tracked file beyond the intentional task
  diff and this run record.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed locally after path-by-path backend/mobile/runtime review,
  targeted negative tests, full regression, local mock smoke, Harness
  validation, and complete dev gates.
- Blocking findings: none.
- Findings resolved before pass: late persistence mutating a replacement
  session; weak calendar timestamp acceptance; same-track content-version queue
  deadlock; same-render favorite/sleep state overwrite; silently sorted
  canonical acknowledgement drift; configurable protocol limits; prototype-key
  map corruption; remote space mode without canonical bootstrap; and missing
  App-level proof that storage failure blocks optimistic state.

## User-visible UI impact

- Design artifact source:
  `docs/design/decisions/mobile-core-surface-reset-v1.md`,
  `docs/design/mocks/mobile-core-surface-reset-v1.html`, and
  `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`.
- Implementation mapping:
  `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`,
  existing Learning favorite control and Space sync rail.
- Mapping: no geometry, color, navigation, card silhouette, or interaction
  family changed. Existing status rails now distinguish safely saved,
  retrying, awaiting canonical confirmation, and synchronized action states.
- Unimplemented gap: no new visual capability is authorized by this slice;
  broader real-device visual QA remains release work.

## Design review checklist

- Q1: The active CET library and existing accent ownership are unchanged.
- Q2: Learning's card and Space's physical object remain focal; sync status
  stays secondary.
- Q3: The accepted single-card and quiet physical-space silhouettes are
  unchanged.
- Q4: No gradient text, gamification chrome, full-width tab bar, pure
  black/white substitution, removed self-assess token, or serif was added.
- Q5: No geometry changed; existing constrained status rails retain their
  accepted hierarchy and wrapping behavior.
- Q6: Learning remains server-sequenced, self-assessment remains exactly two
  states, and Space preserves independent favorite and sleep semantics.

## Card make external workspace impact

- N/A. No candidate card, review record, audio, approval batch, or exported
  payload changed.

## Risks and open questions

- Backend, mobile, mock, and contracts are repository-local and not deployed.
- Retained legacy space documents remain available only as migration input;
  production migration must be exercised against staged CloudBase data before
  deployment.
- Card source and membership v1 routes remain a development migration bridge;
  production still rejects every v1 route.
- Production SMS, payments, signed content publication, formal card approval,
  audio QC, observability, penetration testing, and release validation remain
  pending.

## Follow-up

- Run the strict real-PR local profile against PR `#442`.
- Record passed review in the PR only for the reviewed HEAD.
- Merge only after every required GitHub check passes, then verify the protected
  `main` result and keep deployment/launch readiness pending.
