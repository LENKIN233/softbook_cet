# Agent Run Record: Server Scheduler and FSRS v1

## Task summary

- Date: 2026-07-24
- Branch: `module/server-scheduler-fsrs-v1`
- PR: `#439`
- Summary: Implement the repository-local server learning-session boundary, exact versioned FSRS projection, canonical card selection, revisioned cursor persistence, and negative governance coverage without claiming mobile integration or deployment.

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
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`

## Product truth used

- Learning remains one system-sequenced card flow; due review precedes new material.
- The server owns learning order, membership access, and sleeping-card exclusion.
- The visible self-assessment remains two-state; scheduler ratings are internal only.
- Exact same-card cross-device resume is not required.
- Green repository checks do not create formal content approval or launch readiness.

## Implementation hypothesis changed

- Added authenticated `GET /v2/learning/session?track=cet4|cet6` with strict server-only authority.
- Locked `ts-fsrs@5.4.1`, policy `softbook-fsrs.v1`, library defaults, and fuzz disabled.
- Mapped `review_needed` to `Again`, assisted passes to `Hard`, and unassisted passes to `Good`; `Easy` is unused.
- Projected FSRS state from accepted events at canonical server acceptance time in the existing event transaction.
- Added account-and-track `softbook_learning_sessions` records with revision compare-and-swap and a timestamp plus latest-positive-server-sequence learning-projection watermark.
- Made every newly accepted track event advance the session watermark; matching card/content completion clears the cursor atomically.
- Made first-event all-track legacy migration advance every migrated track's session watermark in the same transaction while preserving any valid sibling-track cursor.
- Added selection order: eligible persisted cursor, earliest due review, then canonical unseen card.
- Transactionally fenced `selection: null` and `next_due_at` responses; an initial empty session is persisted as valid revision 1, while later empty reads confirm the projection watermark and revision before returning.
- Added full trial/premium access and a canonical `ceil(card_count * 0.5)` free prefix, with sleeping cards excluded without deleting history.
- Trial activation now occurs only after canonical validation, selection generation, and required cursor persistence succeed.
- CloudBase membership mutations now share single-document transactions so automatic trial activation or recovery dismissal cannot downgrade a concurrent premium purchase; production payment entitlement remains out of scope.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, CloudBase runtime contracts, backend implementation/tests, Harness mirrors, metadata scanners, and delivery records required for this runtime slice.
- Generated/dependency/cache/archive read: installed backend dependencies were executed by tests; generated reports and historical archives were not used as product truth.
- External workspace read: none; `/Users/lenkin/programing/card make` was not modified or used as approval authority.

## Files changed

- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/evals.json`, and `AGENTS.md`: freeze owner, runtime, read-path, regression, and non-claim contracts.
- `infra/cloudbase/learning-session-v1-runtime-contract.md`, `infra/cloudbase/learning-events-v2-runtime-contract.md`, `infra/cloudbase/bootstrap-v2-runtime-contract.md`, and `infra/cloudbase/README.md`: document runtime behavior and explicit non-claims.
- `infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js`: implement FSRS projection validation, selection, access, cursor, watermark, and response serialization.
- `infra/cloudbase/functions/softbook-api/index.js` and `infra/cloudbase/functions/softbook-api/learning-events-v2-store.js`: wire the endpoint, memory/CloudBase transactional scheduler storage, and membership mutation serialization.
- `infra/cloudbase/functions/softbook-api/package.json` and `package-lock.json`: pin `ts-fsrs@5.4.1`.
- `infra/cloudbase/provision-softbook-nosql.mjs`: provision `softbook_learning_sessions`.
- Backend and Harness test files: cover authority rejection, idempotency, rollback, concurrency, cross-instance persistence, access, migration, fail-closed production content, and intentional contract drift.
- Mobile/design metadata scanners and regression fixtures: prevent scheduler internals from becoming visible product copy.

## Commands run

- `node --test test/learning-scheduler-v1.test.js test/learning-events-v2.test.js test/softbook-api.test.js` -> passed during focused development.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 93 tests passed.
- `PYTHONPATH=scripts python -m unittest scripts.test_learning_events_contract scripts.test_learning_scheduler_contract` -> 21 tests passed.
- `python scripts/validate_harness.py --mode local` -> passed all 15 selected local sections; completeness correctly reported partial for local mode.
- `python scripts/validate_harness.py --mode full` -> passed the complete local and remote-semantics Harness.
- `./scripts/run_local_gates --profile dev` with Python 3.12.13 and Node 22.13.0 -> 18/18 checks passed with no exception, skip, or deferred result; report at ignored path `exports/local-gates/20260724T015323Z-9794caab-dev-14046/report.json`.
- Initial `./scripts/run_local_gates --profile pr --base origin/main --pr 439` -> 28/30 checks passed; the only failures were the intentionally pending Agent review and a missing local topic-branch fetch mapping. The exact branch mapping was restored before the final PR-profile rerun.
- Final `./scripts/run_local_gates --profile pr --base origin/main --pr 439` with Python 3.12.13, Node 22.13.0, and Ruby 3.3.12 -> 30/30 checks passed with no exception, skip, or deferred result; report at ignored path `exports/local-gates/20260724T020045Z-f7b1a757-pr-24706/report.json`.
- `node --test scripts/test_classify_formal_approval_scope.mjs` -> 10 tests passed.
- `npm ci` followed by `bundle exec pod install --project-directory=ios --deployment` with Node 22.13.0 and Ruby 3.3.12 -> passed; no tracked file changed.
- `git diff --check` -> passed.

## Validation results

- FSRS mapping, due ordering, duplicate replay, sequence-zero migration, cursor clearing, transaction rollback, account/track isolation, content drift, sleeping state, free access, and trial non-consumption failures pass.
- Concurrent event/session fixtures prove stale new-card selection cannot overwrite a newer projection and stale resumed cursors are transactionally rejected.
- An equal-millisecond split-read fixture proves the server-sequence watermark rejects a stale projection paired with a newer session even when timestamps collide.
- Initial and existing empty-session fixtures prove `selection: null` never persists an invalid revision-zero document and cannot return stale `next_due_at` after a concurrent event.
- First-event all-track migration preserves an existing sibling-track selection, synchronizes its projection watermark, and stays within the tested CloudBase transaction budget at 95/100 operations.
- Bootstrap fails closed on scheduler or session-watermark corruption.
- Sequence-zero legacy cards use server acceptance time for immediate due eligibility, so future client timestamps cannot postpone review.
- Production learning-session reads fail closed before trial activation when the card source is unavailable or no matching published content release exists.
- Repository-local CloudBase trial, purchase, and recovery mutations are transactionally serialized and cannot downgrade an observed premium purchase.
- GitHub required checks: pending PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: final path-by-path review found and resolved stale sibling-track migration watermarks, accountless legacy cursor overlay, duplicate/new-event stale-session acknowledgement, equal-millisecond timestamp collisions, missing production card-source handling, non-transactional membership downgrade races, future-client-time legacy deferral, and unconfirmed empty-session responses. Each fix has a focused regression, and the final review found no remaining blocker in this repository-local slice.

## User-visible UI impact

- N/A. This slice changes no screen, interaction surface, card content, or accepted design artifact.

## Card make external workspace impact

- N/A. No candidate content, approval record, or external payload was changed.

## Risks and open questions

- The backend is repository-local and not deployed.
- Mobile does not yet consume `/v2/learning/session` or bind completion to a selected cursor.
- Production membership expiry/payment entitlement, global v1 bridge removal, and formal content publication remain pending.
- CommonJS CloudBase production runtime compatibility remains a deployment acceptance gate.
- The current machine has Ruby 2.6.10; the dev profile does not exercise release-only CocoaPods/build gates, and PR/release remain bound to Ruby 3.3.

## Follow-up

- Complete required GitHub checks, formal approval, merge, and post-merge `main` verification.
- Implement mobile learning-session consumption and selection binding in a separate reviewed slice.
