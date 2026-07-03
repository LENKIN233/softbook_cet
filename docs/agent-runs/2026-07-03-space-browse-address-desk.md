# Agent Run Record: Space browse address desk

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-4`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping Space card-list browse from a filter-like stack into a tighter address-desk object. The current box now owns the first-read address, the hierarchy selector is demoted into a lower-weight address layer, and the contained card no longer uses a long horizontal accent line that reads like a reference guide.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a physical hierarchy surface. It must keep library -> group -> box -> card visible and must not collapse into a flat list or settings panel.
- Space browse is subordinate to Learning. It should let the user inspect the current box, adjust supported card states, then return to Learning with the same address context.
- Favorite remains a tag attached to the card object, not a physical container.
- Sleep remains an in-box state that affects the learning flow, not deletion or arbitrary reassignment.
- This run does not change card ownership, membership access, auth, sync, Learning progression, or the allowed Space operation set.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` card-list mode now adds the compact `bookcase / group / box` display path inside the current box object, so the first read is the addressed box rather than a separate selector panel.
- The operative `space-browse-rail` remains available for hierarchy browsing but is visually demoted as an address layer labeled `地址层级 / 相邻对象`.
- The contained card keeps favorite, sleep, pager, overview, and return-to-Learning actions attached to the card object.
- The contained card accent changes from a full-width horizontal rail to a short left object marker to remove guide-line / reference-line drift.
- Existing selector and action IDs are preserved: `space-library-*`, `space-group-*`, `space-box-*`, `space-favorite-*`, `space-sleep-*`, `space-card-prev`, `space-card-next`, `space-card-list-back`, and `space-return-learning`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, Space model and shelf-desk design artifacts, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Space browse Maestro screenshot flow, and current real app screenshots.
- Generated/dependency/cache/archive read: current simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: reshapes Space card-list browse into an address-desk object; demotes the hierarchy selector; preserves stable selector IDs and action handlers; replaces the long contained-card accent line with a short object marker.
- `docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-03-space-browse-address-desk.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx` in `apps/mobile` -> passed, 7 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-space-browse-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused Space Jest: pass, 7 tests.
- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Full harness validation: pass.
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse keeps one dominant current-library accent for current box, selected address, contained card marker, and return action. Other address choices remain low-weight.
- Q2 Focal object: First-read path is Space route title -> current box object with address -> lower-weight hierarchy selector -> contained card object with attached operations -> floating chrome.
- Q3 Silhouette: The card-list state now reads as current box plus contained card in a physical hierarchy. It no longer reads as a guide-line card, separate filter rail, and detached card list.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the current box, hierarchy selector, card prompt, favorite/sleep actions, pager, return/overview dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space still preserves library -> group -> box -> card hierarchy, favorite and sleep operations, and Learning return continuity. The change does not alter Learning sequencing, flip self-assess, Statistics, Mine, auth, membership, purchase, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused Space/App tests, full mobile Jest, typecheck, lint, metadata scans, selector validation, backend tests, whitespace check, full harness validation, Space browse screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Space browse now presents the current box and contained card as a tighter one-screen object flow.
- The hierarchy selector remains operable but lower weight, so browsing does not dominate the page.
- The long contained-card accent line was removed to avoid reference-line drift.

## Design source and implementation mapping

- Design source: `docs/design/decisions/learning-space-direction-decision-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: current box object -> `space-current-box-tray`; address layer -> `space-address-shelf` / `space-browse-rail`; contained card -> `space-contained-card-strip`; favorite/sleep operations -> `space-favorite-*` / `space-sleep-*`; continuity -> `space-browse-card-continuity` and `space-return-learning`; screenshot evidence -> current real app Space browse screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-space-browse-address-desk-simulator.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing browse, favorite, sleep, pager, return, and overview handlers are reused.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md` Space mapping. No new spatial model was introduced.
- Unimplemented gap: Light-mode phone screenshot covers Space card-list browse. Dark mode, tablet containment, and alternate empty/gated/error Space browse screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Smaller phones and tablet layouts should be covered in follow-up quality passes.

## Follow-up

- Continue quality passes on Space overview, smaller-device containment, dark/tablet screenshots, and remaining current-real-app surfaces.
