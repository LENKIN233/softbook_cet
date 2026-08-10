# Agent Run Record: Learning-session Trial null guard

## Task summary

- Date: 2026-08-11
- Branch: `fix/learning-session-trial-null-guard-v1`
- PR: pending
- Summary: Prevent `learning-session.v1` from consuming an available Trial when canonical scheduling has no eligible card and therefore cannot persist a non-null selection cursor.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- Trial starts on the first counted entry; authentication alone is not an entry. In the server learning-session automatic activation path, that counted entry exists only after canonical content validation, non-null selection generation, selection-ID generation, and required cursor persistence.
- A null selection or failed session must not consume Trial.
- Authentication alone is not a counted Trial entry. Local scheduling may start Trial automatically only after a concrete current card is ready; explicit protected-entry actions remain user initiated.
- A durable Trial-start command must carry closed, versioned entry provenance; an upgrade must not replay a legacy authentication-era automatic start.
- Sleeping cards remain ineligible for server selection without deleting their learning history.

## Implementation hypothesis changed

- After a canonical empty cursor revision is saved or confirmed, a request still at `trial_available` now fails with HTTP `409` and code `learning_session_trial_selection_required` instead of activating Trial and returning `selection: null`.
- Accounts already at `trial`, `free`, or `premium` retain the existing successful `selection: null` behavior and `next_due_at` semantics.
- Mobile no longer starts Trial from authentication state alone. Server scheduling remains authoritative in remote mode; local scheduling waits for a ready, non-null current card before invoking the existing Trial transition.
- Mobile Trial-start queue entries now use credential-free `membership-trial-entry.v1` provenance: `explicit_user`, or `counted_local_entry` bound to the exact local card, source, and track. Legacy/unproven persisted entries fail closed during hydration.
- Every accepted fresh, resumed, or empty cursor operation now rechecks canonical membership stage and acknowledgement before activation or response; drift restarts the full scheduler loop.
- Trial activation conditionally binds the checked membership snapshot. The CloudBase transaction reads base membership and beta entitlement together; an active Beta Premium grant returns Premium without creating or rewriting base membership or incrementing Trial counters.
- Trial activation samples the clock at mutation time and commits the later of that value and the existing canonical acknowledgement, preventing a retry from moving membership freshness backward.
- Scheduler retry capacity is five attempts so a legitimate cursor-CAS loss, membership transition, and projection transition can converge without weakening the fail-closed terminal conflict.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, the learning-session scheduler implementation, and its backend tests.
- Generated/dependency/cache/archive read: local `node_modules` installed from the tracked CloudBase function lockfile for validation only; not used as product truth and not tracked.
- External workspace read: none; `/Users/lenkin/programing/card make` was not read or changed.

## Files changed

- `spec/account-sync-contract.json`: define non-null Trial entry, all-cursor membership recheck, Beta-aware conditional activation, and versioned mobile Trial queue provenance.
- `apps/mobile/App.tsx`: replace authentication-driven Trial start with a local-scheduler entry trigger that requires a ready current card; remote scheduling remains server-owned.
- `apps/mobile/__tests__/App.test.tsx`: prove remote/local authentication alone cannot start Trial, a concrete local card can count the entry, and queued confirmation still gates unlock.
- `apps/mobile/src/sync/mutationQueue.ts`: require closed versioned provenance for every durable Trial start and discard legacy/unproven entries during hydration.
- `apps/mobile/__tests__/mutationQueue.test.ts`: cover explicit and counted provenance, strict field closure, concrete-card validation, and legacy drop/rewriting.
- `apps/mobile/__tests__/mutationQueueRepository.test.ts`: prove an unversioned persisted Trial entry cannot reach replay or `startTrial`.
- `infra/cloudbase/functions/softbook-api/index.js`: make Trial activation checkpoint-conditional and read base membership plus beta entitlement in one CloudBase transaction.
- `infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js`: fail closed for null Trial selection, recheck canonical membership after every accepted cursor operation, and retain a bounded five-attempt convergence budget.
- `infra/cloudbase/functions/softbook-api/test/learning-events-v2.test.js`: remove a timing-dependent invalid same-track/two-card preflight assumption while preserving legal cross-track concurrency coverage.
- `infra/cloudbase/functions/softbook-api/test/learning-scheduler-v1.test.js`: cover null-selection non-consumption, post-CAS membership drift, Beta grant after fresh selection, and Beta revoke after resumed confirmation.
- `infra/cloudbase/functions/softbook-api/test/softbook-api.test.js`: prove store and HTTP Trial starts preserve active Beta Premium without touching base counters.
- `infra/cloudbase/learning-session-v1-runtime-contract.md`: define the exact success/failure, membership-checkpoint, queue-provenance, and Beta transaction boundaries.
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`: bind canonical Trial activation and scheduler recheck to the Beta overlay authority.
- `scripts/harness_validator/sections/product_contract_mirrors.py`: keep the harness-owned exact mirror aligned with the corrected owner strings.
- `docs/agent-runs/2026-08-11-learning-session-trial-null-guard.md`: record this runtime correction and its evidence.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed.
- `npm ci --ignore-scripts` in `infra/cloudbase/functions/softbook-api` -> installed the tracked dependency graph; zero reported vulnerabilities.
- `npm ci --ignore-scripts` plus `npm run postinstall` in `apps/mobile` -> installed the tracked graph and applied repository-owned compatibility normalization; audit reported the existing policy-governed mobile advisories.
- `npm ci --ignore-scripts` in `apps/web` -> installed the tracked dependency graph after the first local-gate run correctly reported four missing-tool failures; zero reported vulnerabilities.
- `node --test test/learning-scheduler-v1.test.js` -> 22/22 passed.
- Focused queue/App test run -> 122/122 passed; metadata-leak and brace-expansion pretests passed.
- The corrected CloudBase concurrency regression -> passed in five consecutive isolated runs.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 211/211 passed.
- `npm test -- --runInBand` in `apps/mobile` -> 449/449 passed across 45 suites; metadata-leak and brace-expansion pretests passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint` in `apps/mobile` -> zero errors; 15 pre-existing inline-style warnings.
- `node scripts/validate_dependency_security.mjs` -> passed; Mobile's nine high findings remain covered by the repository's exact unexpired advisory policy, Web and CloudBase reported zero.
- `python3 scripts/validate_harness.py --mode local` -> validation passed; expected local completeness remained partial at 15 selected sections.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 18/18 passed.
- `node --check` on the modified backend JavaScript files -> passed.
- `python3 -m json.tool spec/account-sync-contract.json` -> passed.
- `git diff --check` -> passed on 14 tracked modified files plus this new run record.
- `./scripts/run_local_gates --profile dev` -> final rerun `23/24 passed_with_exception`, zero failed gates; the only exception is the allowed dev-only Node `25.9.0` versus required `22.13.0` drift. The first `19/24` run is retained in generated local reports and was caused only by absent web dependencies (`eslint`, `tsc`, and `vitest` not installed), not a product-test failure.

## Validation results

- The reproduced pre-fix path was an authenticated `trial_available` account with every canonical card sleeping. It previously returned `200`, `membership_stage: trial`, and `selection: null`.
- The corrected path returns exact `409 learning_session_trial_selection_required` on the first and repeated requests, retains membership `trial_available`, keeps both Trial counters unchanged, and preserves one confirmed empty cursor revision. Waking one canonical card then returns a non-null selection, advances the cursor revision, and starts Trial exactly once across a repeated read; sleeping that card again confirms that an already active Trial still receives the normal successful `selection: null` response.
- A membership change accepted after an empty cursor write causes a full scheduling retry rather than a stale 409. The regression promotes the account to Premium at that exact boundary and verifies a canonical `200`, full access, `selection: null`, unchanged Trial counters, and the same empty cursor revision.
- A Beta Premium grant after a non-null cursor write forces recomputation and returns Premium/full access while the base membership remains `trial_available` with zero Trial counters. A Beta revoke after resumed-cursor confirmation also forces recomputation and returns the newly canonical Trial path rather than leaking stale Premium access.
- Store- and HTTP-level CloudBase regressions prove a valid queued Trial request received during an active Beta grant returns canonical Premium and cannot create a base membership document or increment Trial counters.
- A same-stage acknowledgement-only drift injected between post-cursor recheck and conditional activation forces one retry, starts Trial exactly once, and preserves the newer acknowledgement rather than overwriting it with the older request time.
- Queue hydration rewrites legacy unversioned `start_membership_trial` entries out of storage before replay. Valid explicit and counted entries require exact closed provenance; the counted form binds a six-digit local card, source, and track.
- Existing valid first selection, persisted selection, active-membership empty selection, concurrency, projection-watermark, content-drift, and sleep-drift scheduler tests remain green.
- Mobile regressions prove no remote Trial request and no local Trial transition occur while the learning session is unresolved; both begin only after a concrete local current card is ready. Remote server-scheduled membership reconciliation remains covered separately.
- Local and full repository harness validation passed.
- Learning-scheduler contract regression passed 9/9.
- Harness module-boundary regression passed 18/18 after updating the exact product-contract mirror.
- CI validation: pending.

## Binary evidence

- Evidence manifest: N/A; this correction is covered by deterministic backend contract tests.
- Archive: N/A.

## Agent review status

- Reviewer: independent exact-diff review, iterative adversarial passes
- Status: PASS; 0 P0 / 0 P1 / 0 P2 on the final 15-path worktree diff
- Closed findings: stale null-selection membership response, authentication-era Trial queue replay, post-CAS Beta grant/revoke drift, conditional-activation race, acknowledgement rollback, and the timing-dependent invalid same-track concurrency fixture.
- Independent reruns included scheduler 22/22, backend 211/211, mobile 449/449, focused queue/App 122/122, mobile typecheck, harness local/full, scheduler contract 9/9, module boundaries 18/18, dependency policy, syntax/JSON/diff checks, and targeted concurrency repetitions.

## User-visible UI impact

- `App.tsx` changes only the Trial trigger condition; it does not change rendered layout, copy, color, typography, component silhouette, or interaction controls.
- A future accepted UI may map the recoverable `409` to an action that helps the learner wake an eligible card; this runtime PR does not invent that presentation.

## Card make external workspace impact

- N/A. No card payload, approval batch, or content workspace was read or changed.

## Risks and open questions

- The mobile client currently handles the new `409` through its generic remote-session failure path. Product-facing recovery copy and navigation require accepted design authority before implementation.
- This repository-local runtime remains undeployed; passing tests do not establish deployment or launch evidence.

## Follow-up

- Obtain independent exact-diff review, run the repository-required gates, open a PR against `main`, and merge only after required checks and review pass.
- Map `learning_session_trial_selection_required` into the later accepted Learning/Space recovery design without consuming Trial or selecting a card locally.
