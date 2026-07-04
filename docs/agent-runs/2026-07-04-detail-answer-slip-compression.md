# Agent Run Record: Detail answer slip compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-5`
- PR: N/A at record creation
- Summary: Continued the mobile quality reset by reshaping the Learning result detail from a report-like stack into a resolved current-card state with one attached answer slip. The explanation, answer comparison, Space continuity cue, and continue action now read as one feedback layer attached to the current card.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/card-system.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/single-card-ux-contract.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow, not a generic English-learning dashboard.
- Detail is the resolved state of the same current card object. It must not become a separate result report page or vertical article.
- Feedback must answer learner outcome, next action, and Learning-to-Space continuity without exposing algorithms, queues, sync details, metadata, or raw runtime state.
- The primary action must remain visually and spatially dominant; secondary details stay attached and lower weight.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now renders selected/correct answers as a single comparison rail instead of two competing mini cards.
- The current-position cue moved from a standalone location shelf into the answer slip as a compact continuity rail.
- The explanation body no longer appears as an inner card inside the slip. It is an integrated content block separated by a light divider.
- The result detail keeps existing behavior and stable selectors: `learning-result-detail-screen`, `learning-detail-selected-answer`, `learning-detail-correct-answer`, `learning-result-back-button`, and `learning-next-button`.
- The Detail screenshot flow now dismisses the auth keyboard through existing selector `auth-gate-keyboard-dismiss-target`, matching `ios-smoke.yaml`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, single-card UX contract, `spec/visual-language.json`, current real app screenshots, `apps/mobile/src/learning/LearningSurface.tsx`, focused Learning/App tests, Detail and smoke Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro debug artifacts were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: compresses the result detail feedback hierarchy into one attached answer slip and keeps the continue CTA dominant.
- `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml`: aligns the screenshot flow with the main smoke flow by dismissing the auth keyboard before submit.
- `docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png`: real iPhone 17 Pro simulator Detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Detail screenshot.
- `docs/agent-runs/2026-07-04-detail-answer-slip-compression.md`: this run record.

## Commands run

- `npx prettier --write apps/mobile/src/learning/LearningSurface.tsx` -> passed; unrelated formatting noise was manually reverted before final diff.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 2 suites and 51 tests; pretest metadata leak scan passed.
- `npm start -- --host 127.0.0.1` in `apps/mobile` -> started Metro for simulator validation.
- `maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` without `JAVA_HOME` -> failed because the shell could not locate a Java runtime.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> first run reached auth code state but failed before Learning because the keyboard was still open.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` after adding keyboard dismissal -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/detail.png` -> passed, 1206 x 2622.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_detail_answer_slip_compression_pr_body.md --changed-file apps/mobile/src/learning/LearningSurface.tsx --changed-file apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml --changed-file docs/agent-runs/2026-07-04-detail-answer-slip-compression.md --changed-file docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png --changed-file docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_detail_answer_slip_compression_pr_body.md` -> passed.

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
- Detail screenshot flow: pass after aligning auth keyboard dismissal with the main smoke flow.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: Detail is the current Learning card in the cloze library. Mint remains the single strong result/accent color for the correct resolved state; other library colors are not introduced.
- Q2 Focal object: First-read path is current card object -> attached answer slip -> primary continue CTA -> floating chrome. The answer comparison and position cue are no longer peer report cards.
- Q3 Silhouette: Detail follows the resolved-current-card silhouette from `mobile-core-surface-reset-v1`: same card object with an attached answer slip and continue action, not a separate result report page. The multiple-choice answer state remains identifiable through the prompt and answer comparison.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot at 1206 x 2622 confirms route header, current card, answer slip, answer rail, continuity row, continue CTA, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced and one-current-card-first. The change does not alter flip self-assess; the two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state self-assess remains intact in `LearningSurface.tsx`.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Detail screenshot flow, iOS smoke flow, and Maestro selector validation.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The result detail now reads as a current-card feedback state instead of a report-like page.
- The learner can still inspect explanation, selected answer, correct answer, and card-position continuity before continuing.
- Existing result-detail behavior, navigation, and stable selectors are preserved.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/single-card-ux-contract.md`, and `spec/visual-language.json`.
- Implementation mapping: resolved object -> `LearningResultDetailSurface`; answer slip -> `detailAnswerSlip`; explanation -> integrated `detailExplanationSlip`; selected/correct answer comparison -> `detailAnswerRail` with existing `learning-detail-selected-answer` and `learning-detail-correct-answer` selectors; continuity cue -> `detailContinuityRail`; continue action -> `learning-next-button`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-detail-answer-slip-compression-simulator.png` -> `docs/design/app-screenshots/current-real-app/detail.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing result-detail open/back/continue handlers are reused.
- Physical-space source: N/A; the continuity cue names the current Learning position but does not change Space behavior.
- Learning microcopy basis: result-detail copy follows single-card feedback rules: outcome, explanation, answer comparison, Space continuity, and next action.
- Unimplemented gap: This pass covers the correct multiple-choice Detail state in light mode. Incorrect/review result tones, dark mode, tablet containment, and transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The UI behavior risk is low because stable selectors and action handlers are preserved.
- The screenshot flow change is a harness stability fix; it reuses a selector already present in `ios-smoke.yaml`.
- Additional screenshot coverage should be added later for review/incorrect Detail tones.

## Follow-up

- Continue quality passes on remaining secondary states: statistics density, incorrect/review Detail tone, dark mode, tablet containment, and motion continuity.
