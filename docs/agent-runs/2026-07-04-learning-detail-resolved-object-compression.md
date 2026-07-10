# Agent Run Record: Learning Detail resolved object compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-9`
- PR: N/A at record creation
- Summary: Continued the mobile quality reset by reshaping the real Learning Detail screen from a report-like explanation page into a resolved state of the current card object. The screen keeps the prompt, outcome, answer comparison, key explanation, position continuity, and next-card CTA in one one-screen card surface.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains a system-sequenced single-card flow, not a module picker or report center.
- Detail is not a separate report page. It is a resolved state of the current card object with an answer slip and a primary continue action.
- The current card/library accent remains the dominant screen accent; correctness feedback is scoped to the small result state.
- Auto-scored interactions can show correctness feedback, but this does not change the flip self-assess rule of exactly two states: `有把握` and `再回看`.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now uses the current card/library tone for the resolved object border, prompt area, answer comparison rail, continuity rail, and primary CTA.
- Correctness/result color is kept as a small outcome chip/dot rather than becoming the whole page's dominant treatment.
- Answer comparison moved directly under the outcome header so the detail reads as a compact answer slip attached to the card.
- Explanation text remains readable with enough line budget to avoid mid-sentence truncation in the real screenshot.
- Position copy was compressed from a verbose current-learning-position sentence to a small continuity row: `位置已保持` / `下一张仍按当前位置继续`.
- The test now asserts the next action uses the current library tone rather than the success feedback token.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current real app screenshots, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Learning Detail Maestro flow.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: compresses Learning Detail into a resolved current-card object with library-tone dominant accent, compact answer slip, readable explanation, and continuity row.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: updates the visual semantics assertion so the continue action follows the current card/library tone rather than the correctness feedback token.
- `docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png`: real iPhone 17 Pro simulator Learning Detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Learning Detail screenshot.
- `docs/agent-runs/2026-07-04-learning-detail-resolved-object-compression.md`: this run record.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 2 suites and 51 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/detail.png` -> passed, 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_learning_detail_resolved_object_compression_pr_body.md --changed-file apps/mobile/src/learning/LearningSurface.tsx --changed-file apps/mobile/__tests__/LearningSurface.test.tsx --changed-file docs/agent-runs/2026-07-04-learning-detail-resolved-object-compression.md --changed-file docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png --changed-file docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_learning_detail_resolved_object_compression_pr_body.md` -> passed.

## Validation results

- Focused Learning/App Jest: pass, 2 suites and 51 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Learning Detail screenshot flow: pass.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: Learning Detail uses the current card/library accent as the dominant accent for the resolved object, prompt plane, answer rail, continuity rail, and CTA. Correctness feedback stays scoped to the small result state.
- Q2 Focal object: First-read path is current card header -> resolved prompt -> attached answer slip -> explanation -> position continuity -> next-card CTA -> floating chrome.
- Q3 Silhouette: Detail remains a resolved state of the Learning current-card silhouette, not a separate report page or vertical article.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, module-selection copy, or complex dashboard language.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot at 1206 x 2622 confirms route header, resolved object, answer comparison, explanation, continuity row, primary CTA, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This is a Learning Detail surface. It preserves Learning system sequencing, keeps the answer detail attached to the current object, does not change Statistics tabular treatment, and does not alter the flip self-assess model.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Learning Detail screenshot flow, iOS smoke flow, Maestro selector validation, PR design gate, and agent review gate.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Learning Detail now reads as the current card after resolution instead of a standalone answer report page.
- The user can still return to the card face, compare selected vs correct answer, read the key explanation and exam tip, and continue to the next card.
- Existing stable selectors are preserved: `learning-result-detail-screen`, `learning-detail-selected-answer`, `learning-detail-correct-answer`, `learning-result-back-button`, and `learning-next-button`.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: resolved object -> `LearningResultDetailSurface` / `learning-result-detail-screen`; answer slip -> `learning-detail-selected-answer` and `learning-detail-correct-answer`; continue CTA -> `learning-next-button`; card face recovery -> `learning-result-back-button`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-learning-detail-resolved-object-compression-simulator.png` -> `docs/design/app-screenshots/current-real-app/detail.png`
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; no new motion implementation was added.
- Physical-space source: N/A; this run only changes Learning Detail, though it preserves position continuity copy.
- Unimplemented gap: This pass covers signed-in light-mode multiple-choice correct Detail. Incorrect/review Detail, dark mode, tablet containment, and transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and current progression actions are preserved.
- Future passes should cover incorrect/review detail tone, dark-mode readability, tablet containment, and motion continuity between card answer and detail.
