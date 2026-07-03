# Agent Run Record: Continuous app canvas

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-11`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by replacing the shell's hard rectangular background bands with one continuous app canvas. Refreshed the current real-app screenshot set so the design package no longer mixes old horizontally banded screenshots with the current implementation.

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
- The phone shell is app chrome supporting the current object; it must not look like a stacked web page or expose debug, harness, spec, runtime, seed, fixture, repo path, raw API, TODO, or agent metadata.
- Learning remains the primary single-card task. Statistics, Mine, and protected auth gates support that flow without becoming separate dashboard pages.
- Space remains a physical hierarchy surface. This run refreshes Space overview and browse screenshots because global chrome changed, but it does not alter library -> group -> box -> card semantics or allowed Space operations.
- This run does not change auth, membership entitlement, sync, card source ownership, candidate content, purchase access, Learning progression, or Space state transitions.

## Implementation hypothesis changed

- The previous `AuroraBackdrop` used two absolute rectangular color fields. In real app screenshots those rectangles created hard horizontal bands behind every route.
- The shell now uses one continuous `AppCanvasBackdrop` derived from the active palette background, removing the web-section effect while keeping material cards, rims, shadows, and floating chrome as the visual hierarchy.
- The current real-app screenshot package was refreshed across the existing light set and the existing dark main-route set so design evidence matches the current implementation.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core surface reset design decision/mock/mapping, current real app screenshots, `apps/mobile/App.tsx`, and existing Maestro screenshot/smoke flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces the two-rectangle `AuroraBackdrop` with continuous `AppCanvasBackdrop` and removes the unused `SHELL_DEPTH` token.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-auth-simulator.png`: light auth real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-auth-code-sent-simulator.png`: light auth code-sent real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-auth-space-simulator.png`: light protected Space gate real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-auth-statistics-simulator.png`: light protected Statistics gate real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-learning-simulator.png`: light Learning real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-detail-simulator.png`: light detail real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-space-simulator.png`: light Space overview real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-space-browse-simulator.png`: light Space browse real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-statistics-simulator.png`: light Statistics real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-mine-simulator.png`: light Mine real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-mine-code-sent-simulator.png`: light Mine code-sent real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-mine-signed-out-simulator.png`: light Mine signed-out real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-learning-dark-simulator.png`: dark Learning real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-statistics-dark-simulator.png`: dark Statistics real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-mine-dark-simulator.png`: dark Mine real simulator screenshot.
- `docs/agent-runs/artifacts/2026-07-03-continuous-canvas-space-dark-simulator.png`: dark Space real simulator screenshot.
- `docs/design/app-screenshots/current-real-app/*.png`: refreshed current light screenshot set.
- `docs/design/app-screenshots/current-real-app/dark/*.png`: refreshed existing dark main-route screenshot set.
- `docs/agent-runs/2026-07-03-continuous-app-canvas.md`: this run record.

## Commands run

- `npx prettier --write App.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- Light Maestro screenshot flows passed: `ios-auth-screenshot.yaml`, `ios-auth-code-sent-screenshot.yaml`, `ios-auth-space-gate-screenshot.yaml`, `ios-auth-statistics-gate-screenshot.yaml`, `ios-learning-home-screenshot.yaml`, `ios-learning-detail-screenshot.yaml`, `ios-space-overview-screenshot.yaml`, `ios-space-browse-screenshot.yaml`, `ios-statistics-screenshot.yaml`, `ios-mine-screenshot.yaml`, `ios-mine-code-sent-screenshot.yaml`, and `ios-mine-signed-out-screenshot.yaml`.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- Dark Maestro screenshot flows passed: `ios-learning-home-screenshot.yaml`, `ios-statistics-screenshot.yaml`, `ios-mine-screenshot.yaml`, and `ios-space-overview-screenshot.yaml`.
- `sips -g pixelWidth -g pixelHeight` over refreshed 16 current app screenshots -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_continuous_canvas_pr_body.md --changed-file <current continuous-canvas change set>` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_continuous_canvas_pr_body.md` -> passed.

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
- Light screenshot flows: pass for 12 current real-app states on iPhone 17 Pro simulator.
- Dark screenshot flows: pass for the 4 existing dark main-route states on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`
  - `docs/design/app-screenshots/current-real-app/space.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - `docs/design/app-screenshots/current-real-app/dark/space.png`

## Design review checklist

- Q1 Law of One: The continuous canvas is neutral and does not introduce a second dominant library color. Current library/action accents still drive Learning choices, Space hierarchy, Statistics action, and Mine primary action.
- Q2 Focal object: First-read path remains route header -> current object -> attached action/detail -> floating route shell. Removing hard background bands makes the object plane read as the app surface rather than as stacked page sections.
- Q3 Silhouette: The interaction silhouette remains one-screen app chrome with a floating four-route dock. Learning still reads as the current card, Detail as the resolved state, Space as a physical hierarchy, Statistics as daily progress, and Mine as account/member state.
- Q4 Forbidden patterns: No visible metadata, agent, harness, spec, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots in 16 states confirm route headers, core cards, primary actions, and floating tab bar fit within the phone viewport and safe-area without clipped text, overlap, horizontal overflow, bottom chrome collision, or hard horizontal background bands.
- Q6 Surface-specific: Learning keeps the current-card flow; Detail keeps the resolved-card slip; Statistics keeps the daily progress object and Learning return; Mine keeps account/member actions; Space keeps physical library -> group -> box -> card hierarchy and Learning return continuity. No new interaction family, motion model, or spatial operation was introduced.
- AP-22: The design review checklist six questions are answered here before PR delivery with real light/dark simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused App tests, full mobile Jest, typecheck, lint, metadata scans, selector validation, backend tests, whitespace check, full harness validation, and strict iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The app no longer shows route-spanning horizontal background bands behind the content card.
- The refreshed screenshots make the design package visually consistent: auth, gated routes, Learning, Detail, Space, Statistics, Mine, and dark main routes now all use the same continuous app canvas.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: page background/app chrome -> `apps/mobile/App.tsx` / `AppShell` / `AppCanvasBackdrop`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/` and `docs/design/app-screenshots/current-real-app/dark/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route taps, Learning actions, Statistics next-step, Mine action cards, and Space handlers are reused.
- Physical-space source: `docs/design/physical-space/space-state-baseline-v1.md` and `docs/design/mocks/space-surface-shelf-desk-v1.md` are referenced for Space screenshot interpretation only. No new Space model or operation was introduced.
- Unimplemented gap: This pass covers iPhone 17 Pro simulator light screenshots for all existing current-real-app states and dark screenshots for the existing dark main-route states. Small-phone, tablet, dynamic type stress, dark auth/detail/Space-browse screenshots, and error/empty/loading states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- This is a shared shell change; the refreshed screenshot set and iOS smoke cover the main shared blast radius.
- The previous two-rectangle atmosphere was removed because it rendered as hard web-section bands in native screenshots. A future native gradient implementation could reintroduce atmosphere only if it preserves continuity and passes real screenshot review.
- Follow-up should continue dark auth/detail/Space-browse coverage, smaller phones, tablet layout, dynamic type, and state-specific empty/error/loading views.
