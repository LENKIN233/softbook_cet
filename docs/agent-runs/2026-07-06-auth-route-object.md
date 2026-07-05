# 2026-07-06 Auth Route Object

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- CET4/6 Learning remains the primary product surface.
- Phone plus SMS code is the primary login method.
- Protected routes must preserve the current card, Space position, daily record, membership, and sync continuity until auth completes.
- User-visible auth UI must not expose agent, harness, runtime, endpoint, payload, repo, debug, seed, fixture, TODO, or other internal metadata language.

## Implementation Hypothesis

- Route-level auth should behave like a retained app object attached to the current route, not a centered standalone login page.
- The route auth object should sit directly under the phone route chrome, keep current-card/current-location/current-progress evidence near the title, and keep the phone/SMS dock inside the same object.
- Mine's embedded account auth object is already a separate account-card case and must not be changed by this route layout pass.

## 变更摘要

- `apps/mobile/App.tsx`
  - Adds route-only auth screen and card testIDs.
  - Makes route auth use `flex-start` screen alignment instead of centered state-screen alignment.
  - Keeps the route auth card at natural object height instead of using the previous tall centered minimum height.
  - Preserves the embedded Mine account auth layout and all auth handlers.
- `apps/mobile/__tests__/App.test.tsx`
  - Locks route auth as a top-attached object.
  - Prevents the route auth card from regressing to the old centered/tall layout.
- `docs/design/app-screenshots/current-real-app/*auth*.png`
  - Refreshes real iPhone simulator screenshots for light Learning auth, phone-ready, code-sent, request error, verify error, Space gate, and Statistics gate.
  - Refreshes dark Learning auth phone-ready, code-sent, request error, and verify error.
  - Adds `docs/design/app-screenshots/current-real-app/dark/auth.png` as the dark default route-auth current screenshot.

## 真实截图

- Light default: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-light-real-app.png`
- Light phone-ready: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-phone-ready-light-real-app.png`
- Light code-sent: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-code-sent-light-real-app.png`
- Light request error: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-error-light-real-app.png`
- Light verify error: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-verify-error-light-real-app.png`
- Light Space gate: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-space-light-real-app.png`
- Light Statistics gate: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-statistics-light-real-app.png`
- Dark default: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-dark-real-app.png`
- Dark phone-ready: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-phone-ready-dark-real-app.png`
- Dark code-sent: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-code-sent-dark-real-app.png`
- Dark request error: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-error-dark-real-app.png`
- Dark verify error: `docs/agent-runs/artifacts/2026-07-06-auth-route-object/auth-route-object-verify-error-dark-real-app.png`

All screenshots are 1206 x 2622 real iPhone 17 Pro simulator screenshots captured from the app.

## 验证

- `npm --prefix apps/mobile exec prettier -- --write App.tsx __tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern=App.test.tsx --testNamePattern="renders correctly|protected route auth gates|signed-out mine"` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- Request-code error screenshot flow with local HTTP stub returning request-code 500 -> passed.
- Verify-code error screenshot flow with local HTTP stub returning request-code 200 and verify-code 401 -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- Dark default, phone-ready, code-sent, request-error, and verify-error screenshot flows -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-auth-route-object/*.png ...` -> passed, all checked screenshots are 1206 x 2622.
- Visual inspection of default auth, code-sent, Space gate, Statistics gate, dark default, and dark verify-error -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Design Source And Mapping

- Design artifact: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/visual-reference.html`, and `spec/visual-language.json`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` maps protected auth as retained current-object continuity, phone/SMS rows, and route chrome.
- Implementation surface: `apps/mobile/App.tsx`.
- Screenshot mapping: artifacts in `docs/agent-runs/artifacts/2026-07-06-auth-route-object/` update the current-real-app auth screenshots under `docs/design/app-screenshots/current-real-app/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, submit-code, retry, route selection, and keyboard dismissal handlers are reused.
- Physical-space source: N/A; Space operation model and object hierarchy are unchanged.

## Design Review Checklist

- Q1 Law of One: The route auth gate now has one focal object: the retained current route object plus phone/SMS dock. It no longer reads as a detached centered login page.
- Q2 Focal object: The first-read path is route chrome -> retained auth object -> current card/location/progress evidence -> phone/SMS dock -> floating tabbar.
- Q3 Silhouette: The silhouette matches the mobile-core reset one-screen object grammar. It is not a marketing page, settings page, card list, dashboard, or scroll-first explainer.
- Q4 Forbidden patterns: Refreshed screenshots show no visible agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, or internal metadata copy.
- Q5 Layout containment: Real iPhone 17 Pro light/dark screenshots confirm the auth object, retained ledger, phone field, code cells, request-error dock, verify-error dock, and bottom tabbar fit without overlap, clipped CTA text, keyboard residue, or horizontal overflow.
- Q6 Surface-specific: Learning auth preserves current-card continuity; Space auth preserves library/group/box/card location; Statistics auth preserves today's completion/review/check-in continuity. Mine embedded account auth is intentionally unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent Review

- Reviewer: Codex.
- Review status: passed.
- Blocking findings: none known at record creation.
- Review summary: The change is scoped to route-level auth object layout. It preserves auth behavior, route protection, membership/sync semantics, Mine embedded account auth, and existing Maestro selectors while improving the visible app object continuity.

## 未实现 Gap

- This pass does not claim the full app is finished.
- It does not redesign post-auth transition motion, small-phone containment, tablet containment, or dynamic type.
- Request-code and verify-code error screenshots use local HTTP stubs to exercise the existing remote failure paths in the real app.

## Card Make External Workspace Impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.
