# Agent Run Record: Space browse control deck

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-2`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reducing border noise in the Space browse contained-card controls. The current box and card boundaries remain visible, while favorite/sleep controls, pager, and the secondary overview action no longer stack as multiple outlined cards.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`

## Product truth used

- Space is a top-level physical hierarchy, not a flat list, dashboard, or favorite/sleep two-box shortcut.
- The browse state must preserve library -> group -> box -> card ownership, contained cards, favorite as a tag, sleep as a physical zone, and return-to-Learning continuity.
- UI should keep the current box/card physical boundaries clear without turning secondary operations into competing framed objects.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` keeps the current box/card plane and left card-edge marker as the spatial boundary.
- The contained-card control deck now uses a subtle selected-library wash and transparent borders for inactive favorite/sleep controls, the pager container, and secondary overview action.
- The primary `回学习` action remains the only strong filled action in the contained-card deck.
- Space operations, selectors, state transitions, and copy remain unchanged.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted physical-space artifacts, current real app Space browse screenshot, `apps/mobile/src/space/SpaceSurface.tsx`, and Space Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: reduces inactive secondary control borders inside the Space browse contained-card deck.
- `docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-04-space-browse-control-deck.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-space-browse-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, both 1206 x 2622.
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
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_browse_control_deck_pr_body.md --changed-file apps/mobile/src/space/SpaceSurface.tsx --changed-file docs/agent-runs/2026-07-04-space-browse-control-deck.md --changed-file docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png --changed-file docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_browse_control_deck_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, refreshed Space browse screenshot is 1206 x 2622.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Mobile full Jest: pass, 26 suites and 163 tests.
- CloudBase API tests: pass, 11 tests.
- Maestro selector validation: pass.
- Full harness validation: pass.
- Whitespace check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-space-browse-control-deck-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse keeps one selected-library accent for the current box/card edge, active chips, and primary return action. Secondary controls are demoted to quiet surfaces.
- Q2 Focal object: The first-read path remains address shelf -> current box object -> switch-position rail -> contained card object -> attached favorite/sleep/pager controls -> return-to-Learning action -> bottom chrome.
- Q3 Silhouette: The screen preserves the physical hierarchy silhouette: parent shelf, current box focus, contained card object, favorite tag, sleep zone, and Learning continuity. It is not flattened into a card list or dashboard.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the browse rail, current card, controls, pager, primary return action, secondary overview action, safe area, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This is Space-only. It does not alter flip self-assess, Statistics numerals, or Learning's system-sequenced primary path.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- VL-AP-07: The visual output includes universal Q1-Q4 and conditional Q5-Q6 answers in this run record and PR body.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Space browse screenshot flow, strict iOS smoke, App/full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Space browse now presents the contained-card operations with less border noise, making the current card and primary return action easier to scan.
- Space hierarchy, favorite state, sleep state, browse selectors, return to Learning, auth, membership, sync, and card content behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/directions/space-surface-visual-directions-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Space contained card strip -> `apps/mobile/src/space/SpaceSurface.tsx` / `space-contained-card-strip`; favorite tag -> `space-favorite-*`; sleep zone action -> `space-sleep-*`; pager -> `space-card-prev` / `space-card-next`; return continuity -> `space-return-learning`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: N/A; no new Learning/core interaction family or motion implementation was added.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-shelf-desk-v1.md`.
- Card content handoff/validation: N/A; this run does not alter card payload import, dry-run, audit, runtime smoke, or coverage delta.
- Unimplemented design gaps: Light-mode iPhone 17 Pro Space browse is covered. Dark Space browse, small-phone containment, tablet containment, dynamic type, empty box, gated depth, loading, remote-error, and sync-merge Space states remain follow-up quality passes.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The patch is visual-only and leaves selectors and operations intact; strict smoke verified favorite/sleep actions and return-to-Learning still work.
- Dark mode and non-ideal Space states need separate screenshot passes because this run only covers the main light browse path.

## Follow-up

- Continue user-visible quality passes on remaining Space non-ideal states, dark/tablet containment, and one-screen cohesion gaps across Learning, Space, Statistics, and Mine.
