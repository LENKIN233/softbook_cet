# Agent Run Record: Space sync drill raw report

## Task summary

- Date: 2026-08-23
- Branch: `infra/space-sync-drill-report-v1`
- PR: #522
- Summary: Add a dry-run-first, privacy-safe receiver runner that can prove
  two-client canonical Space apply/replay/conflict/dimension/cleanup behavior
  and emit raw report v1 without claiming formal evidence.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json#physical_space_actions_v2`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- Physical Space is canonical account state, not a local collection view.
- Favorite and sleep are independent dimensions; sleep controls scheduler
  eligibility without deleting learning history.
- The server session owns identity. Clients cannot submit phone, snapshot,
  counters or account identity.
- Repository tests and raw reports are not receiver execution or formal
  `space-sync-test` evidence.

## Implementation hypothesis changed

- `run-space-sync-drill.mjs` is dry-run by default and emits no remote request.
- Apply requires Node 22.13, clean exact main/origin, receiver closed-beta
  profile, identified operator and two distinct environment-only sessions.
- One exact 1,180-card CET4 source and content version are used throughout.
- Client A favorite apply is observed by client B; exact replay must be
  `duplicate`; conflicting payload reuse must be 409 with stable revision.
- Client B sleep apply is observed by client A while favorite remains intact.
- Every new action increments the canonical Space revision exactly once;
  duplicate and conflict increment zero times.
- New favorite/sleep restore actions return the account to its initial state.
  A post-initial failure attempts both restores and verifies bootstrap before
  reporting whether cleanup recovered; it never reports pass on failure.
- `space-sync-drill-report.v1` binds commit, raw profile hash, expected backend
  identity, content/action hashes, revision/state observations, write safety and
  execution. Tokens, phone and raw card ID are excluded; `gate_eligible=false`.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, receiver delivery identity,
  existing API smoke parser and Space runtime tests.
- Generated/dependency/cache/archive read: backend dependencies only; not
  product truth and not retained as evidence.
- External card workspace and receiver control plane: none.

## Files changed

- Space sync drill runner and backend mock/negative tests.
- Account-sync/runtime mirrors and Space runtime/README instructions.
- HR-50 / GT-43, formal approval classifier and harness mirror.
- `docs/agent-runs/2026-08-23-space-sync-drill-report.md`: this record.

## Commands run

- Focused Space drill runner tests -> 4/4 passed.
- Combined beta/content/builder/classifier/closed-beta/public-launch tests ->
  74/74 passed after replay onto merged #520 `main`.
- `npm test` backend -> 302/302 passed.
- Formal approval classifier -> 10/10 passed.
- Learning contract -> 17/17 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/space-sync-drill-report-v1-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- Applied mock sequence reaches revisions 0 -> 1 -> 1 -> 1 -> 2 -> 3 -> 4
  and restores the initial favorite/sleep state.
- Unsafe branch/identity, same token, production profile, duplicate revision
  advance and conflict revision advance fail closed.
- Serialized passed report contains neither supplied session token.

## Binary evidence

- Evidence manifest: N/A. No binary evidence was generated.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed final exact-main semantic and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None.

## Card make external workspace impact

- None.

## Risks and open questions

- No receiver API was called, so no real report exists and `space-sync-test`
  remains unregistered/not passed.
- Expected backend deployment identity is locally derived. A formal wrapper
  must pair the report with exact production-deployment evidence.
- Tokens must represent two sessions for a dedicated same-account test user;
  cross-client revision/state observation is the runtime confirmation.

## Follow-up

- Publish and auto-merge this raw-report capability PR.
- Register strict `space-sync-test` evidence semantics over a tracked real raw
  report plus exact production deployment/candidate bindings.
