# 2026-07-06 Space Browse Selector Reduction

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/briefs/learning-space-worldview.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/leadership-screenshot-handoff-v2.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Space is the current card's physical knowledge coordinate system, not a user-managed organizer.
- Space must preserve library / group / box / card hierarchy.
- The current box or current card position is the focal object; parent address is secondary context.
- Favorite remains a tag attached to a card object.
- Sleep remains a physical state under the owning box.
- Returning to Learning preserves the addressed object context.

## Implementation Hypothesis

- The real `space-browse` screenshot still read like a configuration panel because the card-list layer rendered a three-level `切换位置` selector for library, group, and box.
- Removing those selector controls and replacing them with one compact read-only `空间地址` clue better matches the accepted shelf-desk baseline: parent address stays visible, but the user is not asked to manage the map.
- The allowed low-cost operations in this layer remain: inspect the current box card, move to previous/next card within the box, toggle favorite tag, toggle sleep state, return to Learning, or go back to overview.
- Existing Space data derivation, favorite/sleep state mutation, auth, membership, sync, and route behavior remain unchanged.

## 变更摘要

- `apps/mobile/src/space/SpaceSurface.tsx`
  - Removes the visible `切换位置` selector rail from the `card_list` layer.
  - Removes library / group / box selector chips from the user-facing browse state.
  - Adds one compact `空间地址` clue showing `书架 / 分区 / 卡盒` as read-only context.
  - Keeps card inspect, favorite, sleep, pager, return-to-Learning, and overview actions in the same one-screen flow.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`
  - Replaces the old selector-chip regression with a new contract that `space-browse-rail` is absent and `space-browse-address-clue` is present.
  - Keeps raw metadata leak assertions for loaded Space cards.
- `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`
  - Waits for `space-browse-address-clue` instead of the removed selector rail.
- `apps/mobile/e2e/maestro/ios-smoke.yaml` and `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`
  - Replace old library / group / box selector steps with the compact address clue assertion.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates Space browse and sleep-state integration tests so they no longer simulate removed cross-box selector controls.
- Real screenshots refreshed:
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/design/app-screenshots/current-real-app/dark/space-browse.png`

## 真实截图

- Source artifact captures:
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-selector-reduction/space-browse-light.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-selector-reduction/space-browse-dark.png`
- Current app screenshot set:
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
- All refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the old `切换位置` management panel is gone and the first-read path is now current box -> current card -> attached card state -> return to Learning.

## 验证

- `npm exec prettier -- --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx e2e/maestro/ios-space-browse-screenshot.yaml` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx` from `apps/mobile` -> passed; metadata leak pretest passed.
- `npm exec prettier -- --write __tests__/App.test.tsx e2e/maestro/ios-smoke.yaml e2e/maestro/ios-remote-smoke.yaml e2e/maestro/ios-space-browse-screenshot.yaml` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx __tests__/App.test.tsx --testNamePattern="can browse the current Space box after login|keeps basic learning usable when current box cards enter sleep zone|can move a card into sleep zone and remove it from learning flow|can favorite a card from space and reflect it in learning flow|keeps completed progress after changing sleep state|uses a compact address clue instead of selector controls"` from `apps/mobile` -> passed; metadata leak pretest passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed.
- Light `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `space-browse.png`.
- Dark `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/space-browse.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space-browse.png docs/design/app-screenshots/current-real-app/dark/space-browse.png docs/agent-runs/artifacts/2026-07-06-space-browse-selector-reduction/space-browse-light.png docs/agent-runs/artifacts/2026-07-06-space-browse-selector-reduction/space-browse-dark.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- Local simulator smoke passed with the updated Space browse segment: `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml`.
- Remote simulator smoke after clear-state launch passed with the updated Space browse segment:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-cet-clearstate-launch.yaml`
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml`

## Design Source And Mapping

- Design source: `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/briefs/learning-space-worldview.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping:
  - address shelf -> compact read-only `空间地址` clue;
  - current object region -> `space-current-box-tray`;
  - contained object region -> `space-contained-card-strip` and `space-browse-card-object`;
  - state region -> favorite tag and sleep controls attached to the card;
  - continuity region -> `space-return-learning`.
- Interaction/motion source: No new motion or interaction family. This run removes a selector-heavy interaction and keeps current card inspection plus low-cost card state operations.
- Physical-space source: `docs/design/physical-space/space-model-v1.md` and `docs/design/mocks/space-surface-shelf-desk-v1.md`. No new Space operation, box ownership rule, or membership access rule was introduced.

## Design Review Checklist

- Q1 Law of One / current library: The Space browse surface keeps one blue current-library accent for address and current-card emphasis. No second strong subject color is introduced.
- Q2 focal object / first-read path: The focal object is the current box card inside the current box. First read is `盒内查看` -> `当前卡盒` -> compact address -> `盒内卡片` -> favorite/sleep -> return to Learning.
- Q3 interaction silhouette: The Space silhouette remains physical hierarchy with parent address, contained card object, attached favorite tag, sleep operation, and return continuity. It no longer exposes module-selection controls as the primary interaction.
- Q4 forbidden design patterns: Final screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the browse tray, address clue, card object, favorite/sleep controls, pager, return/overview actions, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Space remains a physical hierarchy and is not reduced to favorites/sleep boxes, a flat list, statistics, or arbitrary drag-and-drop management. Learning flip self-assess is not changed.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: N/A. This run does not alter flip self-assess.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Space browse screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to removing selector-heavy Space browse controls. It improves product and interaction quality while preserving Space hierarchy, favorite/sleep semantics, auth/membership behavior, sync contracts, and current screenshot flows.

## 用户可见影响

- Yes. Space browse no longer looks like a library/group/box configuration panel.
- Yes. The user sees one compact Space address and one current box card flow.
- No. Learning card progression, Space favorite/sleep behavior, auth, membership, statistics, and remote sync behavior were not changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Remaining follow-up evidence should continue across Mine/Auth density, smaller-device containment, tablet real screenshots, dynamic type, and further cross-surface screenshot review.
