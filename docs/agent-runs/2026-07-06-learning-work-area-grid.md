# 2026-07-06 Learning Work Area Grid

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

- Learning is the primary guided single-card flow for CET preparation.
- The current card object, its answer operation, and its confirmation action should form one app-like work area.
- Space continuity remains a light secondary clue and should not turn the Learning screen into a management page.
- The main task must remain inside one phone screen without vertical scrolling or visible internal metadata.

## Implementation Hypothesis

- After the Learning practice copy cleanup, the card still read as a compact floating block on tall phones.
- Expanding the current-card object to fill the available work area should make the screen feel like an app surface, not a short web card.
- Expanding the multiple-choice option grid into the remaining middle space should make the existing answer operation the main touch target instead of leaving dead space.
- Anchoring the submit dock to the bottom of the current card should preserve the one-screen flow: current card -> large answer choices -> bottom confirmation.

## 变更摘要

- `apps/mobile/src/learning/LearningSurface.tsx`
  - Adds `studyCardWorkArea` so the unresolved Learning card grows into the available phone work area.
  - Anchors the unresolved action dock with `oneScreenDockAnchored`.
  - Adds `learning-action-dock` and `learning-option-grid` test anchors.
  - Expands the multiple-choice interaction area and option grid with `choiceInteractionBody` and `optionGridWorkArea`.
  - Gives option cards `justifyContent: space-between` so the larger touch targets read as structured choices.
- `apps/mobile/__tests__/LearningSurface.test.tsx`
  - Locks the current-card work-area growth, bottom action dock anchoring, and stretchable option grid.
- Real screenshots refreshed:
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`

## 真实截图

- Light refreshed: `learning.png`.
- Dark refreshed: `dark/learning.png`.
- Both refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the current Learning card now fills the route work area instead of floating above the tabbar.
- Visual inspection confirmed the multiple-choice options now act as a large 2x2 touch grid, with the submit dock attached to the bottom of the card.

## 验证

- `npm exec prettier -- --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx --testNamePattern="multiple choice submit is a compact action dock tied to selection state"` from `apps/mobile` -> passed; metadata leak pretest passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="keeps phone primary surfaces inside one-screen app panels|can unlock the learning flow after fake sms verification"` from `apps/mobile` -> passed; metadata leak pretest passed.
- Light `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `learning.png`.
- Dark `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/learning.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/learning.png docs/design/app-screenshots/current-real-app/dark/learning.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: current card object -> `learning-current-card`; Learning work area -> `studyCardWorkArea`; multiple-choice operation grid -> `learning-option-grid`; bottom confirmation -> `learning-action-dock` and `learning-submit-button`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`. This run preserves the `place -> focus -> support -> resolve -> settle -> continue` rhythm by giving the focused answer operation the middle work area and keeping confirmation attached.
- Physical-space source: N/A. This run does not alter Space hierarchy, physical operations, favorite, sleep, or box movement semantics.
- Learning microcopy basis: no visible-copy change. This run changes layout and touch-area structure only.

## Design Review Checklist

- Q1 Law of One / current library: The current library accent remains the only strong accent; this run adds no new accent family or decorative color layer.
- Q2 focal object / first-read path: The current CET card remains the focal object. First read is card title -> prompt -> large answer grid -> submit dock.
- Q3 interaction silhouette: The multiple-choice silhouette is preserved as four options plus one submit action; the option cards now occupy the work area instead of a compact row stack.
- Q4 forbidden design patterns: Final screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the current card, prompt, stretched 2x2 option grid, submit dock, and floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced and does not introduce module selection as primary path. Flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Learning screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Learning practice layout. It improves the one-screen app work area, preserves scoring and route behavior, passes real simulator screenshot evidence, and keeps the full iOS smoke path green.

## 用户可见影响

- Yes. Learning practice now uses the phone work area as one current-card surface rather than a short floating card.
- Yes. Multiple-choice options are larger, more touchable, and visually primary.
- No visible copy, scoring, card content, auth, membership, Space favorite/sleep behavior, Statistics behavior, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Remaining follow-up should continue across smaller-device containment, tablet screenshots, dynamic type, and cross-surface interaction density.
