# Agent Run Record: Auth route gates quality

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/route-auth-gates-quality`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by making protected route Auth gates context-aware for Learning, Space, and Statistics. This pass removes the previous learning-specific copy from Space and Statistics gates, keeps each gate attached to its selected product object, and adds real iOS simulator screenshot evidence for all three protected unauthenticated route gates.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is required before personalized Learning, Space, and Statistics state can be exposed.
- The primary login method is phone SMS code.
- Learning is a system-sequenced single-card flow; Space is a physical library / group / box / card hierarchy; Statistics supports the flow without becoming the product center.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- `AuthGate` now derives route-specific gate copy, retained-object copy, continuity pills, and Auth return target from the active protected route.
- Learning keeps `登录后继续学习` and returns to `当前卡`.
- Space now uses `登录后查看空间`, `空间 · 当前位置`, physical hierarchy continuity, and returns to `当前位置`.
- Statistics now uses `登录后查看今日进展`, `今日进展 · 待同步`, daily record continuity, and returns to `今日进展`.
- `PhoneSmsPanel` now receives a `returnTarget`, so the summary, idle hint, and code-sent slip no longer leak Learning copy into Space or Statistics.
- Stable Maestro ids were added to Auth gate title and retained-object text so screenshot flows can verify context without text selectors.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS auth/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: makes Auth gates route-aware and parameterizes `PhoneSmsPanel` return copy.
- `apps/mobile/__tests__/App.test.tsx`: adds regression coverage for Space and Statistics Auth gate context.
- `apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml`: adds real-device screenshot flow for the unauthenticated Space gate.
- `apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml`: adds real-device screenshot flow for the unauthenticated Statistics gate.
- `docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png`: real iOS simulator screenshot evidence for the Learning Auth gate.
- `docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png`: real iOS simulator screenshot evidence for the Space Auth gate.
- `docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png`: real iOS simulator screenshot evidence for the Statistics Auth gate.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app Learning Auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: current real app Space Auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: current real app Statistics Auth screenshot.
- `docs/agent-runs/2026-07-01-auth-route-gates-quality.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx e2e/maestro/ios-auth-space-gate-screenshot.yaml e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 45 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png docs/design/app-screenshots/current-real-app/auth-space.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 160 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png docs/design/app-screenshots/current-real-app/auth.png docs/design/app-screenshots/current-real-app/auth-space.png docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed, all 1206 x 2622.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_route_gates_quality_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml --changed-file apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml --changed-file docs/agent-runs/2026-07-01-auth-route-gates-quality.md --changed-file docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png --changed-file docs/design/app-screenshots/current-real-app/auth.png --changed-file docs/design/app-screenshots/current-real-app/auth-space.png --changed-file docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_route_gates_quality_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 45 tests.
- Mobile full Jest: pass, 26 suites and 160 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate: pass.
- Agent review body gate: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Auth Space screenshot flow: pass on iPhone 17 Pro simulator.
- Auth Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-auth-route-gates-learning-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-01-auth-space-gate-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-01-auth-statistics-gate-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/design/app-screenshots/current-real-app/auth-statistics.png`

## Design review checklist

- Q1 Law of One: Auth keeps the shared neutral shell and one accent. Route gates change object semantics and copy only; they do not introduce separate route palettes.
- Q2 Focal object: Learning focal object is the current card, Space focal object is the current physical location, and Statistics focal object is the daily progress record. First-read path stays route context -> retained object -> SMS action -> floating chrome.
- Q3 Silhouette: Space and Statistics now inherit the same object-and-attached-action silhouette without masquerading as Learning. Space still communicates physical hierarchy; Statistics remains a quiet daily record object.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm Learning, Space, and Statistics Auth gates fit in one screen, with visible phone input, request-code CTA, and no bottom chrome collision.
- Q6 Surface-specific: This pass changes only protected Auth gate context. Learning sequence, Space hierarchy behavior, Statistics check-in behavior, Mine route behavior, and flip self-assess semantics are unchanged.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, three Auth screenshot flows, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Unauthenticated protected-route gates now keep the selected route's product context instead of reusing Learning-specific copy.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Auth gate -> `apps/mobile/App.tsx`; route-specific retained objects -> `AuthGate`; SMS action copy -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth.png`, `docs/design/app-screenshots/current-real-app/auth-space.png`, and `docs/design/app-screenshots/current-real-app/auth-statistics.png`.
- Unimplemented gap: Mine is not a protected route and remains covered through its own account surface. Dark mode, tablet screenshot evidence, and code-sent Space/Statistics screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers light-mode iPhone 17 Pro. Route-specific code-sent states are covered by shared `returnTarget` logic and unit assertions for route gate copy, but they do not yet have separate screenshots.

## Follow-up

- Continue real-app quality passes on Mine unauthenticated account state, dark mode, tablet containment, and remaining route-specific code-sent screenshot coverage.
