# Agent Run Record: Learning events v2 owner contract

## Task summary

- Date: 2026-07-21
- Branch: `infra/learning-events-v2-contract`
- PR: https://github.com/LENKIN233/softbook_cet/pull/434
- Summary: Define the authoritative `learning-events.v2` event,
  idempotency, acknowledgement, ordering, projection, offline replay, and
  migration boundary before implementing a backend ledger or replacing mobile
  v1 snapshot writes.

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

- Learning state must sync across release surfaces with at least daily-level
  consistency, while exact same-card cross-device resume is not required.
- The server remains authoritative for shared learning state and derived
  learning aggregates.
- The visible flip self-assessment remains two-state; this contract does not
  introduce a four-grade user interaction.
- Card completion remains the learning progress unit. Physical-space state,
  check-in, membership, content approval, and scheduler decisions retain their
  separate owners.

## Implementation hypothesis changed

- `spec/account-sync-contract.json#learning_events_v2` now owns a strict
  `learning-events.v2` request and `learning-events-ack.v2` response for
  `POST /v2/learning/events`.
- Every event has an immutable stable `event_id`, exact content version,
  two-state answer grade, client time, and pseudonymous installation cursor.
- Exact replay returns `duplicate` with the original account-scoped
  `server_sequence`. Mutating an event payload or forking a device cursor
  rejects the entire request with HTTP 409.
- New events, sequence allocation, and server-derived learning projections
  must commit atomically. Client snapshots, progress counters, membership,
  physical-space state, content text, and scheduler-owned fields are forbidden.
- Client time and device sequence are not canonical ordering authority.
  `server_sequence` is canonical, and post-replay reconciliation requires a
  fresh `/v2/bootstrap` read.
- The contract is explicitly `defined_not_implemented`; endpoint, backend
  ledger, mobile producer, legacy-write removal, and scheduler remain separate
  serial changes.

## Workspace boundary and read scope

- Active truth/source read: the referenced owner, runtime, Harness, delivery,
  and run-record specs; current v1 mobile learning/progress repositories and
  mutation queue; CloudBase v1 sync store, v2 bootstrap contract, workflow, and
  local gate catalog.
- Generated/dependency/cache/archive read: ignored local gate reports under
  `exports/local-gates/` only as command evidence; none was used as product
  truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  opened or modified because this change does not produce or approve content.

## Files changed

- `spec/account-sync-contract.json`: own the complete learning event contract
  and replace the old mixed client/server ordering hypothesis.
- `spec/runtime-boundaries.json`: mirror the contract-only implementation
  status without claiming endpoint, client, scheduler, or launch completion.
- `spec/agent-harness.json` and `AGENTS.md`: add a task-specific runtime read
  path without loading the event document for unrelated auth work.
- `spec/evals.json`: add HR-37 and GT-28 idempotency/authority regressions.
- `infra/cloudbase/learning-events-v2-runtime-contract.md`: document request,
  response, conflicts, transaction, projections, offline replay, migration,
  required implementation tests, and explicit non-claims.
- `infra/cloudbase/README.md` and
  `infra/cloudbase/mobile-runtime-contract.md`: distinguish the contracted next
  endpoint from the actually active v1 mutation bridge.
- `scripts/harness_validator/sections/product_contract_mirrors.py`: enforce
  owner, mirror, eval, runtime-document, and Agent-read-path invariants in the
  pure truth-spec layer.
- `scripts/test_learning_events_contract.py`: add positive and deliberately
  broken owner-contract tests.
- `spec/repo-delivery-contract.json`,
  `scripts/harness_validator/sections/governance_contracts.py`,
  `.github/workflows/pr-gates.yml`, and `scripts/local_gates/catalog.py`: wire
  the dedicated regression command through the delivery-governance layer.
- `README.md` and `docs/branching-strategy.md`: document the required gate.
- `docs/agent-runs/2026-07-21-learning-events-v2-contract.md`: this record.

## Commands run

- `jq empty spec/account-sync-contract.json spec/runtime-boundaries.json
  spec/agent-harness.json spec/evals.json` -> passed.
- `python3 scripts/test_learning_events_contract.py` -> 7/7 tests passed after
  replacing one Markdown line-wrap-sensitive assertion with a stable semantic
  marker.
- `python3 scripts/test_harness_module_boundaries.py` -> 18/18 tests passed.
- `python3 scripts/test_validate_harness_runner.py` -> 21/21 tests passed.
- `python3 scripts/test_run_local_gates.py` -> 29/29 tests passed.
- `python3 scripts/validate_harness.py --mode local --section
  product_contract_mirrors --format text` -> selected truth contract passed and
  correctly reported partial completeness.
- `python3 scripts/validate_harness.py` -> all 15 sections passed, including
  the live remote delivery guard.
- `./scripts/run_local_gates --profile dev --verbose` under the interactive
  shell -> `passed_with_exception`, 17/18, because Node 25.9.0 differed from
  the pinned Node 22.13.0. The result is retained but is not complete evidence.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH
  ./scripts/run_local_gates --profile dev` -> 18/18 passed with Python 3.12.13,
  Node 22.13.0, Ruby 3.3.12, no safe exceptions, and unchanged tracked state.
- The same exact-toolchain `dev` command was rerun after the final staged
  contract, Harness-layer, documentation, and run-record changes -> 18/18
  passed again with no exceptions.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH
  ./scripts/run_local_gates --profile pr --base origin/main --pr 434` -> first
  run passed 29/30 and failed only `repo-health-strict` because the single-branch
  clone had an upstream name but no topic remote-tracking ref. This result is
  retained and is not treated as a pass.
- `git config --add remote.origin.fetch
  '+refs/heads/infra/learning-events-v2-contract:refs/remotes/origin/infra/learning-events-v2-contract'`
  plus `git fetch origin infra/learning-events-v2-contract` -> restored the
  exact temporary topic tracking ref required by strict repository health.
- The strict `pr` profile was then rerun unchanged -> 30/30 passed with no safe
  exceptions or deferred gates.

## Validation results

- Dedicated owner-contract regressions: 7/7 passed.
- Final staged exact-toolchain dev gates: 18/18 passed; report:
  `exports/local-gates/20260720T204339Z-fa954197-dev-68929/report.json`.
- Earlier exact-toolchain dev report retained at:
  `exports/local-gates/20260720T203925Z-fa954197-dev-63125/report.json`.
- Interactive-shell drift report retained at:
  `exports/local-gates/20260720T203853Z-fa954197-dev-62135/report.json`.
- Full Harness: passed all 15 sections with the remote guard executed.
- Failed strict PR audit retained at:
  `exports/local-gates/20260720T204823Z-d04f6737-pr-74772/report.json`.
- Strict PR profile: 30/30 passed on `d04f6737f0b662e808c59de2eace284db2dfe7c5`;
  report: `exports/local-gates/20260720T204926Z-d04f6737-pr-78997/report.json`.
- GitHub required checks: pending final pushed commit.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none after correcting the legacy ordering conflict,
  truth/delivery Harness ownership, broad auth read-path pollution, README
  section placement, strict unknown-field handling, and client scheduler-field
  authority.

## User-visible UI impact

- N/A. No screen, component, copy, motion, visual token, or interaction UI
  changes.

## Card make external workspace impact

- N/A. No card payload, review state, approval record, audio, or external
  workspace file changes.

## Risks and open questions

- The exact event batch limit, event retention window, and accepted client-time
  skew remain deployment configuration and must be fixed with backend tests.
- Account-scoped server sequence allocation requires a real transaction and
  concurrency test; this PR intentionally does not fake it in the existing v1
  snapshot store.
- A future scheduler may map `passed` / `review_needed` and objective outcome
  to a versioned algorithm input on the server. Clients cannot submit raw FSRS
  state, and the visible self-assessment remains two-state.
- The current CloudBase CommonJS/NoSQL adapter is staging infrastructure, not
  the planned TypeScript/PostgreSQL production platform.
- Green contract and governance checks do not prove a callable endpoint,
  idempotent runtime behavior, formal content approval, scheduler readiness, or
  launch readiness.

## Follow-up

- After this contract merges and passes on `main`, implement the transactional
  backend event ledger, uniqueness constraints, sequence allocation,
  projections, and all required implementation tests without changing the
  mobile producer yet.
