# 2026-07-06 Space Browse Position Dock

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Space is a top-level physical-space surface, not a generic card list, settings table, or arbitrary organizer.
- Users must be able to inspect the `library -> group -> box -> card` hierarchy and understand where the current learning card lives.
- Favorite is a tag on the card object. Sleep is a same-box physical state that affects the Learning flow.
- Space must keep a return path to Learning from the current physical context.

## Implementation Hypothesis

- The card-list layer should render its library/group/box controls as an attached position dock instead of a bare form-like selector area.
- The current selected path should be marked with the Space accent inside the dock; inactive adjacent shelves/groups/boxes remain quiet controls.
- Selector behavior, ordered test IDs, favorite, sleep, pager, and Learning return handlers are unchanged.

## 变更摘要

- `apps/mobile/src/space/SpaceSurface.tsx`
  - Renames the card-list selector label from `位置` to `切换位置`.
  - Wraps the selector area in a bordered rounded dock with a soft surface.
  - Moves selector rows into compact column groups so they read as path switching, not a form.
  - Uses the active Space accent for current library/group/box chips.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`
  - Locks `space-browse-rail` as a rounded bordered dock.
  - Updates visible-copy expectation for `切换位置`.
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
  - Updated with real iOS simulator screenshots.

## 真实截图

- Light: `docs/design/app-screenshots/current-real-app/space-browse.png`
- Dark: `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
- Both screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.

## 验证

- `npm exec prettier -- --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx --testNamePattern="uses anonymous ordered selector IDs for Space library and group chips in the card list layer|switches visible Space card objects when group and box selection changes|keeps current card continuity visible in Space"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed in light and dark.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/space-browse.png` -> saved light Space browse screenshot.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/space-browse.png` -> saved dark Space browse screenshot.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space-browse.png docs/design/app-screenshots/current-real-app/dark/space-browse.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml` after a temp `clearState` launch flow -> passed.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/mocks/space-surface-visual-proof-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Space card-list address shelf -> `space-address-shelf`; position dock -> `space-browse-rail`; current box tray -> `space-current-box-tray`; contained card object -> `space-contained-card-strip` / `space-browse-card-object`; favorite tag -> `space-favorite-*`; sleep state -> `space-sleep-*`; Learning return -> `space-return-learning`.
- Interaction/motion source: N/A. This run does not add a new interaction family or motion behavior.
- Physical-space source: `spec/knowledge-map.json`, `spec/space-operations.json`, `docs/design/physical-space/space-model-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.

## Design Review Checklist

- Q1 Law of One: Space browse keeps one current Space accent for selected path chips and the card object marker. No competing library color system was introduced.
- Q2 Focal object: The first-read path is route chrome -> current box object -> attached position dock -> contained card object -> card state controls -> Learning return.
- Q3 Silhouette: The screen remains a physical Space box/card object, not a flat list, generic selector form, or long scrolling settings page.
- Q4 Forbidden patterns: Real light/dark screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal implementation copy.
- Q5 Layout containment: Real iPhone 17 Pro screenshots confirm the position dock, contained card, action tray, pager, Learning return, overview action, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 Surface-specific: Space preserves library/group/box/card hierarchy, favorite-as-tag semantics, sleep-zone semantics, and Learning return continuity.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Space browse position dock presentation. It preserves selector IDs and behavior while improving the visible app-object grammar.

## 用户可见影响

- Yes. The Space box-inspect screen now presents library/group/box switching as an attached position dock instead of a bare form-like location area.
- No auth, learning, statistics, Mine, membership, card content, favorite behavior, sleep behavior, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app is finished.
- Smaller phone widths, tablet containment, dynamic type, gated Space browse, empty-box browse, and sleeping-active screenshots remain follow-up evidence.
