# Agent Run Record: Mobile Learning Session v1

## Task summary

- Date: 2026-07-24
- Branch: `module/mobile-learning-session-v1`
- PR: `#440`
- Product-owner decision: the user explicitly approved this repository-local learning-session binding slice. This is not formal card-content approval or launch approval.
- Summary: Complete the repository-local mobile `learning-session.v1` consumer and bind every unseen `learning-events.v2` completion to the exact server selection, while preserving fail-closed recovery and non-deployment boundaries.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`

## Product truth used

- Learning remains one server-sequenced card flow; the client does not choose a replacement card.
- Due review precedes new material, and the visible self-assessment remains two-state.
- Membership and sleeping-card access are server-authoritative.
- A green local implementation does not create formal content approval, production deployment, or launch readiness.

## Implementation hypothesis changed

- Added a strict authenticated `learning-session.v1` parser and repository read alongside the canonical card source.
- Remote learning now requires exact track, source, content SHA-256, card-count, membership/access-mode, and selected-card accessibility agreement.
- The mobile app renders only the selected card, uses the server phase, accepts `selection: null`, and bypasses client membership, sleep, review, and catalog ordering for server sessions.
- `learning-events.v2` now requires `selection_id`; the mobile outbox persists selection ID, card, phase, content version, event ID, and device cursor before UI advance.
- Replaced the unbound v1 outbox with `learning-event-outbox.v2`; v1 data is removed without replay.
- Restricted the mobile outbox to one pending unseen completion per account. Acknowledgement, bootstrap reconciliation, and a fresh session read are required before another completion.
- Invalidated the consumed session immediately after acknowledgement, including when post-ack bootstrap fails, so a later recovery cannot reuse the old selection.
- Reconciled session-observed membership stage changes through a fresh canonical bootstrap before presenting the selected card; the client never invents entitlement counters or dates from the session response.
- The backend transaction now accepts at most one unseen event and requires exact current account/track selection ID, source, card, phase, and content version before any write. Exact duplicates remain valid after cursor clearing.
- Recalculated the maximum tested CloudBase transaction fixture to 29 operations for first-event migration and for 8 exact duplicates plus one unseen selection.

## Workspace boundary and read scope

- Active truth/source read: referenced specs, runtime contracts, mobile learning/sync implementation, CloudBase learning event/session implementation, focused tests, Harness mirrors, and delivery governance.
- Generated/dependency/cache/archive read: installed dependencies were executed by tests; ignored local-gate reports were read only as validation output and were not used as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was neither read for approval authority nor modified.

## Files changed

- Owner/runtime contracts: `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/evals.json`, and the active CloudBase runtime documents.
- Backend: `learning-events-v2.js` and `learning-events-v2-store.js` plus event/scheduler transaction tests.
- Mobile learning: strict remote session parsing, repository/runtime config, session model, and App scheduling/recovery integration.
- Mobile durability: `learning-event-outbox.v2`, selection-bound event types, replay tests, restart migration, concurrency, and storage-failure coverage.
- Harness and scanners: product-contract mirrors, contract tests, and metadata terms for selection/session internals.

## Commands run

- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed with zero errors.
- `npm test -- --runInBand --watchAll=false --no-watchman` in `apps/mobile` -> 38 suites and 333 tests passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 95 tests passed.
- `PYTHONPATH=scripts python3 -m unittest scripts.test_learning_events_contract scripts.test_learning_scheduler_contract` -> 23 tests passed.
- `python3 scripts/validate_harness.py` -> complete full validation passed, including the remote delivery guard.
- `python3 scripts/validate_harness.py --mode local --profile` -> all 15 selected local sections passed; local-mode completeness correctly remained partial because the remote guard was not executed.
- `./scripts/run_local_gates --profile dev --output exports/local-gates/mobile-learning-session-v1-review-final-dev.json` -> complete `passed_with_exception`; 17 checks passed and the only exception was the allowed dev-only Node 25.9.0 versus 22.13.0 drift. The tracked worktree digest was unchanged.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12 `./scripts/run_local_gates --profile pr --base origin/main --pr 440 --output exports/local-gates/mobile-learning-session-v1-pr-reviewed-final.json` -> complete 30/30 passed after restoring the topic branch's explicit upstream mapping; the tracked worktree digest was unchanged.
- `git diff --check` -> passed.

## Validation results

- Strict mobile parsing rejects undocumented fields, unsupported scheduler versions, invalid selection identity, phase/reason/due conflicts, content/source/card-count drift, inaccessible cards, and inconsistent membership/access combinations.
- App integration proves learning and review phases copy the exact active selection, `selection: null` never uses local or sleep fallback, storage failure does not advance, and one pending event blocks another completion.
- Restart recovery proves v1 outbox entries are deleted without network replay and v2 entries replay byte-equivalently.
- Post-ack recovery proves a failed bootstrap leaves no reusable server selection and a successful retry reads a fresh selection before another completion.
- Membership reconciliation proves a first session that activates trial refreshes canonical bootstrap before presentation, while persistent session/bootstrap disagreement fails closed.
- Backend tests prove stale, missing, cross-account, cross-track, wrong-card, wrong-phase, wrong-content, and multiple-unseen requests fail atomically; duplicate replay remains idempotent.
- Runtime examples now include `selection_id` and explicitly prohibit multiple unseen offline completions, matching the executable contract.
- Formal card approval and launch-readiness files were not updated.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed locally after full diff inspection, focused and full mobile tests, backend tests, contract regressions, Harness validation, dev gates, and whitespace validation.
- Blocking findings: none.
- Findings resolved before pass: post-ack session reuse after bootstrap failure; invalid membership/access combinations; stale transaction-operation and runtime documentation; trial-stage drift between `learning-session.v1` and canonical bootstrap; and obsolete offline batching language.

## User-visible UI impact

- No new visual design, screen structure, interaction family, or card content was introduced.
- Server phase and card selection now drive the existing accepted Learning surface.
- `selection: null` uses the existing completion surface without local fallback. A dedicated `next_due_at` wait-state presentation requires separate accepted design authority.

## Card make external workspace impact

- N/A. No candidate card, review record, audio, approval batch, or exported payload changed.

## Risks and open questions

- The backend and mobile binding are repository-local and not deployed.
- Global legacy v1 snapshot-write removal, signed content publication, production entitlement, and production runtime acceptance remain pending.
- A validated in-memory selection can be completed once after connectivity loss; durable cold-start storage of an unanswered selection is not implemented and the app fails closed instead.
- `nextDueAt` is validated and retained but has no dedicated accepted-design presentation in this slice.
- Local `dev` gates allow Node version drift; PR and release profiles remain pinned to Node 22.13.0 and Ruby 3.3.

## Follow-up

- Commit and push this final gate record, then mark PR `#440` ready.
- Approve only the reviewed HEAD in its protected formal-approval environment.
- Merge only after every required GitHub check passes, then fast-forward any clean local `main` worktree and verify post-merge state.
