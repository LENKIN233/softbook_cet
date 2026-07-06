# 2026-07-06 Learning Practice Action Flow

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

- Learning is a guided, system-sequenced, single-card flow for CET preparation.
- The current CET card, its required operation, and its immediate confirmation should be the first-read path.
- Space continuity can stay visible as a small human clue, but it must not compete with the card operation or read like internal placement status.
- Visible Learning copy must absorb implementation and bookkeeping; metadata, payload, runtime, queue, source, mock, seed, and agent language must stay out of user-facing UI.

## Implementation Hypothesis

- The current practice screen still felt too much like a status/report form because several labels repeated state explanations: `先判断，再确认解析`, `位置保持`, `同盒位置保持`, `已选择`, and `提交后立即看解析`.
- Shorter action-first copy should make the screen read as current card -> answer choice -> confirm, closer to a mainstream one-screen app flow.
- The change can stay scoped to Learning microcopy and regression assertions without changing card content, scoring, progression, routing, sync, auth, membership, or Space operations.

## 变更摘要

- `apps/mobile/src/learning/LearningSurface.tsx`
  - Changes the card eyebrow from `先判断，再确认解析` to `先读题干`.
  - Changes the location hint from `位置 · 本轮盒 / 位置保持` to `本轮盒 / 位置已接上`.
  - Changes review placement copy from `回看卡已在眼前` to `回看卡在这`.
  - Changes the lower address aperture from `同盒位置保持` to `同盒继续`.
  - Replaces long action cues with compact operations such as `翻开卡背`, `选一个答案`, `补齐锁位`, `点掉干扰项`, and `选择判断`.
  - Rewrites submit dock copy to concise confirmation states such as `先选答案`, `B 已选`, and `确认后看解析`.
  - Shortens selected option label from `已选择` to `已选`.
- `apps/mobile/__tests__/LearningSurface.test.tsx`
  - Adds regression coverage for the compact Learning practice copy and old-copy absence.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates login-to-Learning, completion, and review-flow assertions so app-level flows preserve the new visible language.
- Real screenshots refreshed:
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`

## 真实截图

- Light refreshed: `learning.png`.
- Dark refreshed: `dark/learning.png`.
- Both refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the practice screen now reads as current card -> question -> answer options -> submit dock.
- Visual inspection confirmed the previous repeated status copy is gone from the real Learning screenshots.

## 验证

- `npm exec prettier -- --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx --testNamePattern="does not expose raw space metadata while learning|multiple choice submit is a compact action dock tied to selection state"` from `apps/mobile` -> passed; metadata leak pretest passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can unlock the learning flow after fake sms verification|can complete the local single-card deck and restart it"` from `apps/mobile` -> passed; metadata leak pretest passed.
- Light `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `learning.png`.
- Dark `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/learning.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/learning.png docs/design/app-screenshots/current-real-app/dark/learning.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: current card object -> `learning-current-card`; address shelf -> `learning-card-address-shelf`; prompt and interaction body -> `InteractionBody`; selected option state -> `learning-option-*`; submit confirmation -> `learning-submit-button`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`. This run preserves the `place -> focus -> support -> resolve -> settle -> continue` rhythm by reducing explanatory state labels and keeping the primary operation attached to the current card.
- Physical-space source: N/A. This run does not alter Space hierarchy, physical operations, favorite, sleep, or box movement semantics.
- Learning microcopy basis: design-backed product correction. Learning practice text changed from status/report wording to compact operation and confirmation language.

## Design Review Checklist

- Q1 Law of One / current library: The current library accent remains the only strong accent; this run does not add a new hue family or competing visual layer.
- Q2 focal object / first-read path: The current CET card remains the focal object. First read is card title -> prompt -> options -> submit dock; Space continuity stays secondary.
- Q3 interaction silhouette: The Learning multiple-choice, flip, lock, elimination, and swipe silhouettes are preserved. This run only changes visible copy and selected-state labels.
- Q4 forbidden design patterns: Final screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the current card, prompt, options, submit dock, address hint, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced and does not introduce module selection as primary path. Flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Learning screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Learning visible interaction language. It reduces report/status copy, preserves the current-card object model, keeps all selectors and progression paths working, and passes real simulator screenshot and smoke evidence.

## 用户可见影响

- Yes. Learning practice now reads more like a one-screen app flow: current card, one answer operation, and one attached confirmation dock.
- Yes. Repeated status labels such as `位置保持`, `同盒位置保持`, `已选择`, and `提交后立即看解析` are removed from the practice screen.
- No Learning scoring, card content, auth, membership, Space favorite/sleep behavior, Statistics behavior, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- The remaining visible gap in Learning is larger layout density and vertical distribution on tall phones; this run deliberately keeps layout geometry stable and fixes the interaction-language layer first.
- Follow-up should continue across smaller-device containment, tablet screenshots, dynamic type, and deeper cross-surface interaction polish.
