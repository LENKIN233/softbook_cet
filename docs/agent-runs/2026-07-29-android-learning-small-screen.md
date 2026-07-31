# Agent Run Record: Android Learning small-screen containment

## Task summary

- Date: 2026-07-29
- Branch: `fix/android-learning-small-screen`
- PR: https://github.com/LENKIN233/softbook_cet/pull/461
- Summary: Fixes Learning card overlap on Android phone viewports, including the 320dp acceptance width. The change keeps all five core interactions and the resolved-answer detail on one operable screen without changing interaction semantics.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`

## Product truth used

- Learning remains a single addressed card flow. The prompt and active card are the focal object; peek, hint, favorite, address continuity, and submit remain secondary actions.
- Flip remains a two-state self-assessment: `有把握` uses mint and `再回看` uses amber. No third or fourth state is introduced.
- Swipe remains one top card with left/right trail choices; it is not converted into a new card family or a button-only replacement.
- Phone Learning is a one-screen action plane. User-visible controls must not overlap or be clipped, and interactive targets remain at least 44dp high.
- The compact presentation may remove repeated chrome, but it must preserve the same card, address, answer, and interaction semantics.

## Implementation hypothesis changed

- Learning enters compact mode at viewport width `<= 340dp` or viewport height `<= 720dp`.
- In compact mode, the repeated location strip and prompt eyebrow are collapsed into the card header, while the header retains `本轮盒` address continuity.
- Interaction-specific spacing is reduced without reducing body copy below 13sp. Utility, confidence, lock, swipe, and primary action targets retain a minimum 44dp height where applicable.
- Lock rows become single-line slot work areas on compact phones, so all three slots remain selectable above the utility and submit docks.
- Resolved-answer detail uses bounded summaries in compact mode so both answer cells and the next-card action remain visible; source content and semantic labels are unchanged.

## Workspace boundary and read scope

- Active truth/source read: the task-relevant specs and accepted design artifacts listed above, `apps/mobile/src/learning/LearningSurface.tsx`, its focused tests, the shared Maestro smoke flow, and the Learning detail flow.
- Generated/dependency/cache/archive read: local Android emulator screenshots and native accessibility bounds were inspected as validation evidence. Dependency folders were used only to run locked tests.
- External workspace read: none. This run did not read or modify `/Users/lenkin/programing/card make`, candidate card content, approvals, imports, or audio assets.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: adds deterministic compact-viewport selection and compact layouts for the card header, five interaction families, utility/submit docks, swipe trails, and resolved-answer detail.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: covers the compact viewport boundary and protects swipe option width, copy truncation, spacing, and minimum body typography.
- `docs/agent-runs/2026-07-29-android-learning-small-screen.md`: records design authority, implementation mapping, device evidence, validation, and remaining gaps.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand __tests__/LearningSurface.test.tsx` in `apps/mobile` -> passed, 6 tests.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 43 suites and 401 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm ci && npm test` in `infra/cloudbase/functions/softbook-api` -> passed after installing the worktree's locked dependencies, 170 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py --format text` -> passed after the final compact-detail adjustment.
- `git diff --check` -> passed after the final compact-detail adjustment.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro test /tmp/android-swipe-proof.yaml` at 1080x2340 / 440dpi (393dp class) -> passed through all five Learning interactions to the swipe acceptance point.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` at 1080x2340 / 440dpi (393dp class) -> passed the full shared flow through Learning completion, Statistics, and Mine.
- `adb shell wm density 540` on the same 1080x2340 emulator -> established a 320x693dp compact viewport.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro test /tmp/android-swipe-proof.yaml` at 320x693dp -> passed through flip, multiple choice, lock, elimination, and the swipe acceptance point.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro test /tmp/android-learning-detail-proof.yaml` at 320x693dp -> passed through resolved answer detail with both answer cells and the next-card action visible.
- Shared full-flow Maestro at 320x693dp -> Learning completed, then the flow exposed a separate pre-existing Mine screen overlap and failed when the Mine shortcut could not return to Statistics.
- 2026-07-31 serial-integration validation after locally rebasing onto auth-sanitization exact head `dd74785fc2f7d8388e2791a95ccb5e28d249085c`:
  - `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK`.
  - `cd apps/mobile && npm run lint -- --quiet && npm run typecheck` -> passed.
  - `cd apps/mobile && npm test -- --runInBand --watchAll=false` -> 44 suites and 422 tests passed.
  - `cd apps/mobile && npm run metadata-leak-scan && npm run design-metadata-leak-scan` -> both repository scans passed.
  - `git diff --check dd74785fc2f7d8388e2791a95ccb5e28d249085c...HEAD` -> passed; the Learning-only diff remains limited to the three files listed above.
- After PR #458 passed every required check and squash-merged as `f3c1b525634ee5e61a790cab354e0d29059b4cee`, the four Learning commits were rebased onto exact `origin/main`; the pre-record-update tree `f47bc30947df85155a8c4354a5c31a1caa33d999` exactly matches the pre-merge validated tree and the rebased commits retain valid signatures.

## Validation results

- Learning focused Jest: pass, 6 tests.
- Mobile full Jest: pass, 43 suites and 401 tests.
- CloudBase API tests: pass, 170 tests after locked dependency installation.
- Mobile lint, typecheck, visible metadata scan, design metadata scan, Maestro selector validation, and harness validation: pass.
- 393dp Android emulator: full shared auth, trial, Space, five-interaction Learning, completion, Statistics, and Mine flow passed.
- 320x693dp Android emulator: five Learning interactions, result summaries, completion transition, and resolved-answer detail passed.
- 320dp native bounds for swipe: safe choice `[85,1206][521,1369]`; utility row begins at y=1507; submit button `[716,1689][959,1830]`. The regions do not overlap.
- 320dp native bounds for resolved detail: selected answer `[115,1019][530,1179]`; correct answer `[550,1019][965,1179]`; next button `[85,1702][997,1851]`. The action remains visible and tappable.

## Binary evidence

- Evidence manifest: N/A. Screenshots were captured and inspected locally under `/tmp` and Maestro's local test output; ordinary Git does not store generated visual evidence.
- Archive: N/A.

## Design review checklist

- Q1 Law of One: the active library accent remains the only dominant accent. Compact mode removes repeated vertical chrome and introduces no new palette.
- Q2 Focal object: the first-read path remains current card -> prompt -> interaction object -> secondary utilities -> primary submit/next action. At 320dp, the card is still the dominant object.
- Q3 Silhouette: the accepted addressed single-card silhouette and the five interaction silhouettes are preserved. Swipe still reads as a top card with left/right trails; lock still reads as three owned slots.
- Q4 Forbidden patterns: no metadata, agent, harness, runtime, debug, seed, fixture, TODO, gamification chrome, gradient text, serif type, or internal error copy is exposed.
- Q5 Layout containment: native Android bounds at 320x693dp and 393dp show no overlap in Learning; both swipe choices and result-detail next action remain visible. Body copy stays at or above 13sp and compact utility/action targets retain 44dp minimum height.
- Q6 Surface-specific: Learning sequencing, answer authority, hint semantics, favorite behavior, result detail, and two-state flip self-assessment are unchanged. Compact mode only changes presentation and bounded summaries.
- AP-22: all six design review questions are answered here, with Android emulator screenshots visually inspected and native bounds recorded.
- AP-23: `有把握` remains mint/confident and `再回看` remains amber/review; no red review state and no four-level self-assessment are introduced.

## Agent review status

- Reviewer: Codex independent PR implementation review.
- Status: Passed.
- Blocking findings: None for this Learning-only PR. Full-app 320dp acceptance remains incomplete because of the separate Mine screen overlap recorded below.
- Review evidence: focused Learning tests (6/6), TypeScript typecheck, ESLint, diff checks, emulator screenshots, and recorded native bounds were rechecked on 2026-07-29. The review found no change to the five interaction semantics, answer authority, or two-state self-assessment contract.

## User-visible UI impact

- Yes. Learning now adapts to 320dp and short phone viewports without overlapping interaction, utility, submit, or result-detail controls.
- Design source: `docs/design/decisions/learning-card-rhythm-decision-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, and `docs/design/mocks/learning-card-rhythm-v1.md`.
- Implementation mapping: `docs/design/mapping/learning-space-implementation-map-v1.md` and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implemented mapping: addressed card header -> compact combined session/box label; prompt hierarchy -> compact prompt panel; interaction body -> interaction-specific compact styles; secondary utilities -> one visible 44dp row; action dock -> bounded submit area; resolved card -> bounded answer/analysis slips and visible next action.
- Unimplemented gap: this run does not change other routes. The 320dp Mine surface still overlaps and prevents the full shared flow from completing after Learning; it requires a separate accepted-artifact-backed UI PR. Dynamic-type and physical-device visual passes also remain pending.

## Card make external workspace impact

- N/A. No candidate cards, approval records, audio assets, imports, or `/Users/lenkin/programing/card make` files were changed.

## Risks and open questions

- The 320dp proof uses a real Android emulator rendering with a density override, not a physical 320dp handset.
- Full-app 320dp readiness is not achieved because Mine still has overlapping cards/actions. This run must not be used as evidence that every route is 320dp-ready.
- Dynamic font scaling and a physical Android device remain required before beta release readiness.

## Follow-up

- Push final exact head with an explicit remote lease and rerun all required checks.
- Deliver this Learning-only PR only after its new exact-head Agent review and required checks pass.
- Open a separate user-visible UI run for Mine 320dp containment, then repeat the full shared 320dp flow.
- Repeat Learning and full-flow validation on a physical Android device and with supported dynamic-type settings before declaring beta readiness.
