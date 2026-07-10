# 2026-07-06 Learning Location Hint Weight

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/single-card-ux-contract.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Learning is the primary system-sequenced single-card flow.
- The current CET card and the card interaction must be the first-read focal object.
- Space continuity should be legible as a small clue, not as a management rail that competes with the task.
- Detail is the resolved state of the same current card and should use the same human location language.

## Implementation Hypothesis

- The Learning home location strip should become a borderless lightweight hint, so the question and options recover visual priority.
- Replacing `当前馆 · 本轮盒 / 位置已保持` with `位置 · 本轮盒 / 位置保持` reduces product-management tone while preserving Space continuity.
- Replacing review copy with `回看卡已在眼前` keeps review continuity without sounding like system placement.
- Replacing Detail top copy with `位置 · 本轮盒 / 结果留在本卡` aligns Detail with the same object grammar.
- Existing scoring, progression, route behavior, test IDs, and screenshot flows remain unchanged.

## 变更摘要

- `apps/mobile/src/learning/LearningSurface.tsx`
  - Makes the primary Learning location strip borderless and transparent through `learningCardLocationHint`.
  - Changes the Learning location title from `当前馆 · 本轮盒` to `位置 · 本轮盒`.
  - Changes the non-review copy from `位置已保持` to `位置保持`.
  - Changes the review copy from `需要再看的卡已放到眼前` to `回看卡已在眼前`.
  - Changes the lower address aperture from `同盒位置已保持` to `同盒位置保持`.
  - Changes Detail location copy from `结果在当前卡` to `结果留在本卡`.
- `apps/mobile/__tests__/LearningSurface.test.tsx`
  - Adds regression coverage for the new Learning/Detail location copy and old-copy absence.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates Learning unlock, Detail, and review-flow assertions to the new copy.
- Real screenshots refreshed:
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/detail.png`

## 真实截图

- Light refreshed: `learning.png`, `detail.png`.
- Dark refreshed: `dark/learning.png`, `dark/detail.png`.
- All refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed Learning home now reads as focal card -> question -> options -> submit; the location hint no longer appears as a separate pill control.
- Visual inspection confirmed Detail still keeps location continuity legible without exposing `当前馆` or `结果在当前卡` wording.

## 验证

- `npm exec prettier -- --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx --testNamePattern="renders current learning card as a single-card surface without leaking metadata|can unlock the learning flow after fake sms verification|result detail reads as a resolved card without raw metadata"` from `apps/mobile` -> passed; metadata leak pretest passed.
- Light `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `learning.png`.
- Light `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `detail.png`.
- Dark `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/learning.png`.
- Dark `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/learning.png docs/design/app-screenshots/current-real-app/detail.png docs/design/app-screenshots/current-real-app/dark/learning.png docs/design/app-screenshots/current-real-app/dark/detail.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- Remote simulator smoke after clear-state launch passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-cet-clearstate-launch.yaml`
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml`

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Learning address aperture -> `learning-card-location-strip` and `learning-address-aperture`; current card object -> `learning-current-card`; Detail resolved object -> `LearningResultDetailSurface`.
- Interaction/motion source: `docs/design/interaction-motion/learning-core-interactions-v1.md` and `docs/design/interaction-motion/learning-card-rhythm-v1.md`. This run adds no new interaction family or motion curve; it preserves the `place -> focus` rhythm by reducing the status clue's weight.
- Physical-space source: N/A. This run does not alter Space hierarchy, physical operations, favorite, sleep, or box movement semantics.
- Learning microcopy basis: design-backed product correction. Learning location text changed from management/status wording to human Space-continuity hints.

## Design Review Checklist

- Q1 Law of One / current library: The current library accent remains the only strong accent; the location hint uses muted text and no competing surface color.
- Q2 focal object / first-read path: The current CET card remains the focal object. First read is card title -> prompt -> options -> submit; location is a secondary clue.
- Q3 interaction silhouette: The Learning multiple-choice silhouette is preserved; the location clue no longer reads as a second action or management control.
- Q4 forbidden design patterns: Final screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the current card, prompt, options, submit dock, location hint, Detail content, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced and does not introduce module selection as primary path. Flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Learning/Detail screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Learning/Detail visible location hierarchy. It improves focal-card readability while preserving all interaction behavior, Space continuity semantics, progression, remote smoke paths, and sync contracts.

## 用户可见影响

- Yes. Learning home now gives the current task more visual priority by making the Space location hint lighter.
- Yes. Learning and Detail no longer expose `当前馆` or `位置已保持` wording.
- No Learning scoring, card content, auth, membership, Space favorite/sleep behavior, Statistics behavior, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Remaining follow-up evidence should continue across Mine/Auth density, smaller-device containment, tablet real screenshots, dynamic type, and further cross-surface screenshot review.
