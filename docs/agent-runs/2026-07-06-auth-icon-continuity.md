# Agent Run Record: Auth icon continuity

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-19`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by removing the last single-character Mine auth avatar from the signed-out account object. Auth and Mine signed-out, ready, code-sent, and error screenshots were refreshed so the real app screenshot set matches the shared route icon chrome.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login is an attached account/continuity object inside the app shell, not a diagnostic page or separate onboarding product.
- Mine owns account and membership continuity; it must remain a quiet account object rather than a generic settings page.
- The floating capsule route shell is the accepted top-level navigation form; all current real app screenshots should reflect it.
- User-visible UI and screenshots must not expose internal metadata, debug, runtime, raw API, raw exception, status-code, or design-process language.

## Implementation hypothesis changed

- The Mine signed-out auth object should use the same `RouteIcon` profile glyph as the rest of the route chrome instead of a standalone `我` text avatar.
- The signed-out Mine test now guards against reintroducing an exact standalone `我` text node while preserving normal `我的` route/user copy.
- The current real app auth/Mine screenshot set is refreshed after the route-icon chrome work so leadership-facing images do not show stale pseudo-icons.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `docs/design/canon.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, current auth/Mine real app screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots under `docs/design/app-screenshots/current-real-app/` and `/dark/` were inspected only as validation evidence. Temporary local HTTP stubs were used only to trigger real app error states in the simulator.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, candidate card content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces the Mine signed-out auth avatar text with shared `RouteIcon`.
- `apps/mobile/__tests__/App.test.tsx`: adds regression coverage against standalone `我` in the signed-out Mine account object.
- `docs/design/app-screenshots/current-real-app/auth.png`
- `docs/design/app-screenshots/current-real-app/auth-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
- `docs/design/app-screenshots/current-real-app/auth-space.png`
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`
- `docs/design/app-screenshots/current-real-app/auth-error.png`
- `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
- `docs/design/app-screenshots/current-real-app/mine-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
- `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`
- `docs/agent-runs/2026-07-06-auth-icon-continuity.md`: this run record.

## Commands run

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false --testNamePattern="renders correctly|keeps signed-out mine|mine code-sent"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- `npm start -- --reset-cache` from `apps/mobile` -> started Metro for simulator validation.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed; screenshot saved to `auth.png` in light and dark.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml` -> passed; screenshot saved to `auth-phone-ready.png` in light and dark.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed; screenshot saved to `auth-code-sent.png` in light and dark.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed; screenshot saved to `auth-space.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed; screenshot saved to `auth-statistics.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed; screenshot saved to `mine-signed-out.png` in light and dark.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml` -> passed; screenshot saved to `mine-phone-ready.png` in light and dark.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed; screenshot saved to `mine-code-sent.png` in light and dark.
- Local 503 stub on `127.0.0.1:48731` plus `ios-auth-error-screenshot.yaml` and `ios-mine-auth-error-screenshot.yaml` -> passed in light and dark.
- Local verify stub on `127.0.0.1:48732` plus `ios-auth-verify-error-screenshot.yaml` and `ios-mine-verify-error-screenshot.yaml` -> passed in light and dark.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run design-metadata-leak-scan` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests. Existing mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 3 tests.
- Full mobile Jest: pass, 26 suites / 163 tests.
- Backend function tests: pass, 11 tests.
- Whitespace diff check: pass.
- Maestro selector validation: pass.
- Design metadata leak scan: pass.
- Mobile lint and typecheck: pass.
- Harness with and without remote guard: pass.
- Auth and Mine real-app screenshot flows: pass in light/dark for signed-out, phone-ready, code-sent, request-code error, and verify-code error where screenshot assets exist.
- Auth protected route gate screenshots: pass in light for Space and Statistics.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: Auth and Mine account states now use the same route icon language as the shared app shell; no additional accent or separate login visual system is introduced.
- Q2 Focal object: The first-read path remains route title -> retained card/account object -> phone/code action dock -> recovery state -> floating chrome.
- Q3 Silhouette: Real screenshots preserve the one-screen auth/account object silhouette and floating capsule app shell instead of turning login into a separate onboarding page.
- Q4 Forbidden patterns: Refreshed light/dark screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, raw exception, status code, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or standalone pseudo-icon avatar text.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the auth card, code cells, error dock, Mine account object, and bottom capsule fit without clipped labels, overlap, horizontal overflow, keyboard residue, or bottom chrome collision.
- Q6 Surface-specific: Auth remains account/continuity recovery attached to the current object. Learning remains system-sequenced, Statistics remains tabular, and flip self-assess remains exactly two states; none of those interaction contracts were changed.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Current real screenshots were inspected in light and dark; no user-visible internal implementation, status-code, or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after local gates, screenshot review, and iOS smoke.
- Blocking findings: none.

## User-visible UI impact

- Yes. Signed-out Mine now uses a real profile route icon instead of a single-character text avatar.
- Auth and Mine screenshot assets now reflect the actual shared icon chrome, avoiding stale leadership-facing images with pseudo-icon tabs.
- No route behavior, SMS flow, error mapping, membership state, remote contract, or card content was changed.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: auth/Mine object chrome -> `AuthGate`; shared route glyph -> `RouteIcon`; screenshot evidence -> current real app auth/Mine light/dark screenshots.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone/code/error handlers are reused.
- Physical-space source: N/A; Space behavior is unchanged. Space auth gate screenshot was refreshed only because the shell chrome changed.
- Learning microcopy basis: no visible-copy change. This run only replaces a visible pseudo-icon avatar with the accepted route icon language and refreshes screenshots.
- Unimplemented gap: Smaller-phone, tablet, and dynamic type auth/Mine screenshot evidence remain follow-up items.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Error screenshots use local HTTP stubs to exercise the existing request-code and verify-code failure paths. The underlying user-facing error mapper was not changed in this run.
- Dark Space/Statistics auth gate screenshots do not currently exist in the current-real-app screenshot set; this run refreshed the existing light assets for those route gates.

## Follow-up

- Continue replacing remaining page-local placeholder-like marks with shared object/icon language and broaden screenshot evidence to smaller phones and tablet.
