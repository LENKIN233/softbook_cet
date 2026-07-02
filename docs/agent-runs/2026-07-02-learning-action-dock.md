# Agent Run Record: Learning action dock

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/learning-action-quality-pass`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by replacing the Learning auto-scored card's detached full-width submit CTA with an attached compact action dock. The dock ties the current selection state to the submit action, keeps the current card as the focal object, and refreshes the real iOS simulator Learning screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a guided single-card flow. The user should see one useful CET card, a clear operation, a meaningful result, and a quiet continuation.
- The primary action must be thumb-reachable and spatially tied to the current task. It should not look like a detached web form submit button.
- Secondary actions such as peek, hint, favorite, and Space continuity must stay quieter than the current operation.
- Auto-scored interactions resolve after the learner completes the interaction and submits. The submit affordance should explain the learner-facing state, not expose queue, cache, runtime, source, or payload terms.
- Flip self-assess remains exactly two choices: `有把握` and `再回看`. This run does not alter flip scoring, self-assess copy, or self-assess colors.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- Non-flip Learning cards now render `learning-submit-action-dock`: a compact attached bar with learner-facing state copy on the left and a fixed compact `learning-submit-button` on the right.
- Multiple choice shows whether a choice is selected, for example `已选 B`, before the learner submits.
- Lock, elimination, and swipe interactions use the same dock grammar with interaction-specific ready/not-ready copy.
- The old full-width `oneScreenPrimaryButton` submit treatment was removed for non-flip interactions.
- A focused LearningSurface test now protects the disabled/enabled dock states and guards against visible metadata copy.
- The current real app Learning screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile implementation mappings, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS screenshot/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: adds learner-facing submit dock copy and replaces the detached full-width submit CTA for non-flip interactions with a compact attached action dock.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: adds a multiple-choice dock regression test for disabled state, selected state, and metadata-free copy.
- `docs/agent-runs/artifacts/2026-07-02-learning-action-dock-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/learning.png`: current real app Learning screenshot.
- `docs/agent-runs/2026-07-02-learning-action-dock.md`: this run record.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 2 suites and 51 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-learning-action-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-learning-action-dock-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-learning-action-dock-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused Learning/App Jest: pass, 2 suites and 51 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-learning-action-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`

## Design review checklist

- Q1 Law of One: The current Learning card keeps one strong accent and one primary operation. The new action dock uses the current library accent only to support the current interaction, not to introduce a second action family.
- Q2 Focal object: The focal object is the current four-choice CET card. First-read path is route title -> current-card address -> prompt -> selected option -> attached action dock -> submit -> floating chrome.
- Q3 Silhouette: The change preserves the accepted single-card silhouette. The primary submit action is now attached to the interaction body instead of becoming a separate page-level CTA.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, queue, payload, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the prompt, option grid, selected-state label, submit dock, and floating navigation fit without horizontal overflow, text collision, clipped button text, or bottom chrome overlap.
- Q6 Surface-specific: This is Learning-only. It preserves Learning sequencing, all submit test IDs, auto-scored interaction behavior, result transitions, and the two-state flip self-assess model.
- AP-22: The six design review questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Learning screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Learning auto-scored card now reads more like an app interaction: the selected state and submit action live together, instead of separating the option grid from a generic full-width CTA.
- Design source: `spec/visual-language.json`, `docs/design/single-card-ux-contract.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and implementation mappings.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; this pass keeps the accepted `focus -> resolve` rhythm and adds no new motion implementation.
- Learning microcopy basis: design-backed product correction from detached CTA to attached learner-state dock; visible copy remains study-facing and avoids internal implementation terms.
- Implementation mapping: current card -> `learning-current-card`; selected option -> `learning-option-*`; attached action dock -> `learning-submit-action-dock`; submit action -> `learning-submit-button`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/learning.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the multiple-choice selected state and smoke-covers other non-flip submit states. Dark mode, tablet screenshot evidence, unselected screenshot evidence, and per-interaction screenshot variants remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the selected multiple-choice state on light-mode iPhone 17 Pro. Lock, elimination, and swipe share the same dock implementation and pass strict smoke, but they do not yet have individual screenshot captures.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, unselected Learning state, and interaction-specific screenshot coverage.
