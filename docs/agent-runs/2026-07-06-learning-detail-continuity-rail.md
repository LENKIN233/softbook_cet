# 2026-07-06 Learning Detail Continuity Rail

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

- Learning is a system-sequenced single-card flow.
- The Detail surface is the resolved state of the current CET card object, not a report page, article, or second action surface.
- The answer slip is attached to the resolved object.
- The primary next-card continuation is the bottom `learning-next-button` CTA.
- Space address and position copy should preserve continuity without exposing implementation metadata.

## Implementation Hypothesis

- The Detail answer slip continuity rail should read as quiet position status, not as a second continue-like command.
- Replacing `当前位置 / 下一张仍按本轮盒继续` with `位置保持 / 本轮盒节奏保持` keeps the Learning rhythm in `settle -> continue`: bookkeeping stays quiet, and the bottom CTA remains the only primary continuation.
- The rail can become transparent with a subdued border so it reads as attached status rather than another button-like pill.
- Existing behavior, route structure, card content, interaction test IDs, scoring, and sync paths remain unchanged.

## 变更摘要

- `apps/mobile/src/learning/LearningSurface.tsx`
  - Changes the Learning result-detail continuity rail from a filled panel to a transparent, lower-weight status row.
  - Changes visible copy from `当前位置 / 下一张仍按本轮盒继续` to `位置保持 / 本轮盒节奏保持` for non-final cards.
  - Leaves final-card copy, bottom CTA, progression behavior, and test IDs unchanged.
- `apps/mobile/__tests__/LearningSurface.test.tsx`
  - Adds regression coverage for the new status copy.
  - Asserts the old continue-like rail copy no longer appears while the primary `继续下一张` CTA remains.
- `docs/design/app-screenshots/current-real-app/detail.png`
- `docs/design/app-screenshots/current-real-app/dark/detail.png`
  - Refreshed real iPhone 17 Pro simulator screenshots for the corrected Detail state.

## 真实截图

- Light refreshed: `docs/design/app-screenshots/current-real-app/detail.png`.
- Dark refreshed: `docs/design/app-screenshots/current-real-app/dark/detail.png`.
- Both refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the answer slip now shows `位置保持 / 本轮盒节奏保持`, with `继续下一张` remaining the only primary continuation action.

## 验证

- `npm exec prettier -- --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx --testNamePattern="result detail reads as a resolved card without raw metadata|can complete the local single-card deck and restart it"` from `apps/mobile` -> passed; metadata leak pretest passed.
- Light `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `detail.png`.
- Dark `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` on iPhone 17 Pro simulator -> passed and refreshed `dark/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/detail.png docs/design/app-screenshots/current-real-app/dark/detail.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- Remote simulator smoke after clear-state launch passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-cet-clearstate-launch.yaml`
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml`

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Detail resolved object -> `LearningResultDetailSurface`; answer slip -> result-detail substate; continue CTA -> bottom `learning-next-button`; continuity rail -> quiet attached status inside the answer slip.
- Interaction/motion source: `docs/design/interaction-motion/learning-core-interactions-v1.md` and `docs/design/interaction-motion/learning-card-rhythm-v1.md`. This run adds no new interaction family or motion curve; it preserves the existing `settle -> continue` rhythm and removes a duplicate continue-like prompt.
- Physical-space source: N/A. This run does not alter Space hierarchy, physical model, or Space operations.
- Learning microcopy basis: design-backed product correction. The Detail status row now uses human study continuity language and avoids implementation-layer or duplicate-action wording.

## Design Review Checklist

- Q1 Law of One / current library: The current-library accent remains the only strong accent on the Detail screen. The continuity rail is neutral status copy and does not introduce a competing accent.
- Q2 focal object / first-read path: The current CET card remains the focal object. First read stays resolved object -> answer slip -> primary bottom continuation CTA.
- Q3 interaction silhouette: The Learning current-card silhouette and `settle -> continue` rhythm are preserved. The status row supports the answer slip instead of becoming another action surface.
- Q4 forbidden design patterns: The refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal implementation copy.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm the Detail object, answer slip, status rail, and bottom CTA fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced and single-card; Statistics is not touched; flip self-assess remains exactly two states, `有把握` = mint/confident and `再回看` = amber/review.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Detail screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is tightly scoped to Learning Detail status copy and visual hierarchy. It removes a duplicate continue-like affordance while preserving behavior, route chrome, card content, scoring, Space continuity, and sync contracts.

## 用户可见影响

- Yes. Learning Detail now reads more like a resolved single-card app state and less like a page with two continuation prompts.
- Yes. The status rail copy is quieter and study-facing.
- No Learning scoring, interaction family, card content, auth, membership, Space favorite/sleep behavior, Statistics behavior, or remote sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Remaining follow-up evidence should continue across other surfaces and smaller-device/dynamic-type/tablet screenshots.
