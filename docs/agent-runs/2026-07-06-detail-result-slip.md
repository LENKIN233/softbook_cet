# 2026-07-06 Detail Result Slip

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Learning is the primary CET study flow. Detail is not a separate report page; it is the resolved state of the current card.
- The current card remains the focal object. Answer, correctness, explanation, and continuation must attach to that object instead of becoming a vertical article.
- Learning remains system-sequenced and one-screen. The primary action after resolving a card is to continue the current sequence.
- User-visible copy must not expose metadata, harness, runtime, endpoint, raw exception, implementation, or agent language.

## Implementation Hypothesis

- The previous Detail screen had the correct behavior but still read like a compact report because it repeated status, used a two-column answer table, and kept a redundant continuity rail.
- Replacing the answer table with two attached answer chips, changing the status copy to `答案已归位`, and removing the redundant continuity rail makes Detail read as a resolved card state while preserving the same answer evidence.
- Existing Learning state, scoring, result calculation, route behavior, and Maestro selectors can remain unchanged.

## 变更摘要

- `apps/mobile/src/learning/LearningSurface.tsx`
  - Changes Detail copy from report-like status to resolved-card copy: `答案留在本卡`, `已答对`, `答案已归位`, and `你的选择和正确答案已对齐`.
  - Replaces the old divided answer rail with two independent answer chips while preserving `learning-detail-selected-answer` and `learning-detail-correct-answer`.
  - Removes the redundant `位置保持 / 本轮盒节奏保持` continuity rail from Detail; location continuity remains in the card address strip.
  - Tightens Detail spacing and card internals so the screen remains one app object with a primary continue CTA.
- `apps/mobile/__tests__/App.test.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
  - Updates Detail regressions to assert the new resolved-card language and to block the older report-like copy from returning.
- `docs/design/app-screenshots/current-real-app/detail.png`
- `docs/design/app-screenshots/current-real-app/dark/detail.png`
  - Refreshed real iPhone 17 Pro simulator screenshots for Detail in light and dark mode.

## 真实截图

- Light: `docs/design/app-screenshots/current-real-app/detail.png`
- Dark: `docs/design/app-screenshots/current-real-app/dark/detail.png`
- Both screenshots are real iPhone 17 Pro simulator captures produced from the current app.
- Visual inspection confirmed the answer chips no longer retain the old table background, the CTA is visible, and light/dark modes have no clipped text, overlap, horizontal overflow, metadata leakage, or content hidden behind the floating nav.

## 验证

- `npx prettier --write __tests__/LearningSurface.test.tsx __tests__/App.test.tsx src/learning/LearningSurface.tsx` from `apps/mobile` passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can complete the local single-card deck and restart it"` from `apps/mobile` passed, including metadata leak pretest.
- `npm run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` from `apps/mobile` passed; rebuilt and launched the real app on iPhone 17 Pro simulator.
- Light/dark Detail screenshot flows passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml`
  - `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/detail.png`
  - `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/detail.png`
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/detail.png docs/design/app-screenshots/current-real-app/dark/detail.png` passed, both screenshots are 1206 x 2622.
- `npm run lint -- --quiet` from `apps/mobile` passed.
- `npm run typecheck` from `apps/mobile` passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` passed.
- `git diff --check` passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` passed.
- `python3 scripts/validate_harness.py` passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` passed; login, Learning, Space trial/favorite/sleep, Statistics, and Mine route actions remained intact.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Detail resolved object -> `LearningResultDetailSurface`; answer slip -> `detailAnswerSlip` and answer chips; continue CTA -> `learning-next-button`; card address -> existing `cardLocationStrip`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`. This run changes the resolved-card state rhythm but adds no new motion or core interaction family.
- Physical-space source: N/A. This run does not alter Space hierarchy or physical operations.
- Learning microcopy basis: design-backed product correction. Detail copy is revised to match the accepted resolved-card design mapping, not to change card content or answer semantics.

## Design Review Checklist

- Q1 Law of One / current library: Detail keeps one strong current-card library accent. Correctness feedback uses success tone as a small answer-state cue, not a competing library accent.
- Q2 focal object / first-read path: The focal object is the resolved current card. First read is current card -> answer state -> answer chips / explanation -> continue CTA -> floating chrome.
- Q3 interaction silhouette: Detail follows the resolved current-card silhouette from the mobile core reset mapping. It intentionally differs from practice interaction silhouettes because it is the answer-detail state attached to the card.
- Q4 forbidden design patterns: The refreshed screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment: Real iPhone 17 Pro light/dark screenshots confirm Detail fits without clipped text, overlap, horizontal overflow, safe-area collision, or content hidden behind the floating nav.
- Q6 surface-specific: Learning remains system-sequenced and does not expose module selection as primary path. Flip self-assess remains exactly two states and is not changed by this run.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Detail screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Learning Detail result hierarchy, copy, and screenshots. It preserves scoring, answer calculation, selectors, navigation, Space, Statistics, Mine, and metadata-leak protections while removing the report-like answer table and redundant continuity rail.

## 用户可见影响

- Yes. Detail now reads as the resolved state of the current card instead of a compact answer report.
- Yes. Answer evidence remains visible through two answer chips, while the primary continuation remains clear.
- No card content, scoring contract, Learning progression, Space state, membership, authentication, or sync behavior changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Smaller-device containment, tablet screenshots, dynamic type, and continued cross-surface polish remain follow-up evidence.
