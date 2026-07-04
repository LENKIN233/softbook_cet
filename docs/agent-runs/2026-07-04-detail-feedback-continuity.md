# Agent Run Record: Detail feedback continuity

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-1`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by tightening the Learning result-detail visual state. The result detail continuity shelf now follows the answer feedback tone instead of reintroducing the current library tone, so the resolved-card state reads as one coherent answer-and-continue surface.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/canon.md`

## Product truth used

- Learning remains a system-sequenced single-card flow with one current CET card, one primary task, meaningful result feedback, recovery, and quiet continuation.
- Detail is a resolved state of the same current card object, not a separate report page.
- Feedback hues and library identity hues must remain semantically separate; library color identifies the card, while result feedback should carry answer state.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` keeps the library identity rail as the card object marker.
- The location/continuity shelf in the result detail now uses `resultTone` for its subtle background and border, matching the answer slip and continuation CTA.
- Learning state, scoring, result records, route navigation, selectors, and copy remain unchanged.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset design artifacts, Learning interaction-motion artifacts, current real app screenshots, `apps/mobile/src/learning/LearningSurface.tsx`, and Learning Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: binds the result-detail continuity shelf to `resultTone` instead of the current library tone.
- `docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png`: real iPhone 17 Pro simulator result-detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app result-detail screenshot.
- `docs/agent-runs/2026-07-04-detail-feedback-continuity.md`: this run record.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_detail_feedback_continuity_pr_body.md --changed-file apps/mobile/src/learning/LearningSurface.tsx --changed-file docs/agent-runs/2026-07-04-detail-feedback-continuity.md --changed-file docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png --changed-file docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_detail_feedback_continuity_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Learning detail screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, refreshed detail screenshot is 1206 x 2622.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Mobile full Jest: pass, 26 suites and 163 tests.
- CloudBase API tests: pass, 11 tests.
- Maestro selector validation: pass.
- Full harness validation: pass.
- Whitespace check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-detail-feedback-continuity-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: The current library remains visible as a single card identity rail, while answer-state feedback uses one coherent result tone for the resolved detail surface. No second library accent is introduced.
- Q2 Focal object: The first-read path is current card answer -> result slip -> continuity shelf -> continue CTA -> bottom route chrome.
- Q3 Silhouette: The screen remains the accepted resolved-card/detail silhouette: same card object, attached answer slip, quiet continuity shelf, and one continuation action.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the detail card, answer slip, answer cells, continuity shelf, continuation CTA, safe area, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning stays system-sequenced and does not expose module selection as the primary path. This run does not alter Statistics or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- VL-AP-07: The visual output includes universal Q1-Q4 and conditional Q5-Q6 answers in this run record and PR body.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Learning detail screenshot flow, strict iOS smoke, App/full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning result detail now reads as a more unified resolved-card state: the continuity shelf no longer brings in a competing library-tinted panel after a result has been shown.
- Learning logic, scoring, selectors, card content, sync, membership, auth, Space state, and navigation are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Learning resolved object -> `apps/mobile/src/learning/LearningSurface.tsx` / `LearningResultDetailSurface`; answer slip and continuation tone -> `resultTone`; card identity rail -> `detailLibraryTone`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/interaction-motion/learning-core-interactions-v1.md`; no new motion implementation was added.
- Physical-space source: N/A; this run does not alter Space.
- Card content handoff/validation: N/A; this run does not alter card payload import, dry-run, audit, runtime smoke, or coverage delta.
- Unimplemented design gaps: Light-mode iPhone 17 Pro result-detail state is covered. Dark detail, incorrect/review result details, small-phone containment, tablet containment, dynamic type, and remote sync edge states remain follow-up quality passes.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The patch is visual-only and limited to the result-detail shelf tone.
- Dark mode and incorrect/review detail screenshots should be covered in follow-up quality passes so feedback tone behavior is proven across result outcomes.

## Follow-up

- Continue user-visible quality passes on remaining Learning feedback states, dark/tablet containment, and one-screen cohesion gaps across Learning, Space, Statistics, and Mine.
