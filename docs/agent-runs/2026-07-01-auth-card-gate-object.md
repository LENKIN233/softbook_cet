# Agent Run Record: Auth card gate object

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/auth-card-gate-object`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by reshaping the unauthenticated Auth gate around the retained current-card object. This pass makes login read as an attached unlock step for the current card instead of a generic phone form, and refreshes the real iOS simulator Auth screenshot.

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

- Authentication is required before personalized Learning, Space, Statistics, and Mine state can be exposed.
- The primary login method is phone SMS code.
- Auth must preserve current learning, physical space state, and membership continuity without becoming a standalone account landing page.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- `AuthGate` now renders a retained object card before the SMS form. On Learning it presents `当前卡 · 四选一`, the retained position, and the record-save promise.
- The previous three-column continuity rail is replaced by attached pills inside the retained object card, making Auth read as a card gate rather than a generic status panel.
- The phone login panel title changes from `手机号登录` to `手机号验证`, with copy that returns the user to the current card after verification.
- App tests now assert the retained-card Auth object copy so the new product grammar is covered.
- The current real app Auth screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth run record, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS auth/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: reshapes Auth gate into a retained current-card object with attached SMS verification.
- `apps/mobile/__tests__/App.test.tsx`: adds assertions for the retained-card Auth object.
- `docs/agent-runs/artifacts/2026-07-01-auth-card-gate-object-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: current real app Auth screenshot.
- `docs/agent-runs/2026-07-01-auth-card-gate-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-card-gate-object-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-card-gate-object-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-auth-card-gate-object-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
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
- Auth screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-auth-card-gate-object-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`

## Design review checklist

- Q1 Law of One: Auth remains neutral and uses the shell accent only for the retained-card edge. It does not introduce a separate login palette or sales palette.
- Q2 Focal object: The focal object is the retained current card. First-read path is route title -> retained card label -> login title -> retained current-card object -> SMS verification action -> floating chrome.
- Q3 Silhouette: Auth is a support gate that now follows the same object-and-attached-action silhouette as the app core, rather than a standalone phone form.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced. A scan-blocked Space Auth copy using internal box language was removed before delivery.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no horizontal overflow, no clipped input or CTA text, no bottom chrome collision, and the retained-card object plus SMS action fit in one screen.
- Q6 Surface-specific: This is Auth-only. It preserves SMS login semantics and does not alter Learning sequencing, Space hierarchy, Statistics behavior, Mine membership behavior, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Auth screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The unauthenticated Auth gate now presents a retained current-card object before the SMS verification controls, making login feel like an attached unlock step for the current card.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Auth gate -> `apps/mobile/App.tsx`; retained card object -> `authRetainedObject`; phone SMS action -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the initial unauthenticated Auth gate. Dark mode, tablet screenshot evidence, code-sent Auth visual state, and route-specific Auth gate screenshots for Space/Statistics/Mine remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the Learning-route unauthenticated Auth gate on light-mode iPhone 17 Pro. Route-specific Auth states are covered structurally by shared component logic but do not yet have separate screenshot evidence.

## Follow-up

- Continue real-app quality passes on code-sent Auth state, dark mode, tablet containment, and route-specific Auth gates.
