# Agent Run Record: Result detail success tone

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/result-detail-success-tone`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by correcting Learning Detail result semantics. This pass separates current-library identity from result feedback so a correct resolved detail screen reads as success, not warning/error, and refreshes the real iOS simulator Detail screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow. Detail is a resolved state of the current card, not a separate report page, article page, or statistics view.
- Feedback hues and library identity hues have different meanings. Feedback hues must not be used as library identity, and library hues must not encode correctness.
- A correct result means confirmation and continuation, not reward chrome. An incorrect or review result means correction and recovery, not punishment.
- The result detail must preserve the current-card silhouette and keep the answer slip attached to the completed card.
- Flip self-assess remains exactly two states: `有把握` and `再回看`. This run does not alter flip scoring or self-assess colors.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now uses the result tone for the resolved card border, hero background, answer slip edge, and continuation CTA.
- The current library identity remains present as the small card-object accent and address context instead of acting as the correctness signal.
- The correct detail path now has one dominant success signal across the resolved object, answer slip, and `继续下一张` action.
- A focused unit assertion now prevents the correct detail CTA from regressing back to library identity color.
- The current real app Detail screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile implementation mapping, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS detail/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: separates result feedback tone from library identity tone in `LearningResultDetailSurface`.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: asserts the correct result detail CTA uses the success tone.
- `docs/agent-runs/artifacts/2026-07-01-result-detail-success-tone-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: current real app Detail screenshot.
- `docs/agent-runs/2026-07-01-result-detail-success-tone.md`: this run record.

## Commands run

- `npm test -- --runInBand --watchAll=false LearningSurface` in `apps/mobile` -> passed, 3 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-result-detail-success-tone-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-result-detail-success-tone-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-result-detail-success-tone-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, both 1206 x 2622.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused LearningSurface Jest: pass, 3 tests.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Detail screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-result-detail-success-tone-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: The current library remains visible as the card source marker, while the result state owns the single strong feedback accent on the resolved object, answer slip, and CTA. Library identity is no longer used to imply correctness.
- Q2 Focal object: The focal object is the resolved current card. First-read path is route title -> current-card identity -> outcome -> prompt -> selected answer -> attached answer slip -> location shelf -> continue CTA -> floating chrome.
- Q3 Silhouette: Detail remains a resolved state of the Learning card silhouette. This pass changes semantic tone ownership without introducing a new page layout or report surface.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the prompt, answer cells, explanation, location shelf, CTA, and floating navigation fit without horizontal overflow, text collision, or clipped primary action.
- Q6 Surface-specific: This is Detail-only. It preserves Learning sequencing, answer test IDs, result semantics, and the two-state flip self-assess model.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Detail screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Correct Learning Detail now reads as a single success state instead of mixing success text with coral warning-like action and frame colors.
- Design source: `spec/visual-language.json`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; this pass keeps the accepted `resolve -> settle -> continue` rhythm and changes no motion family.
- Learning microcopy basis: no visible-copy change.
- Implementation mapping: resolved object -> `learning-result-detail-screen`; selected answer -> `learning-detail-selected-answer`; correct answer -> `learning-detail-correct-answer`; continuation action -> `learning-next-button`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the correct multiple-choice result-detail path. Dark mode, tablet screenshot evidence, review-phase detail screenshot, and all other interaction-specific result-detail screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the correct multiple-choice detail path on light-mode iPhone 17 Pro. Other interaction result-detail states share the same tone mapping and are covered by tests/smoke, but they do not yet have individual screenshot evidence.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, review-phase Detail, and interaction-specific Detail screenshot coverage.
