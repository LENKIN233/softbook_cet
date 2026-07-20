# Agent Run Record: mobile bootstrap v2 adoption

## Task summary

- Date: 2026-07-20
- Branch: `cross/mobile-bootstrap-v2-adoption`
- PR: https://github.com/LENKIN233/softbook_cet/pull/432
- Trigger: Continue the production launch path after the backend canonical
  bootstrap merged in PR #431.
- Summary: Make authenticated mobile login and session restore reconcile through
  `/v2/bootstrap`, bind canonical state to the exact remote card-source content
  version, and gate persistence, remote writes, and mutation replay until the
  canonical snapshot and loaded content agree.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Account, learning, physical-space, and membership state are shared and
  server-authoritative across release surfaces.
- Daily progress and useful learning state must survive device changes; exact
  same-card cross-device resume is not required.
- Authenticated offline use is allowed only with previously validated state and
  required content.
- Production remote failures cannot substitute bundled development cards or
  grant membership locally.
- Green validation and content hashes do not create formal card approval,
  content publication, or launch readiness.

## Implementation hypothesis changed

- The full remote mobile profile reads `/v2/bootstrap` after v2 login or session
  restore and before loading account-backed product state.
- The client strictly validates bootstrap schema, scope, timestamps, content
  metadata, membership, progress, learning state, cursor, and physical space.
- The development `/v1/learning/card-source` response now exposes the backend's
  validated `content_version`; mobile requires an exact match with bootstrap
  before enabling learning or persisting reconciled state.
- Remote bootstrap cannot be paired with a local card source. Staged smoke must
  keep `accountBootstrap` and `learningSource` local together.
- A first canonical-read failure keeps a valid auth session retryable but blocks
  learning, product-state writes, persistence, and mutation replay. A later
  transient refresh failure may continue using the already validated in-memory
  snapshot.
- Reconnect reads canonical state before replay, waits for content mapping, then
  reads canonical state again after acknowledged replay. An incompatible
  refreshed content version prevents replay.

## Workspace boundary and read scope

- Active source read: referenced specs, mobile runtime/config/repositories,
  persistence and sync code, CloudBase bootstrap/card-source code, mock/smoke
  scripts, tests, and recent Agent run records.
- Generated/dependency/cache read: installed mobile and CloudBase dependencies
  were used only for validation; ignored reports are not product truth.
- Remote read: GitHub state will be read only during PR delivery and strict
  remote gates.
- External workspace read: none. `/Users/lenkin/programing/card make` remains
  the candidate-content and formal-approval workspace.

## Files changed

- `apps/mobile/src/bootstrap/*`: authenticated bootstrap repository, strict
  parser, runtime config, and canonical reconciliation helpers.
- `apps/mobile/App.tsx`: login/restore hydration, content mapping, write and
  replay barriers, retry/reconnect handling, and canonical membership refresh.
- Mobile learning model/source/repository/runtime files: carry and enforce the
  server content version and safe staged-profile relationship.
- Mobile tests: parser, hydration, config, persistence, failure-close, prior
  validated-state, content mismatch, and reconnect race coverage.
- CloudBase function/mock/smoke: expose card-source `content_version` and prove
  it equals bootstrap content identity.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, mobile
  README, and runtime contract: document the adopted behavior and remaining
  development boundary.
- `docs/agent-runs/2026-07-20-mobile-bootstrap-v2-adoption.md`: this record.

## Commands run

- Exact Node 22.13.0 mobile focused Jest suites -> passed.
- Exact Node 22.13.0 `npm test -- --runInBand` in `apps/mobile` -> 34 suites,
  251 tests passed.
- Exact Node 22.13.0 `npm run typecheck` -> passed.
- Exact Node 22.13.0 `npm run lint -- --quiet` -> passed; a non-quiet run
  reported 0 errors and the same 14 existing inline-style warnings.
- Exact Node 22.13.0 backend `npm test` -> 39/39 passed.
- Stateful local HTTP smoke with writes and membership mutations -> auth,
  refresh, bootstrap/card-source version match, state writes, membership
  mutations, post-write bootstrap, and logout passed.
- Exact Python 3.12.13 `scripts/run_local_gates --profile dev` -> 17/17 passed,
  complete, no skips, deferred checks, or safe exceptions; report:
  `exports/local-gates/20260720T164728Z-7c31761f-dev-17509/report.json` (ignored
  local artifact).
- One discarded invocation through the script shebang selected Xcode Python
  3.9.6 and correctly failed toolchain plus Python-3.10-syntax harness tests;
  it was rerun through the required Python 3.12 executable and is not treated
  as a product failure or passing report.
- Exact Python 3.12.13 `scripts/validate_harness.py --profile` -> all 15
  selected sections passed.
- Exact Python 3.12.13
  `scripts/run_local_gates --profile pr --base origin/main --pr 432` -> first
  run collected 26/29 and exposed missing machine-readable design evidence,
  unchecked validation boxes, and an unmaterialized topic upstream; the second
  run collected 27/29 and exposed the canonical full-Harness command spelling
  plus the missing topic fetch refspec; after correcting PR metadata and local
  tracking configuration, the strict profile passed 29/29. A final-SHA rerun
  remains required after this record-only commit.
- `git diff --check` -> passed after review fixes.

## Validation results

- Focused repository and integration regressions pass, including strict
  timestamps, impossible dates, duplicate IDs, source/count/version drift,
  unknown canonical cards, initial failure close, later refresh degradation,
  and replay ordering.
- A mismatched card-source version does not overwrite validated local user
  state, replay queued mutations, or allow remote membership writes.
- Backend integration proves the card-source and bootstrap versions are equal
  for the same normalized source.
- Full harness, local dev gate, strict PR gate, and final self-review passed.
  GitHub required checks remain pending and are not implied by the local result.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, recording, audio, generated report, or binary
  product artifact is created by this runtime change.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none open.
- Findings corrected before pass: the first implementation validated only the
  SHA-256 shape rather than binding bootstrap to the loaded content; a later
  refresh failure discarded an already validated in-memory baseline; a stale
  React closure could replay queued mutations before refreshed content mapping;
  local persistence could run before content validation; direct runtime config
  could bypass the remote bootstrap/card-source relationship; content mismatch
  still allowed remote membership mutations; timestamp and semantic-version
  fields were under-validated; and canonical parser failures could expose
  internal English diagnostics in user-visible error surfaces.

## User-visible UI impact

- No layout, component, motion, visual-token, or interaction-design change.
- Existing loading/error/retry surfaces now fail closed while a first canonical
  account read or content-version check is unavailable. A valid login remains
  available for retry instead of silently loading local cards.

## Card make external workspace impact

- No external card, review, approval, or audio file changed.
- This repository consumes and validates runtime payload identity only. It does
  not produce candidate content or write formal approval records.

## Risks and open questions

- Product mutations and card payload delivery still use development-only
  `/v1` endpoints; production continues to reject them.
- No validated remote card pack is persisted for an offline cold start, so a
  relaunched app still needs remote content before learning.
- Published `minimum_client_version` is shape-validated but not yet compared to
  a signed native/web build version; production content delivery is still
  unavailable and must add that enforcement before publication can be enabled.
- Idempotent `learning-events.v2`, server scheduling/FSRS, signed manifests and
  packs, audio delivery, and production payments remain unimplemented.
- The CommonJS CloudBase function and NoSQL collections remain a staging
  implementation rather than the planned TypeScript/PostgreSQL production
  platform.
- Real SMS, account-deletion completion, approved full content, and launch
  readiness remain outside this change.

## Follow-up

- Rerun the strict PR gate on the final record commit, then require every GitHub
  required check to pass before changing the PR from draft or merging.
- After merge, replace legacy snapshot writes with idempotent learning events
  and server-derived scheduling before implementing persisted signed content
  packs and cold-start offline use.
