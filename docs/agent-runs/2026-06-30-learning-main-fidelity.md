# Agent Run Record: Learning main-card fidelity pass

## Task summary

- Date: 2026-06-30
- Branch: `codex/learning-main-fidelity`
- PR: pending
- Summary: Continued frontend quality reshaping by moving the Learning surface away from a completed-session screenshot and toward the accepted one-screen current-card task. The current app screenshot now stops on a real Learning main-card state with an in-card address shelf, current box context, 2x2 option silhouette, and clean simulator capture.

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
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is the primary entry and remains a system-sequenced single-card flow.
- The first Learning screen should be the active current-card task, not a marketing page, module picker, statistics board, or completed-session summary.
- The core action surface stays bounded: primary interaction first, peek/hint/favorite secondary, no manual box management before learning.
- Multiple-choice must preserve a 2x2 option silhouette.
- User-visible UI must not expose metadata, harness, runtime, route, fixture, debug, repo, raw id, or TODO language.

## Implementation hypothesis changed

- The current Learning state no longer renders a separate header card above the current card.
- Current progress, current-box context, and the session chip are now attached inside the current paper-card object.
- The visible card label now reads as `当前卡` instead of a generic exercise label.
- The interaction area is visually embedded in the card object while preserving existing test IDs and interaction behavior.
- A dedicated Maestro flow now stops on the Learning main-card screenshot state and clears development overlays before screenshot capture.
- `docs/design/app-screenshots/current-real-app/learning.png` was replaced with a new real iOS simulator screenshot from the current app.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/learning/LearningSurface.tsx`, App/Learning tests, Maestro smoke flows, current real screenshot docs, and accepted Learning visual artifacts.
- Generated/dependency/cache/archive read: current simulator screenshots were inspected only as evidence context, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: moves Learning progress/address context into the current card and tightens the 2x2 option rhythm.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: locks the in-card address shelf and location strip.
- `apps/mobile/__tests__/App.test.tsx`: updates Learning surface assertions to the new current-card copy and structure.
- `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml`: adds a screenshot flow that lands on the real Learning main-card state and clears dev overlay chrome.
- `docs/design/app-screenshots/current-real-app/learning.png`: updated real iOS simulator Learning screenshot.
- `docs/agent-runs/artifacts/2026-06-30-learning-main-fidelity-simulator.png`: source simulator capture for the updated Learning screenshot.
- `docs/agent-runs/2026-06-30-learning-main-fidelity.md`: records this run.

## Commands run

- `npm test -- LearningSurface.test.tsx --runInBand` in `apps/mobile` -> pass, 1 suite and 2 tests.
- `npm test -- LearningSurface.test.tsx App.test.tsx --runInBand` in `apps/mobile` -> pass, 2 suites and 46 tests.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 158 tests.
- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `git diff --check` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-main-fidelity-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/learning.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-main-fidelity-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> pass, both 1206 x 2622.

## Validation results

- Focused Learning/App Jest: pass.
- Mobile full Jest: pass, 26 suites and 158 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Learning main-card Maestro screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real Learning screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 with no development overlay in the committed screenshot.

## Design review checklist

- Q1 Law of One: Learning uses the current library accent as the single strong accent for the current card, card progress, option selection border, and primary action. Mint/amber remain scoped to the flip self-assess state.
- Q2 Focal object: the current card is the first-read object; the path is session chip -> current box strip -> prompt -> 2x2 option silhouette -> submit.
- Q3 Silhouette: the captured Learning state now matches the current-card task silhouette rather than the previous completed-session summary; multiple-choice stays prompt plus 2x2 grid.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, gradient text, gamification chrome, full-width bottom tabbar, or removed self-assess token copy was introduced. A dev-overlay polluted capture was rejected and replaced.
- Q5 Layout containment: the screenshot flow asserts the current card, in-card address shelf, and active option state before capture; the committed simulator screenshot confirms containment at 1206 x 2622.
- Q6 Surface-specific: this is Learning-only. Space, Statistics, Mine, membership gates, and the two-state flip self-assess policy are unchanged.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after focused tests, full mobile tests, typecheck, lint, metadata scan, selector validation, harness validation, Learning screenshot flow, strict iOS smoke, and real simulator screenshot inspection.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning main-card state is closer to the accepted `leadership-screenshot-handoff-v2` and `learning-card-rhythm-v1` design baselines.
- Design source: `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/storyboards/learning-space-motion-prototype-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: current-card task -> `learning-current-card`; in-card address/progress -> `learning-card-address-shelf` and `learning-card-location-strip`; multiple-choice silhouette -> existing `learning-option-*` grid; primary submit -> existing `learning-submit-button`.
- Unimplemented gap: Learning result detail still needs a dedicated visual fidelity pass, and Space card-list/detail still need real app screenshots that match the leadership handoff set.

## Card make external workspace impact

- N/A.

## Risks and open questions

- The Learning screenshot now proves the main-card task, but it does not prove result-detail quality. The next frontend quality pass should target `learning-result-detail-screen` or the Space card-list/detail state.
