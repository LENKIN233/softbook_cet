# Agent Run Record: Space browse attached actions

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by tightening Space card-list browse into one attached object flow. The box browse state no longer repeats the static path summary above the selector rail, and the return/overview actions now live inside the contained card object instead of a detached bottom action bar.

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

- Space is a physical hierarchy surface: library -> group -> box -> card must remain visible as a spatial browsing model, not become a flat card list.
- Space browse is still subordinate to Learning. It should help the user inspect and adjust the current card position, then return to Learning without reading like a separate dashboard page.
- The mobile app grammar is current object -> attached state/action -> floating chrome. In card-list browse, the current box and contained card are the objects; route continuity should attach to them.
- This run does not change card ownership, favorite state, sleep state, membership access, auth, sync, or Learning progression behavior.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` card-list state removes the repeated static `browseObjectPath` summary from the current-box tray.
- `space-browse-rail` remains the operative hierarchy selector and is wrapped by `space-address-shelf` for selector compatibility.
- Favorite and sleep controls now sit side-by-side in the contained card state deck so they read as one attached card operation area.
- `space-return-learning` and `space-card-list-back` move into the contained card object under `space-browse-card-continuity`, replacing the detached bottom continuity bar.
- Existing selector and action IDs are preserved: `space-library-*`, `space-group-*`, `space-box-*`, `space-favorite-*`, `space-sleep-*`, `space-card-prev`, `space-card-next`, and `space-return-learning`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Space browse Maestro screenshot flow, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: removes duplicated card-list path summary, keeps the hierarchy selector rail, compacts card actions, and attaches return/overview actions to the contained card object.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: asserts card-list browse keeps the continuity dock and overview action available inside the browse layer.
- `docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-03-space-browse-attached-actions.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 54 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, both 1206 x 2622.
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
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Full harness validation: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse keeps one dominant current-library accent for selector, current card, and return action. Other choices stay low-weight chips.
- Q2 Focal object: First-read path is Space route title -> current box object -> hierarchy selector -> contained card object with attached operations -> floating chrome.
- Q3 Silhouette: The card-list state now reads as current box plus contained card, not as duplicated path card, selector card, card detail card, and detached bottom action card.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the hierarchy rail, card prompt, favorite/sleep actions, pager, return/overview dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space still preserves library -> group -> box -> card hierarchy, favorite and sleep operations, and Learning return continuity. The change does not alter Learning sequencing, Statistics, Mine, auth, membership, purchase, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Space browse screenshot flow, strict iOS smoke, typecheck, lint, focused and full Jest, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Space browse now presents the current box and contained card as a tighter object flow.
- The repeated static path summary was removed from card-list mode; the operative hierarchy selector remains.
- Return to Learning and overview navigation now belong to the contained card object rather than a detached bottom row.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Space card-list object -> `apps/mobile/src/space/SpaceSurface.tsx`; hierarchy selector -> `space-browse-rail`; contained card -> `space-contained-card-strip`; attached continuity dock -> `space-browse-card-continuity`; screenshot evidence -> current real app Space browse screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-space-browse-attached-actions-simulator.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing browse, favorite, sleep, return, and overview handlers are reused.
- Physical-space source: `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.html`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` Space mapping. No new spatial model was introduced.
- Learning microcopy basis: no Learning UI copy changed. Space copy remains hierarchy and continuity copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone screenshot covers Space card-list browse. Dark mode, tablet containment, and alternate selected-library/empty-box screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Smaller phones and tablet layouts should be covered in follow-up quality passes.

## Follow-up

- Continue quality passes on Space overview, smaller-device containment, and dark/tablet screenshots.
