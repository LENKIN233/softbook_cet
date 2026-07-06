# 2026-07-06 Statistics Daily Object Continuity

## 当前任务引用的 spec

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

## Product Truth

- Learning is the primary product path; Statistics supports continuity without becoming the product center.
- Statistics should be a quiet daily object with tabular progress, not a dashboard, achievement system, or management panel.
- The next useful action from Statistics should return the learner to Learning or review without requiring module management.
- User-visible text must avoid product-design/internal terms and metadata leakage.

## Implementation Hypothesis

- The Statistics checked-in state should read as one daily object: `今天收好`, progress ledger, one primary `继续学习` action, and one subdued continuity state.
- Replacing repeated `今日已记录 / 今日已签到 / 已记录` surfaces with `记录完成`, `学习进度已收好`, and compact ledger copy reduces management feel while preserving the check-in action.
- Successful sync detail can be suppressed in the bottom ledger when the label already says `已记录`; failure/retry details remain visible.
- Existing route behavior, check-in state, sync retry behavior, metric test IDs, and remote smoke paths remain unchanged.

## 变更摘要

- `apps/mobile/src/statistics/StatisticsSurface.tsx`
  - Rewrites checked-in / ready / empty statistics copy around `收好今天`, `回到学习`, and quiet continuity language.
  - Removes the visible `学习流` wording after the metadata-leak regression caught it.
  - Makes the check-in row a subdued status rail instead of another full action block.
  - Makes successful sync ledger copy compact by hiding the duplicate detail line when the value is already `已记录`.
  - Keeps the primary `statistics-go-learning-button`, `statistics-checkin-button`, progress metrics, and remote-smoke selectors intact.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates statistics assertions to the new daily-object copy.
  - Keeps regression coverage for check-in, metrics, action dock, status ledger, and return-to-Learning behavior.
- `docs/design/app-screenshots/current-real-app/statistics.png`
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - Refreshed real iPhone 17 Pro simulator screenshots for light and dark checked-in Statistics.

## 真实截图

- Light refreshed: `docs/design/app-screenshots/current-real-app/statistics.png`.
- Dark refreshed: `docs/design/app-screenshots/current-real-app/dark/statistics.png`.
- Both refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the page stays one-screen, the primary action is `继续学习`, the check-in state reads as a secondary status rail, and the bottom ledger no longer repeats a long successful-sync sentence.

## 验证

- `npm exec prettier -- --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can check in from statistics after making learning progress|keeps completed progress when first gated space entry starts trial|mine page keeps profile status and route actions in one screen after login"` from `apps/mobile` -> passed; metadata leak pretest passed.
- Initial full `npm test -- --runInBand --watchAll=false` from `apps/mobile` caught visible `学习流` wording as a metadata/product-term leak -> fixed before screenshots and final validation.
- Final `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- Light `apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `statistics.png`.
- Dark `apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/statistics.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/statistics.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- Remote simulator smoke after clear-state launch passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-cet-clearstate-launch.yaml`
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml`

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics daily object -> `StatisticsSurface`; ledger rows -> `statistics-progress-dock`, `statistics-metric-strip`, and compact `statistics-status-ledger`; next continuation -> `statistics-go-learning-button`; check-in continuity -> `statistics-checkin-card` / `statistics-checkin-button`.
- Interaction/motion source: N/A. This run adds no new motion or core interaction family; it keeps existing route/button behavior.
- Physical-space source: N/A. This run does not alter Space hierarchy or physical operations.
- Learning microcopy basis: N/A. This run changes Statistics surface copy only.

## Design Review Checklist

- Q1 Law of One / current library: Statistics uses one subdued continuity accent and does not introduce a competing library accent.
- Q2 focal object / first-read path: The focal object is the daily learning record. First read is daily object -> progress ledger -> `继续学习` primary action -> secondary continuity/record status.
- Q3 interaction silhouette: Statistics remains a quiet tabular daily object rather than a dashboard or achievement panel.
- Q4 forbidden design patterns: The final screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the daily object, progress dock, status rail, ledger, CTA, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Statistics uses tabular numeric treatment and remains subordinate to Learning. Learning and flip self-assess are not changed.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Statistics screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Statistics visible hierarchy and copy. It makes the surface more app-like and less management-heavy while preserving check-in, metrics, sync retry copy, navigation, membership, Learning, Space, and remote-smoke behavior.

## 用户可见影响

- Yes. Statistics now reads as a compact checked-in daily object instead of repeated status cards.
- Yes. The main continuation from Statistics is clearer: `继续学习`.
- No auth, membership, card content, Learning scoring, Space favorite/sleep behavior, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Smaller-device containment, tablet real screenshots, dynamic type, and continued cross-surface screenshot review remain follow-up evidence.
