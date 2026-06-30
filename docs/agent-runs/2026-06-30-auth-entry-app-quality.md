# Agent Run Record: Auth entry app quality

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/auth-entry-app-quality`
- PR: https://github.com/LENKIN233/softbook_cet/pull/270
- Summary: Continued the user-visible mobile app quality reset by replacing the gated login entry with an app-like current-object continuation surface. This pass refreshes the real iOS simulator auth screenshot and adds a dedicated auth screenshot flow.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/account-sync-contract.json`
- `spec/product-core.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login is required before Learning, Space, Statistics, and Mine can expose personalized state.
- The primary login method is phone SMS code; guest learning is not enabled by the account/sync contract.
- The auth entry must preserve the user's current learning object, space location, progress, and membership continuity instead of becoming a generic account landing page.
- User-visible UI must inherit the accepted mobile core surface reset design grammar and must not expose harness, repo, debug, raw id, fixture, mock, task-local design, or runtime metadata language.

## Implementation hypothesis changed

- The auth gate now presents the blocked route as a retained current object, with a compact account status chip, one-line continuation title, three continuity states, and the phone SMS form embedded in the same object card.
- The current-real-app auth screenshot now comes from a dedicated auth simulator flow rather than being carried forward from older one-screen screenshot runs.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile source, mobile tests, Maestro flows, current real auth screenshot, current app quality blind audit, and existing agent run records.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence, not product truth.
- External workspace read: none. No card content was produced, approved, imported, or modified in `/Users/lenkin/programing/card make`.

## Files changed

- `apps/mobile/App.tsx`: refactors the gated auth entry into a current-object continuation surface and embeds the phone SMS form inside that object card.
- `apps/mobile/__tests__/App.test.tsx`: updates visible auth entry assertions to the new app-facing continuation copy.
- `apps/mobile/e2e/maestro/ios-auth-screenshot.yaml`: adds a dedicated real-app auth screenshot flow.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshes the current auth screenshot from the iPhone simulator.
- `docs/design/app-screenshots/README.md`: notes that current-real-app screenshots may be refreshed by later per-screen run records.
- `docs/agent-runs/artifacts/2026-06-30-auth-entry-app-quality-simulator.png`: source simulator capture for the refreshed auth screenshot.
- `docs/agent-runs/2026-06-30-auth-entry-app-quality.md`: records this run.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx e2e/maestro/ios-auth-screenshot.yaml` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed after rerunning serially. The first parallel smoke run completed all app assertions but hit a Maestro log finalization `NoSuchFileException`; the serial rerun exited cleanly.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-auth-entry-app-quality-simulator.png` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_entry_app_quality_pr_body.md --changed-file ...` -> passed locally.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_entry_app_quality_pr_body.md` -> passed locally.

## Validation results

- Mobile focused App test: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Local PR design gate: pass.
- Local agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-06-30-auth-entry-app-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`

## Design review checklist

- Q1 Law of One: Auth uses the same restrained neutral shell as the rest of the app and reserves accent emphasis for the retained current-object signal and primary request-code path.
- Q2 Focal object: The focal object is the retained current learning card, not a generic account form; the phone SMS action is attached to that object.
- Q3 Silhouette: The screen keeps the app's current-object silhouette: route capsule, object card, compact state row, embedded action, and floating bottom chrome.
- Q4 Forbidden patterns: No visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, red four-state self-assess, or same-PR design authority was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator auth screenshot confirms the title, state chips, input, and primary action fit in one viewport without incoherent overlap.
- Q6 Surface-specific: AP-22 design review checklist is answered here before PR delivery. VL-AP-07 is addressed by binding the implementation to the accepted mobile core reset decision, implementation mapping, account/sync contract, and current real-app blind audit evidence rather than to a same-PR design brief.
- AP-23: This run does not alter flip self-assess. The existing two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection of the real simulator auth screenshot, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, auth screenshot flow, and iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The unauthenticated app entry now looks and behaves like a continuation surface for the current app object instead of a detached login page.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `spec/visual-language.json`, and account/sync product truth. The blind audit is diagnostic evidence, not standalone implementation authority.
- Implementation mapping: auth gate and phone SMS entry -> `apps/mobile/App.tsx`; real auth screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth.png`.
- Unimplemented gap: This pass focuses on auth entry quality. Future passes should continue on dense secondary states and motion polish using real simulator screenshots as the quality gate.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The auth screenshot is light-mode iPhone 17 Pro simulator evidence. Other device sizes should keep the same layout because the content is shorter and one-screen bounded, but only this simulator was captured in this run.

## Follow-up

- Continue app-quality passes on remaining secondary states and transitions, keeping the current-real-app screenshot set tied to real simulator capture flows.
