# Agent Run Record: Learning detail analysis first

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/learning-detail-quality-pass`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by making the Learning result detail state prioritize exam-oriented analysis. The answer comparison now sits below the explanation, so the completed card reads as resolve -> settle -> continue instead of a cramped report panel.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow.
- Feedback should answer what happened, what the learner should take away, what comes next, and how the card position remains continuous.
- Analysis must explain key points and exam traps with low cognitive load.
- Result detail is a resolved state of the current card, not a separate report page or vertical article.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now places the analysis slip before the selected/correct answer comparison.
- The duplicate selected-answer line was removed from the prompt hero.
- The explanation summary now has room for three lines and the exam tip has room for two lines in the real phone frame.
- The selected/correct answer cells are kept visible with the existing `learning-detail-selected-answer` and `learning-detail-correct-answer` test IDs, but they are visually secondary to the explanation.
- The current real app Detail screenshot was refreshed from the iPhone 17 Pro simulator.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Learning detail Maestro flow, strict iOS smoke flow, and current real app screenshot evidence.
- Generated/dependency/cache/archive read: simulator screenshots and dimensions were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: reorders Learning result detail so analysis is first and answer comparison is compact.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: protects the new study-facing detail caption.
- `apps/mobile/__tests__/App.test.tsx`: protects the app-level result detail copy and leak guard.
- `docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png`: real iPhone 17 Pro simulator Detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Detail screenshot.
- `docs/agent-runs/2026-07-02-learning-detail-analysis-first.md`: this run record.

## Commands run

- `git fetch --prune origin` -> passed.
- `./scripts/install_git_hooks.sh` -> passed.
- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 50 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, both `1206 x 2622`.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Learning detail screenshot flow: pass on iPhone 17 Pro simulator, iOS 26.5.
- Strict iOS smoke: pass on iPhone 17 Pro simulator, iOS 26.5.
- Screenshot dimensions: pass, both `1206 x 2622`.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Targeted Learning/App Jest: pass, 50 tests.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: Detail keeps the current card/library accent and success tone restrained. No competing dominant color system was introduced.
- Q2 Focal object: First-read path is Learning route -> resolved current card -> result slip -> explanation -> compact answer comparison -> Space continuity -> continue.
- Q3 Silhouette: Detail remains a resolved current-card state, not a report page or a dashboard. The primary continuation is still thumb-reachable.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the card, explanation slip, answer comparison, location shelf, continue button, and floating tab bar fit without clipped text, overlap, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced. The detail state follows resolve -> settle -> continue and does not add a module picker, stats blocker, or new interaction family.
- AP-22: The design review checklist six questions are answered here before PR delivery, and pre-render proof is the real iPhone simulator screenshot.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Learning detail screenshot flow, strict iOS smoke, typecheck, lint, full Jest, metadata scans, selector validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Detail state now lets the learner read the key explanation and exam tip without truncation in the checked phone frame.
- The answer comparison remains visible, but it no longer dominates the feedback surface.
- The next-card action and Space continuity remain in the same one-screen flow.

## Design source and implementation mapping

- Design source: `docs/design/single-card-ux-contract.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, and `apps/mobile/src/learning/LearningSurface.tsx`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-learning-detail-analysis-first-simulator.png` -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; no new motion implementation was added.
- Learning microcopy basis: Learning visible copy changed as a design-backed product correction to make result detail study-facing and avoid report-panel hierarchy.
- Unimplemented gap: Light-mode phone detail is verified. The top resolved prompt block can still be tightened in a later pass; dark mode/tablet detail evidence remains follow-up.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The result detail remains one screen for the checked card. Longer production analysis may require an explicit expansion pattern or dedicated long-content proof before increasing text further.
- The top prompt block still carries a large visual footprint; a later Learning pass should tune prompt scale while preserving the current-card focal object.

## Follow-up

- Continue with Learning prompt/result balance, remaining auth entry states, and dark/tablet containment evidence.
