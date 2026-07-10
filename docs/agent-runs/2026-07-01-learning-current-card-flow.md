# Agent Run Record: Learning current-card flow pass

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/learning-current-card-flow`
- Summary: Continued the user-visible app quality reset by tightening the Learning current-card task object. This pass removes the stretched empty space inside the one-screen card, keeps the 2x2 choices and submit action together, preserves the accepted Learning rhythm, and refreshes the real iOS simulator Learning screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow. The current task should read as one focused card, not as a scrolling content page or a generic exercise dashboard.
- The core rhythm is `place -> focus -> support -> resolve -> settle -> continue`.
- Four-choice interaction keeps the 2x2 silhouette and resolves through the primary submit action.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact, interaction/motion artifact, and implementation mapping before delivery.

## Implementation hypothesis changed

- The current-card container no longer fills the available vertical space by default; it now sizes to the task content and allows remaining space to stay outside the card object.
- The prompt, options, and submit action are visually grouped as one task flow. The primary action now sits directly under the 2x2 options instead of being pushed to the card bottom by empty internal space.
- The one-screen card keeps its address shelf, location strip, current prompt, 2x2 choice grid, and primary action test IDs unchanged.
- The current real app Learning screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, Learning rhythm design artifacts and mapping, `apps/mobile/src/learning/LearningSurface.tsx`, Learning/App tests, Maestro iOS Learning screenshot/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: tightens one-screen current-card layout and keeps the choice/submit cluster together; additional diff is Prettier-only ternary indentation.
- `docs/agent-runs/artifacts/2026-07-01-learning-current-card-flow-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/learning.png`: current real app Learning screenshot.
- `docs/agent-runs/2026-07-01-learning-current-card-flow.md`: this run record.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-learning-current-card-flow-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-learning-current-card-flow-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/learning.png docs/agent-runs/artifacts/2026-07-01-learning-current-card-flow-simulator.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused Learning/App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator, including Learning, Space, Statistics, and Mine paths.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-learning-current-card-flow-simulator.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`

## Design review checklist

- Q1 Law of One: Learning keeps the current library accent and neutral shell surfaces, with semantic mint/amber only for state. It does not introduce a competing palette or decorative color system.
- Q2 Focal object: The focal object is the current card task. First-read path is route title -> address shelf -> task prompt -> 2x2 choices -> primary submit action.
- Q3 Silhouette: Multiple choice keeps the accepted 2x2 silhouette and single-card sequence. The task no longer reads as a stretched page section with an empty internal cavity.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no horizontal overflow, no clipped choice labels, no CTA bottom collision, and no bottom chrome overlap.
- Q6 Learning-specific: This is Learning current-card only. It preserves system sequencing, single-card focus, no module picker, no statistics-first workflow, and unchanged flip two-state semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Learning screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning current-card now presents a tighter one-screen task object, with the choices and submit action kept in the same interaction cluster.
- Design source: `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, and `spec/visual-language.json`.
- Interaction/motion artifact: `docs/design/interaction-motion/learning-card-rhythm-v1.md`.
- Learning microcopy basis: no visible-copy change; this pass is a layout-only Learning task-flow correction.
- Implementation mapping: current card -> `learning-current-card`; address shelf -> `learning-card-address-shelf`; location strip -> `learning-card-location-strip`; 2x2 choices -> `learning-option-*`; submit CTA -> `learning-submit-button`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/learning.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the selected multiple-choice card state. Dark-mode Learning screenshot, tablet screenshot, unselected multiple-choice screenshot, and interaction-specific screenshots for flip, lock, elimination, and swipe remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the populated light-mode iPhone 17 Pro selected multiple-choice state. Long prompt text, unselected state, dark mode, tablet, and other interaction families remain separate coverage targets.

## Follow-up

- Continue real-app quality passes on Learning dark/tablet states, other Learning interaction families, and the next low-quality route screenshot.
