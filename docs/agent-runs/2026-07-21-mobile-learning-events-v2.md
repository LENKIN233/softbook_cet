# Agent Run Record: Mobile learning events v2

## Task summary

- Date: 2026-07-21
- Branch: `module/mobile-learning-events-v2`
- PR: pending
- Summary: Adopt the repository-local `learning-events.v2` contract in the
  React Native runtime with a durable credential-free outbox, strict
  acknowledgement removal, canonical bootstrap reconciliation, and removal of
  active mobile v1 learning snapshot writes. This record does not claim
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
- `spec/visual-language.json`

## Product truth used

- Authentication remains required before learning, and canonical account
  learning state remains server-authoritative.
- Card completion is the progress unit. The visible self-assessment remains the
  accepted two-state `passed` / `review_needed` mapping; no four-grade control
  or client-owned scheduling state was introduced.
- Exact same-card cross-device resume is not required. The client reconciles
  against canonical account state after accepted events.
- Check-in, physical-space state, membership, scheduling, content approval, and
  production publication retain separate authorities.
- Local green tests cannot become formal approval or launch evidence.

## Implementation hypothesis changed

- A versioned AsyncStorage outbox persists the immutable event and allocated
  pseudonymous installation cursor before the current card advances.
- Replay preserves event bytes and queue order, submits at most nine contiguous
  same-track events, and removes entries only after a strict ordered
  `accepted` / `duplicate` acknowledgement.
- Authenticated startup discovers restored pending events. Those events block a
  duplicate stale-card advance until acknowledgement and a post-acknowledgement
  canonical bootstrap have been applied.
- Daily-progress and physical-space writes wait behind pending learning events;
  generic queue updates now mutate memory only after storage succeeds and late
  responses cannot consume a replaced head entry.
- Replay, bootstrap, enqueue completion, and authenticated HTTP authorization
  handling are scoped to the originating session, including same-phone
  reauthentication. A session replacement while token lookup is pending aborts
  the request before any replacement credential can be sent.
- Active mobile completion no longer calls `/v1/learning/state-sync`; persisted
  legacy `sync_learning_state` queue entries are discarded during hydration.

## Workspace boundary and read scope

- Active truth/source read: referenced specs, mobile auth/bootstrap/learning and
  persistence code, CloudBase runtime contracts and mock/smoke tools, Harness
  mirrors, tests, and recent Agent run records.
- Generated/dependency/cache/archive read: ignored local gate output and
  installed dependencies were used only for validation; they were not treated
  as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  changed because this slice neither produces nor approves card content.

## Files changed

- `apps/mobile/src/sync/learningEvent*.ts`: add strict event transport, durable
  outbox, replay, and runtime configuration; remove active v1 learning snapshot
  repository/configuration.
- `apps/mobile/App.tsx`: integrate durable-before-advance production,
  bootstrap-before-replay and bootstrap-after-ack reconciliation, dependent
  mutation ordering, restore recovery, logout cleanup, and session-scoped stale
  response guards.
- `apps/mobile/src/auth/*` and `apps/mobile/src/sync/mutationQueue*.ts`: prevent
  replacement-session credential races and make generic queue persistence and
  late-result handling transactional.
- Mobile tests and metadata scan: cover durability failure, exact replay,
  restored outbox recovery, account/session replacement, strict ACK parsing,
  queue ordering, and v1 write absence.
- `infra/cloudbase/mock-softbook-api.mjs` and
  `infra/cloudbase/smoke-softbook-api.mjs`: exercise the real in-memory v2
  service and prove accepted, exact duplicate, and canonical bootstrap reads.
- Runtime documentation, owner specs, evals, contract regressions, and Harness
  mirrors: record the implemented-local mobile boundary and explicit non-claims.
- `docs/agent-runs/2026-07-21-mobile-learning-events-v2.md`: this record.

## Commands run

- Exact Node 22.13.0 mobile `npm run lint` -> passed with 14 pre-existing inline
  style warnings and zero errors after removing one unused test binding.
- Exact Node 22.13.0 mobile `npm run typecheck` -> passed.
- Exact Node 22.13.0 mobile `npm test -- --runInBand` -> final local gate run
  passed 36/36 suites and 288/288 tests, including the replacement-credential
  race regressions.
- Exact Node 22.13.0 backend `npm test` -> 71/71 passed.
- `python3 scripts/test_learning_events_contract.py` -> 12/12 passed.
- `python3 scripts/validate_harness.py --mode local` -> all 15 selected local
  sections passed with expected partial completeness.
- Python compilation and Node syntax checks for changed contract, Harness,
  mock, and smoke files -> passed.
- Local mock API plus write-enabled smoke -> accepted one v2 event, returned the
  same server sequence for exact duplicate replay, restored its canonical
  projection through bootstrap, and completed auth logout.
- An initial local-gate invocation selected system Python 3.9.6 and failed 15/18
  (`toolchain`, runner tests, and local Harness). It was rerun with the required
  interpreter and is not treated as passing evidence.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12
  `./scripts/run_local_gates --profile dev --output
  exports/local-gates/mobile-learning-events-v2-dev.json` -> 18/18 passed with
  no exception or deferred result and unchanged tracked worktree state.
- `git diff --check` -> passed after the final local gate run.

## Validation results

- Focused and full local validation listed above passed.
- Exact-toolchain dev report:
  `exports/local-gates/mobile-learning-events-v2-dev.json`; complete, 18/18
  passed, no safe exceptions.
- GitHub required checks: pending pushed commit and PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, generated report, or binary product
  artifact is tracked by this runtime change.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none open. Review found and fixed storage-failure advance,
  cross-track reordering, stale-session state mutation, same-phone replacement
  invalidation, dependent-write overtaking, pre-ack bootstrap overwrite,
  in-flight follow-up loss, restored-event duplicate advance, generic queue
  non-transactional persistence, same-ID late-result removal, and replacement
  credential attribution races.

## User-visible UI impact

- Existing Learning and Mine synchronization status surfaces now distinguish
  durable local recording, server acknowledgement, canonical refresh, and
  retryable failure. No layout, component silhouette, visual token, control,
  interaction family, or motion changed.
- Design basis remains `docs/design/visual-reference.html`,
  `docs/design/canon.md`,
  `docs/design/mapping/learning-space-implementation-map-v1.md`, and
  `docs/design/interaction-motion/learning-core-interactions-v1.md`. The latter
  already requires remote failure to queue without rolling back a durably
  recorded result.

## Card make external workspace impact

- None. No card payload, review state, formal approval record, audio, or external
  workspace file changed.

## Risks and open questions

- The endpoint, mobile implementation, and mock are repository-local and not
  deployed. Production remote configuration and real-device staging validation
  remain separate gates.
- The server scheduler/FSRS adapter and scheduler cursor remain unimplemented.
- Authenticated Mine currently has no visible logout command even though the
  cleanup handler exists; adding one requires an accepted design artifact.
- Remote fetch calls do not yet have a shared timeout/cancellation policy. A
  permanently hung old replay can delay a replacement session's replay, while
  the outbox remains durable and current-session offline completion can continue.
- Current remote content remains development-only; formal card approval, signed
  packs, audio QC, publication, payments, compliance, and launch gates remain
  outside this change.

## Follow-up

- Complete exact-toolchain dev/PR gates and GitHub required checks, then merge
  without bypass.
- Implement a bounded authenticated request timeout/cancellation policy as a
  separate resilience slice before production deployment.
- Start the server scheduler only after this mobile adoption is merged and
  proven against staging.
