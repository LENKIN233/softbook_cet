# Agent Run Record: Space browse position switcher

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-9`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by replacing the Space browse rail's weak reference-copy with a clearer position switcher. The box browse state now says `切换位置 / 盒内 N 张`, and anonymous neighboring shelf/group/box labels are unique instead of repeating `相邻书架`.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a physical hierarchy surface. It must preserve library -> group -> box -> card visibility and cannot collapse into a flat card list or generic settings panel.
- Space browse remains subordinate to Learning. It should let the user inspect the current box, adjust supported card states, and return to Learning with the same address context.
- Favorite remains a tag attached to the card object, not a physical container.
- Sleep remains an in-box state that affects the Learning flow, not deletion or arbitrary reassignment.
- User-facing UI must not expose raw library/group/box identifiers, source metadata, agent, harness, spec, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- This run does not change card ownership, membership access, auth, sync, Learning progression, or the allowed Space operation set.

## Implementation hypothesis changed

- Anonymous neighboring Space labels now carry stable visible ordinal suffixes: `相邻书架一`, `相邻书架二`, `相邻分区一`, and `相邻卡盒一`.
- The Space card-list browse rail header changes from `地址层级 / 相邻对象` to `切换位置 / 盒内 N 张`, which describes the actual operation and current box content.
- The same `space-library-*`, `space-group-*`, and `space-box-*` selectors and on-press behavior are preserved.
- `SpaceSurface` tests now assert the new operation copy and explicitly prevent the old `相邻对象` copy from returning.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, Space state baseline, Space shelf-desk design artifact, mobile core reset decision, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/spaceMetadataDisplay.test.ts`, Space browse Maestro screenshot flow, and current real app Space browse screenshot.
- Generated/dependency/cache/archive read: simulator screenshot was inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`: adds unique anonymous neighbor labels for Space library/group/box display labels.
- `apps/mobile/src/space/SpaceSurface.tsx`: changes the card-list browse rail heading and hint to operation-and-content copy.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: asserts the new position switcher copy and blocks the old weak copy.
- `apps/mobile/__tests__/spaceMetadataDisplay.test.ts`: updates anonymous Space label expectations.
- `docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-03-space-browse-position-switcher.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx src/shared/uiMetadata/displayMetadata.ts __tests__/SpaceSurface.test.tsx __tests__/spaceMetadataDisplay.test.ts` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx spaceMetadataDisplay.test.ts` in `apps/mobile` -> passed, 11 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-space-browse-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_browse_position_switcher_pr_body.md --changed-file apps/mobile/src/shared/uiMetadata/displayMetadata.ts --changed-file apps/mobile/src/space/SpaceSurface.tsx --changed-file apps/mobile/__tests__/SpaceSurface.test.tsx --changed-file apps/mobile/__tests__/spaceMetadataDisplay.test.ts --changed-file docs/agent-runs/2026-07-03-space-browse-position-switcher.md --changed-file docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png --changed-file docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_browse_position_switcher_pr_body.md` -> passed.

## Validation results

- Focused Space/display Jest: pass, 11 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse keeps one current-library accent for current box, selected position chips, contained card marker, and return action. Neighbor labels are anonymous but unique, so they do not create a second visual identity.
- Q2 Focal object: First-read path remains Space route title -> current box object -> position switcher -> contained card object with attached operations -> floating chrome.
- Q3 Silhouette: The card-list state still reads as current box plus contained card in a physical hierarchy. The middle rail now reads as an operation dock rather than a reference guide.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or raw library/group/box identifier appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the current box, position switcher, unique neighboring labels, card prompt, favorite/sleep actions, pager, return/overview dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space still preserves library -> group -> box -> card hierarchy, favorite and sleep operations, and Learning return continuity. The change does not alter Learning sequencing, flip self-assess, Statistics, Mine, auth, membership, purchase, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused Space/display tests, full mobile Jest, typecheck, lint, metadata scans, selector validation, backend tests, whitespace check, full harness validation, Space browse screenshot flow, and strict iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Space browse no longer shows the weak `地址层级 / 相邻对象` reference label.
- Neighboring anonymous shelf/group/box labels are now unique and readable in the real app, reducing the duplicated-reference feel in the position switcher.
- Space ownership and allowed operations are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: anonymous Space labels -> `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`; position switcher rail -> `apps/mobile/src/space/SpaceSurface.tsx` / `space-browse-rail`; library/group/box chips -> `space-library-*`, `space-group-*`, and `space-box-*`; screenshot evidence -> current real app Space browse screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-space-browse-position-switcher-simulator.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing browse, favorite, sleep, pager, return, and overview handlers are reused.
- Physical-space source: `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` Space mapping. No new spatial model was introduced.
- Unimplemented gap: Light-mode phone screenshot covers Space card-list browse after the position-switcher copy change. Dark mode, tablet containment, small-phone containment, empty/gated/error Space browse states, and motion proof remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- More than ten neighboring anonymous containers fall back to a generic suffix; current dev content does not reach that limit. A future content-import pass can define a richer ordinal system if needed.
- Smaller phones, tablet layouts, and dark mode still need dedicated screenshot evidence.

## Follow-up

- Continue quality passes on small-phone/tablet containment, dark mode, and Space empty/gated/error state screenshots.
