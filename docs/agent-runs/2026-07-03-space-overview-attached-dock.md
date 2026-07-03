# Agent Run Record: Space overview attached dock

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-next-20260703`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by attaching Space overview actions to the current box object. The overview state no longer presents the sleep alcove and return-to-learning actions as a detached bottom row; those controls now live inside the open-box deck under the contained card preview.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a physical hierarchy surface: library -> group -> box -> card must remain visible and operable as a spatial model.
- Space overview should serve Learning continuity. The current box is the focal object, and its sleep/return actions should attach to the box/card object rather than float as unrelated lower cards.
- The mobile app grammar is current object -> attached state/action -> floating chrome. Space overview should not read as a stack of independent command cards.
- This run does not change card ownership, favorite state, sleep state, membership access, auth, sync, or Learning progression behavior.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` overview keeps the existing current-box tray and open-box deck, but increases the deck height enough to host attached actions.
- `space-sleep-alcove` and `space-return-learning` are rendered inside `space-open-box-deck` under the card preview via `openBoxActionDock`.
- The previous detached `overviewBottomRow` visual structure is removed from the rendered overview state.
- Existing stable selectors and handlers remain in place: `space-open-box-lid`, `space-sleep-alcove`, `space-sleep-alcove-action`, and `space-return-learning`.
- `SpaceSurface` tests now assert that the sleep alcove and return action are descendants of `space-open-box-deck`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, Space physical/visual design artifacts, mobile core reset design artifacts and mapping, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Space overview Maestro screenshot flow, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: moves the overview sleep alcove and return-to-learning action into the open-box deck and adds attached dock styling.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: asserts the Space overview actions remain descendants of `space-open-box-deck`.
- `docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png`: real iPhone 17 Pro simulator Space overview screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current real app Space overview screenshot.
- `docs/agent-runs/2026-07-03-space-overview-attached-dock.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 54 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png docs/design/app-screenshots/current-real-app/space.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png docs/design/app-screenshots/current-real-app/space.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused Space/App Jest: pass, 54 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Space overview screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Full harness validation: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space.png`

## Design review checklist

- Q1 Law of One: Space overview keeps one dominant current-library accent for current box, deck edge, and return action. Other hierarchy labels remain low-weight.
- Q2 Focal object: First-read path is Space route title -> current box address -> open-box deck with contained cards and attached actions -> floating chrome.
- Q3 Silhouette: The overview now reads as one current-box object with an attached deck/action dock, not as a box preview plus separate lower action cards.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the address row, box title, open-box preview, sleep alcove, return action, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space still preserves library -> group -> box -> card hierarchy, sleep alcove access, and Learning return continuity. The change does not alter Learning sequencing, Statistics, Mine, auth, membership, purchase, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Space overview screenshot flow, strict iOS smoke, typecheck, lint, focused and full Jest, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Space overview now presents sleep and return actions as attached controls inside the current open-box object.
- The current real app Space screenshot now shows one more coherent current-box object rather than a detached bottom command row.
- Space behavior and stable interaction selectors are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Space overview current box -> `apps/mobile/src/space/SpaceSurface.tsx`; open-box object -> `space-open-box-deck`; attached sleep/return dock -> `openBoxActionDock`; screenshot evidence -> current real app Space screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-space-overview-attached-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/space.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing overview, sleep-alcove, and return handlers are reused.
- Physical-space source: `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.html`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` Space mapping. No new spatial model was introduced.
- Learning microcopy basis: no Learning UI copy changed. Space copy remains hierarchy and continuity copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone screenshot covers Space overview. Dark mode, tablet containment, empty-box, loading, and gated Space overview screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Smaller phones and tablet layouts should be covered in follow-up quality passes.

## Follow-up

- Continue quality passes on smaller-device containment, dark/tablet screenshots, and remaining auth/Mine edge states.
