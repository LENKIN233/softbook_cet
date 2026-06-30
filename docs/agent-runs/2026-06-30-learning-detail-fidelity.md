# Agent Run Record: Learning result-detail fidelity pass

## Task summary

- Date: 2026-06-30
- Branch: `codex/learning-detail-fidelity`
- PR: https://github.com/LENKIN233/softbook_cet/pull/264
- Summary: Continued frontend quality reshaping by replacing the Learning result-detail surface with a dedicated one-screen resolved-card state and adding a real app detail screenshot. The new path shows the completed card, the user's selected answer, the correct answer, the attached explanation slip, and the next-card continuation without exposing internal metadata.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/mocks/leadership-screenshot-handoff-v2.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains a system-sequenced single-card flow.
- Learning detail is the post-answer resolved-card state: completed card -> selected answer -> explanation slip -> next-card continuation.
- The detail view must not become a generic document page, module picker, card-management list, or statistics surface.
- Result copy stays study-facing and must not expose source, payload, cache, queue, repository, runtime, mock, seed, card id, box id, or raw answer-key language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` no longer reuses the inline `ResultPanel`.
- Detail now receives the current card state so it can render the real user action from the completed interaction.
- The detail screen renders a compact state bar, a resolved paper-card object, selected/correct answer cells, an attached explanation slip, and a single continuation CTA.
- All five Learning interaction types can produce user-facing selected/correct rows through normalized display text.
- A dedicated Maestro flow now reaches `learning-result-detail-screen` from the real app and asserts selected/correct answer regions before screenshot capture.
- `docs/design/app-screenshots/current-real-app/detail.png` was added as a real iOS simulator screenshot from the current app.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/src/learning/LearningSurface.tsx`, App/Learning tests, Maestro flows, accepted Learning visual artifacts, and current real screenshot docs.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as evidence context, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: replaces result detail with a dedicated resolved-card layout and normalized answer-row rendering for all interaction types.
- `apps/mobile/App.tsx`: passes `learningCardState` into the result detail state and guards detail rendering on that state.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: asserts the detail screen renders selected/correct answer regions and avoids raw metadata.
- `apps/mobile/__tests__/App.test.tsx`: verifies the real app path from submit -> open detail -> continue.
- `apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml`: adds the real iOS detail screenshot flow.
- `docs/design/app-screenshots/current-real-app/detail.png`: adds the real iOS simulator Learning detail screenshot.
- `docs/agent-runs/artifacts/2026-06-30-learning-detail-fidelity-simulator.png`: source simulator capture for the detail screenshot.
- `docs/agent-runs/2026-06-30-learning-detail-fidelity.md`: records this run.

## Commands run

- `npm test -- LearningSurface.test.tsx App.test.tsx --runInBand` in `apps/mobile` -> pass, 2 suites and 47 tests.
- `npm run typecheck` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run metadata-leak-scan` in `apps/mobile` -> pass.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 159 tests.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `git diff --check` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-detail-fidelity-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-detail-fidelity-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> pass, both 1206 x 2622.

## Validation results

- Focused Learning/App Jest: pass.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile metadata leak scan: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Learning detail screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real detail screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 with no development overlay in the committed screenshot.

## Design review checklist

- Q1 Law of One: Learning detail keeps the resolved-result tone as the state accent and does not introduce a competing decorative palette.
- Q2 Focal object: the resolved card is the first-read object; the path is detail state bar -> completed card -> selected/correct answer cells -> explanation slip -> next-card continuation.
- Q3 Silhouette: the detail state now matches the accepted resolved-card explanation rhythm from the leadership handoff instead of a generic stacked results page.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, gradient text, gamification chrome, full-width bottom tabbar, or removed self-assess token copy was introduced.
- Q5 Layout containment: the real simulator screenshot confirms the resolved card, answer cells, explanation slip, continuation CTA, and floating tab capsule stay inside the 1206 x 2622 capture.
- Q6 Surface-specific: this is a Learning detail pass. Space, Statistics, Mine, membership gates, and scoring semantics are unchanged.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection, focused tests, full mobile tests, typecheck, lint, metadata scans, selector validation, harness validation, Learning detail screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning result detail now reads like a real app post-answer state and adds the missing real app screenshot expected by the leadership screenshot set.
- Design source: `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/storyboards/learning-space-motion-prototype-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: completed card -> `learning-result-detail-screen` resolved card; selected answer -> `learning-detail-selected-answer`; correct answer -> `learning-detail-correct-answer`; explanation slip -> analysis title/summary/tip; continuation -> existing `learning-next-button`.
- Unimplemented gap: This does not solve Space card-list/detail, Statistics, Mine, or broader route-level visual quality. Those need separate passes.

## Card make external workspace impact

- N/A.

## Risks and open questions

- The detail screenshot is now real app evidence, but the wider screenshot set is still uneven. The next frontend quality pass should target the Space card-list/detail state and then reassess Statistics/Mine.
