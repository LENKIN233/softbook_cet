# Agent Run Record: Auth request inline dock

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/route-auth-gate-quality`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by replacing the initial Auth request-code full-width form action with a compact inline request dock. The phone field, request readiness copy, and request-code action now stay inside the current route object for Learning, Space, Statistics, and Mine instead of reading like a standalone web form.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Auth is an attached gate for the current product object, not a standalone account page or a generic phone form.
- Learning, Space, and Statistics protected-route gates must preserve the current object and return target while asking for SMS verification.
- Mine owns account continuity, but signed-out Mine should still read as an account object with attached verification, not as a separate onboarding page.
- SMS verification remains the account-auth mechanism. This run does not change auth repository behavior, code validation, membership entitlement, runtime sync, or protected-route access rules.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `PhoneSmsPanel` replaces the initial request-code `authActions` stack with `authRequestInlineDock`, a separator-based inline dock containing readiness copy and the compact `auth-request-code-button`.
- The dock exposes three learner-facing states: `先输入手机号`, `手机号已准备好`, and `正在请求验证码`.
- Route gates keep remote/local auth repository decisions outside the shared request dock. The route gate may still pass a success message, but the shared panel no longer renders repository-mode copy in the request action area.
- The same shared request dock refreshes Learning Auth, Space Auth, Statistics Auth, and Mine signed-out states.
- App tests assert the request dock is separator-based, not a rounded bordered card, and that the Mine signed-out request button becomes enabled when the phone number is ready.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Auth route Maestro screenshot flows, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces the initial request-code full-width action and hint with a compact inline request dock while preserving auth handlers and stable request/submit test IDs.
- `apps/mobile/__tests__/App.test.tsx`: asserts request dock structure, disabled/ready request states, and updated remote-auth copy.
- `docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png`: real iPhone 17 Pro simulator Learning-route Auth request screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png`: real iPhone 17 Pro simulator Space-route Auth request screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png`: real iPhone 17 Pro simulator Statistics-route Auth request screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app Learning-route Auth request screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space-route Auth request screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics-route Auth request screenshot.
- `docs/agent-runs/2026-07-02-auth-request-inline-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-space.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth.png docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-space.png docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Learning-route Auth request screenshot flow: pass on iPhone 17 Pro simulator.
- Space-route Auth request screenshot flow: pass on iPhone 17 Pro simulator.
- Statistics-route Auth request screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/design/app-screenshots/current-real-app/auth-statistics.png`

## Design review checklist

- Q1 Law of One: The route Auth request state keeps one neutral object grammar. The request dock uses the existing route object and does not introduce a second card palette, detached page action, or competing form surface.
- Q2 Focal object: Auth first-read path is route title -> retained object -> phone verification -> inline request dock -> floating chrome. The request action is attached to the phone input and current return target.
- Q3 Silhouette: The change preserves the accepted mobile object silhouette and removes the prior full-width request-code CTA from the initial Auth request state.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the phone field, readiness copy, request-code action, retained object, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Auth preserves SMS verification and return-target continuity for Learning, Space, Statistics, and Mine. The change does not alter Learning sequencing, Space hierarchy, Statistics behavior, Mine membership state, protected-route access, or flip self-assess semantics.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, three Auth route screenshot flows, strict iOS smoke, typecheck, lint, focused and full Jest, metadata scans, selector validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The initial SMS request state now reads more like an app interaction: readiness and request action sit in a compact dock attached to the phone field and current route object.
- The disabled state now says `先输入手机号`; the ready state says `手机号已准备好`; the button remains a compact request action.
- The same improvement applies to Learning-route Auth, Space-route Auth, Statistics-route Auth, and Mine signed-out verification.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: protected route Auth object -> `AuthGate`; shared phone verification panel -> `PhoneSmsPanel`; inline request dock -> `auth-request-inline-dock`; request action -> `auth-request-code-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-auth-request-inline-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth.png`; `docs/agent-runs/artifacts/2026-07-02-auth-space-request-inline-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-space.png`; `docs/agent-runs/artifacts/2026-07-02-auth-statistics-request-inline-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-statistics.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The compact request action still calls the existing request-code handler.
- Learning microcopy basis: route-return continuity and auth readiness copy. Visible copy remains user-facing and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone screenshots cover initial request states for Learning, Space, and Statistics. Dark mode, tablet containment, input-filled ready screenshot evidence, and separate Mine signed-out initial screenshot refresh remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The request dock keeps the existing `auth-request-code-button` test ID, so App tests and strict smoke continue to protect the request-code behavior.
- The screenshot evidence covers the disabled initial request state on three route gates. Mine ready-state behavior is covered by App tests but not by a separate screenshot capture in this run.

## Follow-up

- Continue quality passes on Mine signed-out initial screenshot refresh, input-ready Auth screenshot evidence, dark/tablet containment, and the next weakest one-screen surface.
