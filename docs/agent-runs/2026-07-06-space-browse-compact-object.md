# 2026-07-06 Space Browse Compact Object

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product Truth

Space 不是卡片列表页或收藏管理页。它必须保留 library / group / box / card 的物理层级，让用户知道当前学习卡在空间中的位置，并能从当前盒、盒内卡片、收藏标签、休眠区回到学习。

## Implementation Hypothesis

这次实现只推进 `space-browse` 的盒内查看状态：把原先偏长、偏管理页的卡片列表压回一个首屏对象，把“当前卡盒”和“盒内卡片”作为一个连续对象呈现。色值、尺寸和间距属于实现假设；物理层级、对象焦点和一屏流是产品真相。

## 变更摘要

- `apps/mobile/src/space/SpaceSurface.tsx`
  - 让 `boxBrowseSurface` 和 `browseCardTile` 不再用 flex 撑满剩余高度，改为固定紧凑对象高度。
  - 缩小盒内查看的 rail、卡片、按钮与 pager 间距，避免首屏被空白撑开。
  - 将头部状态从“可收藏 / 有收藏”改为真实对象数量：未收藏显示 `2 张卡`，收藏后显示 `1 张收藏`。
  - 给当前盒内卡片对象增加 `space-browse-card-object` testID，便于锁住一屏对象布局。
- `apps/mobile/__tests__/SpaceSurface.test.tsx`
  - 锁住盒内卡片对象 `flex: 0` 和紧凑高度。
  - 断言普通盒内查看显示真实卡片数量，并禁止“可收藏 / 有收藏”旧文案回流。
- `apps/mobile/__tests__/App.test.tsx`
  - 将收藏流程断言更新为 `1 张收藏`，并禁止“可收藏”旧文案回流。
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
  - 更新为真实 iOS simulator app 截图。

## 真实截图

- Light: `docs/agent-runs/artifacts/2026-07-06-space-browse-compact-object/space-browse-compact-light-real-app.png`
- Dark: `docs/agent-runs/artifacts/2026-07-06-space-browse-compact-object/space-browse-compact-dark-real-app.png`

## 验证

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/src/space/SpaceSurface.tsx apps/mobile/__tests__/SpaceSurface.test.tsx apps/mobile/__tests__/App.test.tsx`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern=SpaceSurface.test.tsx`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern=App.test.tsx --testNamePattern="favorite a card from space|seeded knowledge map|metadata leakage"`
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-compact-object/space-browse-compact-dark-real-app.png`
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-compact-object/space-browse-compact-light-real-app.png`
- `git diff --check`
- `python3 scripts/validate_maestro_selectors.py`
- `npm --prefix apps/mobile run design-metadata-leak-scan`
- `npm --prefix apps/mobile run lint -- --quiet`
- `npm --prefix apps/mobile run typecheck`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false`
- `npm --prefix infra/cloudbase/functions/softbook-api test`
- `python3 scripts/validate_harness.py`
- `python3 scripts/validate_harness.py --skip-remote-guard`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml`

Result: all passed.

## Design Source And Mapping

- Accepted design decision: `docs/design/decisions/mobile-core-surface-reset-v1.md`
- Rendered proof: `docs/design/mocks/mobile-core-surface-reset-v1.html`
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- Physical space artifact: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and Space visual proof `docs/design/mocks/space-surface-shelf-desk-v1.html`

This change implements the Space mapping rows for address shelf, current box, contained cards, tag/sleep state, and return path. It does not introduce a new design authority in the same implementation PR.

## Design Review Checklist

Universal Q1-Q4: Q1 Law of One / current library evidence: Space Browse uses the current library/box accent as the only strong accent on the object marker, current learning card label, active card edge, and floating Space nav while adjacent libraries stay neutral chips. Q2 The focal object is the current box plus its contained current card; first-read path is box address -> current box object -> contained card -> attached favorite/sleep/pager controls -> Learning continuity -> floating chrome. Q3 The interaction silhouette is physical hierarchy from `space-model-v1`: address shelf, current box, contained card object, state controls, and return-to-Learning continuity; it no longer reads as a flat list or long management page. Q4 forbidden_design_patterns evidence: the refreshed real light/dark screenshots show no metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, module-selection copy, or complex dashboard language.

Conditional Q5-Q6: Q5 phone containment evidence: real iPhone 17 Pro simulator light/dark screenshots at 1206 x 2622 confirm the route header, current box, contained card, attached controls, return path, and floating tabbar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision. Q6 Space surface-specific evidence: Space preserves library / group / box / card hierarchy and favorite/sleep semantics without changing Learning sequencing, Statistics tabular treatment, module selection, or flip self-assess.

AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence in `docs/design/app-screenshots/current-real-app/space-browse.png` and `docs/design/app-screenshots/current-real-app/dark/space-browse.png`.

AP-23: This run does not alter flip self-assess; concrete evidence remains the canonical two-state model in `LearningSurface.tsx`: `有把握` = mint/confident and `再回看` = amber/review, with no four-level or red self-assess state introduced.

VL-AP-07: Satisfied by this checklist and by real light/dark app screenshots.

## Agent Review

Reviewer: Codex

Review status: passed

Blocking findings: none

Review summary: The change is scoped to Space browse compactness, removes placeholder-like status text, preserves physical hierarchy, and adds tests for both visual layout contract and old-copy regression. The remaining product-quality gap is broader app iteration, not a blocker for this Space browse follow-up.

## 未实现 Gap

- This PR does not claim the full app is finished.
- It does not redesign Space root, Learning detail, Statistics, or Mine.
- It does not change card payload/content production; `/Users/lenkin/programing/card make` remains the external content workspace.
