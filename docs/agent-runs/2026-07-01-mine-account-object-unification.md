# Agent Run Record: Mine account object unification pass

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-account-object-unification`
- Summary: Continued the user-visible app quality reset by reshaping Mine from a generic account/settings-style panel into a unified account object. This pass keeps account, membership, recovery, and route actions attached to one object, converts the route links into a compact attached action strip, and refreshes the real iOS simulator Mine screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine supports account, membership, purchase recovery, and route continuity. It must not become a complex settings center that visually overwhelms Learning.
- Membership is shared across iOS, Android, and web; trial starts from the first counted learning entry; purchase recovery appears after membership experience ends.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome. For Mine, the current object is the account object.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- Mine now reads as a single account object with account, today, sync, metrics, route actions, and membership state attached inside one object.
- The three route actions are no longer vertical settings rows. They are compact attached action chips for Learning, Space, and Statistics.
- The membership host is styled as an attached entitlement slip inside the account object rather than a separate lower settings section.
- The current real app Mine screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, App tests, Maestro iOS Mine/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: reshapes Mine account object, route action strip, account identity band, progress metrics, and membership host styling.
- `docs/agent-runs/artifacts/2026-07-01-mine-account-object-unification-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: current real app Mine screenshot.
- `docs/agent-runs/2026-07-01-mine-account-object-unification.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-account-object-unification-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-account-object-unification-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/mine.png docs/agent-runs/artifacts/2026-07-01-mine-account-object-unification-simulator.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator, including Learning, Space, Statistics check-in, Mine route actions, and membership host.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-mine-account-object-unification-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine stays neutral and uses only the subdued account accent for account status and attached actions. It does not introduce a competing library palette or sales palette.
- Q2 Focal object: The focal object is the account object. First-read path is route title -> account object -> identity band -> attached route strip -> membership slip -> quiet chrome.
- Q3 Silhouette: The screen now follows an account-object silhouette instead of a generic settings/list page. Route actions are attached chips rather than stacked settings rows.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced. A temporary copy that hit the forbidden `入口` marker was removed before delivery.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no title wrap, no clipped action chip text, no membership CTA collision, no horizontal overflow, and no bottom chrome overlap.
- Q6 Surface-specific: This is Mine-only. It keeps account, membership, recovery, and route continuity inside a quiet account layer without making Mine a complex settings center or changing Learning/Space/Statistics behavior.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Mine screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Mine now presents a unified account object with attached route and membership actions instead of a generic account/settings page.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `mine-profile-card`; identity band -> `mine-profile-phone` / `mine-profile-today`; metrics -> `mine-status-strip` and `mine-metric-*`; route strip -> `mine-go-learning` / `mine-go-space` / `mine-go-statistics`; membership slip -> `membership-host-card`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the logged-in trial-available Mine state. Logged-out Mine/auth composition, premium/free/recovery variants, dark-mode screenshot, and tablet screenshot remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the populated light-mode iPhone 17 Pro logged-in trial-available state. Longer membership error copy, recovery prompt state, premium/free states, dark mode, and tablet captures remain separate coverage targets.

## Follow-up

- Continue real-app quality passes on Auth/login composition, Mine alternate states, Detail long-answer containment, and dark/tablet screenshots.
