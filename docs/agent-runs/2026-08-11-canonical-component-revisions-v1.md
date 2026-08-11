# Agent Run Record: Canonical component revisions v1

## Task summary

- Date: 2026-08-11
- Branch: `cross/canonical-component-revisions-v1`
- PR: pending
- Summary: make authenticated bootstrap owner revisions causally comparable,
  preserve canonical learning/progress/space/membership state across retries,
  day rollover, app wake, rollback, and previous-package writes, and prevent
  terminal authorization failures from leaving stale authenticated UI. This
  runtime slice is a prerequisite for later accepted visual implementation; it
  does not claim final UI, deployment, launch readiness, or product-owner
  approval.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- The server remains canonical for authenticated membership, learning,
  progress, check-in, scheduler cursor, and physical-space state.
- Durable confirmed operations must not be lost or relabeled by a later stale
  read, a same-phone replacement session, app wake, or package rollback.
- The product day is China UTC+8 and cannot be inferred independently from the
  device timezone or UTC calendar day.
- UI must never invent completed progress, exact resume, successful sync, or an
  authenticated state that the active session no longer proves.
- Grayscale architecture evidence is not final UI. This runtime change cannot
  authorize or substitute for an independently accepted visual system.

## Implementation hypothesis changed

- `bootstrap-component-revisions.v1` supplies strict owner-scoped vectors for
  Membership, Learning, Progress, and Space without inventing a global scalar
  revision.
- The CloudBase Membership base revision is stored in a digest-bound sidecar
  committed atomically with the rollback-compatible business document. A
  previous-package write is detected by digest mismatch and advances safely.
- Space keeps the previous package's exact `space-state.v2` business document,
  while `space-state-revision.v2` stores the canonical state digest and
  deterministic cumulative action digest/result bindings. Immutable lineage
  plus the current binding is required for duplicate acknowledgement; old
  schema ledgers without direct current-state proof fail closed unless a
  fenced rollout baseline exists.
- Mobile request generations and auth-session scopes reject late or replaced
  bootstrap/replay results. Terminal 401/403 clears only the originating live
  session and its durable account queue, never a replacement session.
- Mobile derives and reacts to China-day rollover, refuses prior-day progress
  as today, settles failed rollover refresh as `待更新`, and treats only real
  offline-to-online or inactive-to-active changes as external replay wakes.
- Space content mismatch stores a causal baseline and pauses repeated refresh
  until an explicit external wake or a changed canonical/content observation.
- Durable retained learning events validate the live account/release before
  exact replay, replay before current-session hydration, survive content/day
  rollover, and are not blocked by an unrelated Space pause.
- Durable generic queue reads fail closed on storage I/O, retry hydration
  without overwriting bytes, and rotate inactive-track Space entries past
  current-track/account-wide work without deleting them.
- Runtime exception text is never rendered as user copy; only explicit remote
  operation mappings can cross the user-facing error boundary.
- Before the first accepted v2 event, Progress carries an explicit
  `legacy_account_baseline` authority derived from the latest valid account-wide
  legacy daily snapshot (with legacy learning-state fallback), so pending
  review stays stable across China-day rollover without weakening mobile's
  equal-sequence invariant.
- A retained generic mutation queue pauses behind a current validated bootstrap
  whose content cannot hydrate the active session; default effects cannot spin
  bootstrap, while one explicit external wake may force one fresh attempt.

## Workspace boundary and read scope

- Active source read: referenced specs, React Native auth/bootstrap/persistence
  and mutation replay code, CloudBase bootstrap/membership/learning/progress/
  space stores, runtime contracts, provisioning/deployment safety, mock/smoke,
  Harness mirrors, and directly related tests.
- Generated/dependency/cache read: local gate reports and installed `node_modules`
  were used only as diagnostic or validation inputs and are not product truth.
- Archive read: none.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  read or changed because this work neither produces nor approves card content.

## Files changed

- `apps/mobile/App.tsx`: session-scoped bootstrap generations, strict canonical
  hydration/replay ordering, terminal authorization cleanup, China-day rollover,
  wake coalescing, canonical counts, and bounded Space mismatch recovery.
- `apps/mobile/src/bootstrap/accountBootstrapRevision.ts` and
  `accountBootstrapRequestGate.ts`: strict component vector parsing,
  monotonic/equal-revision invariants, and request cancellation/coalescing.
- Mobile auth/bootstrap/day/mutation persistence modules and tests: durable
  queue compare-and-swap, restored-session cleanup, strict bootstrap invariants,
  prior-day filtering, and failure/reconnect coverage.
- CloudBase `bootstrap-v2.js`, `index.js`, and `space-actions-v2.js`: owner
  revisions, transactionally consistent Progress reads, Membership revision
  sidecars, Space revision/action-lineage sidecars, rollback compatibility,
  and committed-ledger proof.
- CloudBase provisioning, deployment safety, mock/smoke, runtime contracts, and
  backend tests: register and exercise the new collections and wire contract.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, and Harness
  product-contract mirrors: record the sidecar storage and transaction boundary.
- `docs/agent-runs/2026-08-11-canonical-component-revisions-v1.md`: this record.

## Commands run

- Mobile `npm test -- --runInBand` -> 46/46 suites and 492/492 tests passed.
- Mobile `npm run typecheck` -> passed.
- Mobile `npm run lint` -> zero errors and 15 existing inline-style warnings.
- Backend `npm test` -> 219/219 tests passed.
- Local mock API plus write-enabled `smoke-softbook-api.mjs` -> auth rotation,
  strict bootstrap, learning session, daily check-in, disabled v1 snapshots,
  learning-event accepted/duplicate, Space action applied/duplicate, membership
  mutations, post-write bootstrap, and logout all passed.
- Node syntax checks for every changed JavaScript/MJS runtime file -> passed.
- JSON parsing for changed owner specs and `git diff --check` -> passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> validation OK;
  local completeness remained explicitly partial as designed.
- First dev local-gate run with `--fail-fast` stopped at the stale Harness
  mirror and is not treated as passing evidence.
- Second dev local-gate run passed 19/24; four Web commands were unavailable
  because `apps/web/node_modules` had not been installed and are not treated as
  code passes.
- `npm ci` in `apps/web` installed the lockfile-defined dependencies with zero
  reported vulnerabilities.
- Latest `scripts/run_local_gates --profile dev` ->
  23/24 passed plus one documented dev-only Node 25.9.0 versus expected 22.13.0
  toolchain exception; tracked worktree integrity passed.

## Validation results

- Mobile and backend focused/full suites, syntax, JSON, metadata leakage scan,
  local mock HTTP smoke, Harness runner tests, and repository dev gates passed
  as listed above.
- Final local report:
  `exports/local-gates/20260811T032154Z-b423d8ff-dev-19373/report.json`.
- The local report is diagnostic only; it is not GitHub required-check,
  deployment, launch, or formal evidence.
- Independent agent review passed with P0=0, P1=0, and P2=0. GitHub PR and
  required checks remain pending.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A. This slice does not add screenshots, recordings, or other
  binary product evidence.

## Agent review status

- Status: passed on the stable candidate bytes; P0=0, P1=0, P2=0.
- Fixed during review: prior-day progress counted as today; terminal 401/403
  misclassified as cancellation; stale replacement-session cleanup; retained
  event content/day races and retry loops; Space-pause reverse blocking;
  integrity-lock recovery and write TOCTOU; legacy sequence-zero wire/day
  migration; transient queue-read data loss; cross-track starvation; arbitrary
  exception-copy leakage; empty-queue bootstrap livelock; coordinated
  ledger/lineage rewrite acceptance; rollback-incompatible inline revisions;
  orphan/unproven action ledgers; legacy pending-review day rollover; retained
  generic-queue/content-mismatch refresh looping; Progress authority marker
  relabeling/inconsistent sequence states; and Harness/spec drift.
- Blocking findings: none. PR gates remain required before merge.

## User-visible UI impact

- User-visible status and counts now remain tied to current canonical day,
  track, content, revision, and active auth session. Failed rollover settles as
  `待更新`; terminal authorization returns to the login surface; offline replay
  remains truthful and bounded.
- No final visual system, component silhouette, color theme, or motion authority
  is created by this change. The current grayscale architecture artifact remains
  internal-only and is not a shippable UI candidate.
- Final colorful UI still requires an independently accepted design artifact,
  implementation mapping, interaction/motion evidence, and real iOS/Android/
  tablet/Web visual validation under `spec/visual-language.json`.

## Card make external workspace impact

- None. No candidate card payload, approved batch, audit record, audio asset, or
  file in `/Users/lenkin/programing/card make` changed.

## Risks and open questions

- The backend and mobile changes are repository-local and not deployed.
- The final dev gate used Node 25.9.0 under the repository's documented dev-only
  exception; exact Node 22.13.0 remains required for strict PR/release evidence.
- Sidecar collections must exist in the receiver environment before deployment;
  deployment safety and provisioning include them, but no receiver write was
  performed in this run.
- Previous-package Space ledgers that were legitimately applied and later
  superseded cannot be distinguished from forged orphan records by the old
  schema. They require a fenced baseline/intermediate dual-write during rollout;
  the repository-local runtime intentionally fails closed without that proof.
- `space-state-revision.v2` currently carries cumulative action bindings. This
  closes the identified partial-write/tamper gap but still needs receiver-scale
  sizing evidence before deployment.
- No final accepted visual direction exists yet. Leadership should not evaluate
  the grayscale architecture page as the product UI.

## Follow-up

- Complete independent review, resolve every finding, commit the exact candidate,
  open/update the PR, and run strict PR gates with the required toolchain.
- After the canonical runtime prerequisite is merged, freeze the interaction
  architecture, generate at least eight genuinely distinct complete colorful
  visual systems, independently accept one, and only then implement final UI.
- Run real-start, real-use iOS, Android, tablet, and PC Web tests, including
  overflow, safe-area, keyboard, dynamic type, state recovery, metadata leakage,
  and UI/UX director audit before any leadership-readiness claim.
