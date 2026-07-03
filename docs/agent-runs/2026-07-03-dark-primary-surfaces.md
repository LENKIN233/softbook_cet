# Agent Run Record: Dark primary surfaces

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-10`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by fixing dark-mode active navigation and primary action surfaces. The bottom active tab, Statistics next-step action, and Mine primary action card now use explicit active/primary action palette semantics instead of reusing light-mode text/panel colors that produced white slabs in dark mode.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Softbook CET remains a CET4/6 preparation product built around a single-card Learning flow, high-value interactions, and a physical-space knowledge map.
- The route shell is app chrome, not content. It must support Learning, Space, Statistics, and Mine without exposing debug, harness, spec, runtime, seed, fixture, repo path, raw API, TODO, or agent metadata.
- Space remains a physical hierarchy surface. This run refreshes Space screenshot evidence because global chrome changed, but it does not alter library -> group -> box -> card semantics or allowed Space operations.
- Statistics remains a progress surface that sends the user back to Learning. Mine remains an account/member surface that lets the user continue Learning without creating a separate task system.
- This run does not change auth, membership entitlement, sync, card source ownership, candidate content, purchase access, Learning progression, or Space state transitions.

## Implementation hypothesis changed

- Palette now exposes `activeSurface` and `activeText` for selected app chrome instead of deriving active state from generic text/panel colors.
- Palette now exposes `primaryActionSurface`, `primaryActionText`, and `primaryActionMuted` for main action cards/buttons.
- Light mode keeps the accepted dark active/action surface treatment.
- Dark mode uses the dark accent family for selected navigation and primary actions, eliminating the previous near-white active tab and primary action slabs.
- `StatisticsSurface` consumes the primary action semantic colors for its non-review next-step button while preserving warning color for review.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core surface reset design decision/mock/mapping, current real app screenshots, `apps/mobile/App.tsx`, `apps/mobile/src/statistics/StatisticsSurface.tsx`, and existing Maestro screenshot/smoke flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds active and primary action semantic palette fields; applies them to the floating tab shell and Mine primary action card.
- `apps/mobile/src/statistics/StatisticsSurface.tsx`: applies primary action semantic colors to the non-review next-step action.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-learning-simulator.png`: dark Learning real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-statistics-simulator.png`: dark Statistics real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-mine-simulator.png`: dark Mine real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-space-simulator.png`: dark Space real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-learning-light-simulator.png`: light Learning real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-statistics-light-simulator.png`: light Statistics real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-mine-light-simulator.png`: light Mine real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-space-light-simulator.png`: light Space real simulator screenshot.
- `docs/design/app-screenshots/current-real-app/learning.png`: refreshed current light Learning screenshot.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current light Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current light Mine screenshot.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current light Space screenshot.
- `docs/design/app-screenshots/current-real-app/dark/learning.png`: refreshed current dark Learning screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current dark Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine.png`: refreshed current dark Mine screenshot.
- `docs/design/app-screenshots/current-real-app/dark/space.png`: refreshed current dark Space screenshot.
- `docs/agent-runs/2026-07-03-dark-primary-surfaces.md`: this run record.

## Commands run

- `npx prettier --write App.tsx src/statistics/StatisticsSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- Real dark screenshot capture/copy for Learning, Statistics, Mine, and Space -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-statistics-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-mine-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-space-overview-screenshot.yaml` in `apps/mobile` -> passed.
- Real light screenshot capture/copy for Learning, Statistics, Mine, and Space -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/learning.png docs/design/app-screenshots/current-real-app/statistics.png docs/design/app-screenshots/current-real-app/mine.png docs/design/app-screenshots/current-real-app/space.png docs/design/app-screenshots/current-real-app/dark/learning.png docs/design/app-screenshots/current-real-app/dark/statistics.png docs/design/app-screenshots/current-real-app/dark/mine.png docs/design/app-screenshots/current-real-app/dark/space.png` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_dark_primary_surfaces_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/src/statistics/StatisticsSurface.tsx --changed-file docs/agent-runs/2026-07-03-dark-primary-surfaces.md --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-learning-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-statistics-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-mine-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-space-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-learning-light-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-statistics-light-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-mine-light-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-dark-primary-surfaces-space-light-simulator.png --changed-file docs/design/app-screenshots/current-real-app/learning.png --changed-file docs/design/app-screenshots/current-real-app/statistics.png --changed-file docs/design/app-screenshots/current-real-app/mine.png --changed-file docs/design/app-screenshots/current-real-app/space.png --changed-file docs/design/app-screenshots/current-real-app/dark/learning.png --changed-file docs/design/app-screenshots/current-real-app/dark/statistics.png --changed-file docs/design/app-screenshots/current-real-app/dark/mine.png --changed-file docs/design/app-screenshots/current-real-app/dark/space.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_dark_primary_surfaces_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Light screenshot flows: pass for Learning, Statistics, Mine, and Space on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`
  - `docs/design/app-screenshots/current-real-app/space.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - `docs/design/app-screenshots/current-real-app/dark/space.png`

## Design review checklist

- Q1 Law of One: The route shell keeps one active surface at a time. Light mode uses the accepted dark active/action surface; dark mode uses one dark accent family for selected tabs and primary actions instead of mixing white panels into dark app chrome.
- Q2 Focal object: First-read path remains route header -> current surface object -> primary action -> floating route shell. Active chrome supports orientation without competing with the Learning card, Space box, Statistics daily object, or Mine account object.
- Q3 Silhouette: The interaction silhouette remains a one-screen app flow with a floating four-route dock. The fix only changes selected/action surfaces, preserving current layout density, card proportions, and route identities.
- Q4 Forbidden patterns: No visible metadata, agent, harness, spec, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots in light and dark confirm route headers, core cards, primary actions, and floating tab bar fit within the phone viewport and safe-area without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning keeps the current-card flow; Statistics keeps the daily progress object and Learning return; Mine keeps account/member actions; Space keeps physical library -> group -> box -> card hierarchy and Learning return continuity. No new interaction family, motion model, or spatial operation was introduced.
- AP-22: The design review checklist six questions are answered here before PR delivery with real light/dark simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused App tests, full mobile Jest, typecheck, lint, metadata scans, selector validation, backend tests, whitespace check, full harness validation, and strict iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Dark mode no longer renders selected route tabs and main action surfaces as near-white slabs.
- Light mode preserves the accepted dark active surface hierarchy for selected tabs and primary actions.
- The refreshed current-real-app screenshot set now includes real dark-mode app evidence for Learning, Statistics, Mine, and Space.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: active route shell -> `apps/mobile/App.tsx` / `PhoneShell`; Mine primary action card -> `apps/mobile/App.tsx` / `MineActionCard`; Statistics next-step action -> `apps/mobile/src/statistics/StatisticsSurface.tsx`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/` and `docs/design/app-screenshots/current-real-app/dark/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route taps, Learning actions, Statistics next-step, Mine action cards, and Space handlers are reused.
- Physical-space source: `docs/design/physical-space/space-state-baseline-v1.md` and `docs/design/mocks/space-surface-shelf-desk-v1.md` are referenced for Space screenshot interpretation only. No new Space model or operation was introduced.
- Unimplemented gap: This pass covers iPhone 17 Pro simulator light/dark screenshots for Learning, Statistics, Mine, and Space. Small-phone, tablet, dynamic type stress, auth dark screenshots, Space browse dark screenshot, and error/empty/loading states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The color change is centralized in palette semantics, reducing per-surface drift but touching shared chrome. The refreshed light/dark screenshots and iOS smoke cover this shared blast radius.
- Statistics warning/review action color is intentionally preserved. Only the non-review Learning return action moves to primary action semantics.
- Follow-up should continue screenshot coverage for dark auth, dark Space browse, smaller phones, and tablet layout.
