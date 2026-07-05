# 2026-07-06 Statistics Continue Learning CTA

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
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

## Product Truth

- Statistics is a simple daily progress and check-in surface, not a dashboard, ranking system, trend product, or gamified stats center.
- Statistics remains subordinate to Learning. Its next step should return users to the active learning flow or to review when review cards are pending.
- Stats numbers can use tabular presentation, but visible copy should stay app-facing and action-oriented.

## Implementation Hypothesis

- When no review queue is pending, the Statistics next-step CTA should say `继续学习` instead of `回学习`.
- This aligns the primary button with the surrounding card copy `继续下一张` and makes the action read like the next step in a one-screen app flow.
- The button testID, route behavior, review-state label `开始回看`, and check-in behavior are unchanged.

## 变更摘要

- `apps/mobile/src/statistics/StatisticsSurface.tsx`
  - Changes the non-review next-step CTA label from `回学习` to `继续学习`.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates the statistics check-in regression expectation to the new visible CTA copy.
- `docs/design/app-screenshots/current-real-app/statistics.png`
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - Updated with real iOS simulator screenshots after the app rendered the new CTA.

## 真实截图

- Light: `docs/design/app-screenshots/current-real-app/statistics.png`
- Dark: `docs/design/app-screenshots/current-real-app/dark/statistics.png`
- Both screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.

## 验证

- `npm exec prettier -- --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can check in from statistics after making learning progress|starts review from statistics when cards need revisiting"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed in light and dark.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/statistics.png` -> saved light Statistics screenshot.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/statistics.png` -> saved dark Statistics screenshot.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/statistics.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed, both 1206 x 2622.
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

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics progress dock -> `statistics-progress-dock`; daily check-in -> `statistics-checkin-button`; next-step CTA -> `statistics-go-learning-button`; review-state CTA copy remains `开始回看`.
- Interaction/motion source: N/A. This run does not add a new interaction family or motion behavior.
- Physical-space source: N/A. This run does not alter Space semantics.

## Design Review Checklist

- Q1 Law of One: Statistics keeps one quiet progress-led surface and does not introduce new color semantics or competing accents.
- Q2 Focal object: The first-read path remains progress dock -> check-in state -> next-step learning CTA -> supporting daily metric.
- Q3 Silhouette: The screen remains a one-screen app surface for daily progress, not a dashboard, chart wall, feed, or long scrolling report.
- Q4 Forbidden patterns: Real light/dark screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal implementation copy.
- Q5 Layout containment: Real iPhone 17 Pro screenshots confirm `继续学习` fits inside the CTA in light and dark modes without clipping, overlap, horizontal overflow, or safe-area collision.
- Q6 Surface-specific: Statistics still supports check-in and simple progress reading while routing the user back to Learning or review, preserving Learning as the product core.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is narrowly scoped to Statistics next-step app copy. It removes a weaker route-like label while preserving behavior, selectors, review copy, and check-in flow.

## 用户可见影响

- Yes. Statistics now presents the non-review next action as `继续学习`, matching the user's next-step mental model.
- No auth, learning card mechanics, Space, Mine, membership, card content, sync contract, or check-in behavior changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app is finished.
- Smaller phone widths, tablet containment, dynamic type, gated Statistics, and empty-progress screenshots remain follow-up evidence.
