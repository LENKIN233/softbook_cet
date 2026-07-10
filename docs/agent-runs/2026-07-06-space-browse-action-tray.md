# 2026-07-06 Space Browse Action Tray

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Space is a top-level physical-space surface, not a generic card list.
- Users must be able to inspect library / group / box / card hierarchy and see where the current learning card lives.
- Favorite is a tag, not a physical box.
- Sleep is a zone that affects the Learning flow.
- Space must preserve a return path to Learning from the current context.

## Implementation Hypothesis

- The browse card object should keep card management as an attached state tray instead of two large competing operation cards.
- The selected card remains the focal object; favorite and sleep controls are secondary state toggles attached to that card.
- The one-screen layout should stay compact enough that the Space object and bottom navigation remain visible on the iPhone 17 Pro simulator.

## 变更摘要

- `apps/mobile/src/space/SpaceSurface.tsx`
  - Compresses the Space browse card's favorite/sleep controls into a tighter attached state tray.
  - Shortens auxiliary copy while keeping the primary actions and existing selectors.
  - Reduces browse card minimum height and state tray padding.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`
  - Locks the compact browse card height and state tray padding.
  - Verifies the new attached state tray remains present.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates integration expectations for the shorter state-tray copy.
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
  - Updated with real iPhone simulator screenshots.

## 真实截图

- Light: `docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/space-browse-action-tray-light-real-app.png`
- Dark: `docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/space-browse-action-tray-dark-real-app.png`

Both screenshots are 1206 x 2622 real iPhone 17 Pro simulator screenshots captured from the app.

## 验证

- `npm --prefix apps/mobile exec prettier -- --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx __tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern='SpaceSurface.test.tsx|App.test.tsx' --testNamePattern='Space library and group|browse the seeded knowledge map|move a card into sleep|favorite a card from space|metadata leakage'` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/space-browse-action-tray-light-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/space-browse-action-tray-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/*.png docs/design/app-screenshots/current-real-app/space-browse.png docs/design/app-screenshots/current-real-app/dark/space-browse.png` -> passed, all 1206 x 2622.
- Visual inspection of light and dark Space browse screenshots -> passed.
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
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` maps Space as address shelf, current box, contained card objects, tag/sleep state, and return path.
- Implementation surface: `apps/mobile/src/space/SpaceSurface.tsx`.
- Screenshot mapping: artifacts in `docs/agent-runs/artifacts/2026-07-06-space-browse-action-tray/` update `docs/design/app-screenshots/current-real-app/space-browse.png` and `docs/design/app-screenshots/current-real-app/dark/space-browse.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: `spec/knowledge-map.json` and `spec/space-operations.json`; favorite remains a tag and sleep remains a zone.

## Design Review Checklist

- Q1 Law of One: Space browse keeps one current Space accent and one focal contained card object; favorite and sleep are secondary attached state toggles.
- Q2 Focal object: First-read path is route chrome -> current box address -> selected contained card -> attached state tray -> return to Learning.
- Q3 Silhouette: The screen remains a physical Space browse object, not a generic list or operation dashboard.
- Q4 Forbidden patterns: Refreshed screenshots show no visible agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, or internal metadata copy.
- Q5 Layout containment: Real light/dark iPhone 17 Pro screenshots confirm the state tray, pager, return action, overview action, and bottom tabbar fit without overlap, clipped text, or horizontal overflow.
- Q6 Surface-specific: Space preserves library / group / box / card hierarchy, favorite-as-tag semantics, sleep-zone semantics, and Learning return continuity.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent Review

- Reviewer: Codex.
- Review status: passed.
- Blocking findings: none known at record creation.
- Review summary: The change is scoped to the Space browse card action tray. It preserves Space hierarchy, favorite/sleep behavior, return-to-Learning behavior, membership gates, and Maestro selectors while reducing operation-panel clutter.

## 未实现 Gap

- This pass does not claim the full app is finished.
- It does not redesign the full Space hierarchy model, overview screen, post-action motion, small-phone containment, tablet containment, or dynamic type.

## Card Make External Workspace Impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.
