# Agent Run Record: Learning visual polish pass

## Task summary

- Date: 2026-06-30
- Branch: `codex/learning-visual-polish`
- PR: pending
- Summary: Responded to the design-quality regression feedback on the Learning real-app screenshot. This pass tightens the Learning phone chrome, reduces the hard engineering outline on the current card, makes the screenshot state selected/actionable instead of disabled, and refreshes the real simulator screenshot.

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
- The first Learning screen is an active current-card task, not a completed-session summary, module picker, statistics board, or card-management screen.
- Multiple-choice keeps the prompt-plus-2x2 option silhouette.
- The screenshot must come from the real app and must not expose development overlay chrome or internal metadata.

## Implementation hypothesis changed

- Learning's phone top bar is more compact so the current card gets more first-viewport weight.
- The current card border/shadow is softened to reduce wireframe/engineering feel.
- The current-box strip and card progress accents are lighter and more paper-attached.
- The question prompt is slightly reduced to avoid crowding the option grid.
- Selected multiple-choice options receive a clearer material state.
- The Learning screenshot flow now taps an option and stops before submit so the committed real screenshot shows a selected option and enabled primary action instead of a disabled CTA.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/src/learning/LearningSurface.tsx`, Learning/App tests, Maestro flows, and current real screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as evidence context, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/App.tsx`: adds compact phone chrome for the Learning route.
- `apps/mobile/src/learning/LearningSurface.tsx`: softens current-card material, reduces prompt crowding, clarifies selected option state, and uses a stronger active submit color.
- `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml`: stops on a selected, actionable Learning state and still clears development overlay chrome.
- `docs/design/app-screenshots/current-real-app/learning.png`: updated real iOS simulator Learning screenshot.
- `docs/agent-runs/artifacts/2026-06-30-learning-visual-polish-simulator.png`: source simulator capture for the updated Learning screenshot.
- `docs/agent-runs/2026-06-30-learning-visual-polish.md`: records this run.

## Commands run

- `npm test -- LearningSurface.test.tsx App.test.tsx --runInBand` in `apps/mobile` -> pass, 2 suites and 46 tests.
- `npm run typecheck` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-visual-polish-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/learning.png`.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 158 tests.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `git diff --check` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-visual-polish-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> pass, both 1206 x 2622.

## Validation results

- Focused Learning/App Jest: pass.
- Mobile full Jest: pass, 26 suites and 158 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Learning screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real Learning screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 with no development overlay in the committed screenshot.

## Design review checklist

- Q1 Law of One: Learning keeps one current-library accent for progress, selected option, and the active submit action; no competing accent family was introduced.
- Q2 Focal object: the current card remains the first-read object; the screenshot path is compact shell -> current card -> current-box strip -> prompt -> selected option -> submit.
- Q3 Silhouette: the multiple-choice 2x2 grid remains the visible interaction silhouette, now captured in a selected/actionable state instead of a disabled state.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, gradient text, gamification chrome, full-width bottom tabbar, or removed self-assess token copy was introduced.
- Q5 Layout containment: the real simulator screenshot confirms the compact shell, current card, selected option grid, primary action, and floating tab capsule stay inside the 1206 x 2622 capture.
- Q6 Surface-specific: this is a Learning visual polish only. Space, Statistics, Mine, membership gates, and scoring semantics are unchanged.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection, focused tests, full mobile tests, typecheck, lint, metadata scan, selector validation, harness validation, Learning screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning main-card screenshot quality is improved from a disabled, wireframe-like state to a selected/actionable real-app state.
- Design source: `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/storyboards/learning-space-motion-prototype-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: compact Learning chrome -> `PhoneTopBar`; current-card task -> `learning-current-card`; in-card progress/address -> `learning-card-address-shelf` and `learning-card-location-strip`; selected option state -> `learning-option-*`; active submit -> `learning-submit-button`.
- Unimplemented gap: This still does not solve Learning result-detail, Space card-list/detail, Statistics, or Mine quality. Those need separate passes.

## Card make external workspace impact

- N/A.

## Risks and open questions

- This is a polish pass, not a full redesign. The remaining major visual debt is still in Learning result detail and the Space card-list/detail state.
