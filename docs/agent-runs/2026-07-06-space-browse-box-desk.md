# Agent Run Record: Space browse box desk

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-04`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by refactoring the Space box-inspect surface from a reversed tool-panel stack into a Box Desk reading order. The card-list state now reads as address shelf -> current box tray -> contained card object -> attached favorite/sleep dock -> pager -> Learning continuity strip.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a top-level physical hierarchy, not a generic card list, dashboard, or arbitrary organizer.
- Every card remains inside `library -> group -> box -> card`; favorite is a tag on the card object, and sleep is a physical state under the owning box.
- The user may browse and inspect boxes, apply favorite, move a card into/out of sleep, and return to Learning with context preserved.
- Space must not expose raw card ids, box refs, source metadata, agent/harness/spec/debug/runtime terms, or internal implementation language.

## Implementation hypothesis changed

- `screen="card_list"` now renders in Box Desk order instead of `column-reverse` tool-panel order.
- The selected card is a real contained object with a border/material surface, rather than a transparent text block.
- Favorite and sleep controls are attached as a quiet state dock inside the card object.
- The Learning continuity strip is anchored to the bottom of the card object, keeping the current card and current address connected.
- Existing selectors and behavior for library/group/box browsing, favorite, sleep, pager, return to Learning, and overview return are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted physical-space artifacts, mobile core reset mapping, current real app Space browse screenshot, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, and Space Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: refines Space card-list layout into Box Desk order, material card object, attached favorite/sleep dock, and bottom Learning continuity.
- `apps/mobile/__tests__/App.test.tsx`: updates one visible-copy assertion from the longer sleep-zone label to the shorter non-clipping label.
- `docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app.png`: real iPhone 17 Pro simulator light Space browse screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app-dark.png`: real iPhone 17 Pro simulator dark Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app light Space browse screenshot.
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`: added current real app dark Space browse screenshot.
- `docs/agent-runs/2026-07-06-space-browse-box-desk.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/space/SpaceSurface.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx` -> passed, 7 tests; pretest metadata leak scan passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/space/SpaceSurface.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx __tests__/App.test.tsx` -> passed, 54 tests; pretest metadata leak scan passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app-dark.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, light/dark artifact and current screenshot files are 1206 x 2622.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> first attempt hit transient GitHub branch-protection read failure; `gh auth status` and branch protection API read then passed; retry passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_browse_box_desk_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_browse_box_desk_pr_body.md --changed-file ...` -> passed.

## Validation results

- Focused Space Jest: pass, 7 tests.
- Focused App Jest: pass, 47 tests.
- Focused Space + App Jest: pass, 54 tests.
- Whitespace diff check: pass.
- Space browse light screenshot flow: pass on iPhone 17 Pro simulator.
- Space browse dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, evidence and current screenshots are 1206 x 2622.
- Full local gates: pass.
- PR design gate: pass.
- Agent review gate: pass.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: Space browse uses the current library accent as the single strong accent for object dots, active position, and Learning continuity. Favorite and sleep remain attached state controls, not competing color systems.
- Q2 Focal object: First-read path is route chrome -> box-inspect tray -> position shelf -> contained current card object -> attached favorite/sleep dock -> pager -> Learning continuity.
- Q3 Silhouette: Space browse now reads as hierarchy plus contained card object, not a flat list, dashboard, or tool panel.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm address shelf, card object, action dock, pager, Learning continuity, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space keeps library/group/box/card hierarchy visible, keeps favorite as tag, keeps sleep as a same-box state, and returns to Learning without creating module-first navigation.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Space browse visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Space browse now presents box inspection as one physical box/card object instead of a stacked utility panel.
- Favorite remains a card tag, sleep remains a same-box state, and Learning continuity remains attached to the object.
- Learning progression, review, statistics, auth, membership, purchase, sync, card content, and Space operation semantics are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/physical-space/space-model-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Space address shelf -> `space-address-shelf` and `space-browse-rail`; current box focus -> `space-current-box-tray`; contained card object -> `space-contained-card-strip` / `browseCardTile`; favorite tag -> `space-favorite-*`; sleep zone/state -> `space-sleep-*`; Learning continuity -> `space-return-learning`; overview return -> `space-card-list-back`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-box-desk/space-browse-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Space browsing, favorite, sleep, pager, return, and overview handlers are reused.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Learning microcopy basis: no visible-copy change in Learning. Space sleep-zone visible copy was shortened to avoid clipping while preserving the same-box sleep semantics.
- Unimplemented gap: Light and dark phone Space browse after trial unlock are covered. Tablet containment, remote-loaded Space browse, gated Space browse, sleeping-card active visual state, and empty-box browse remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by App tests and Maestro, reducing behavior risk.
- The card object is now taller to preserve a one-screen physical object; smaller phones and long prompt stress states should be covered in follow-up quality passes.

## Follow-up

- Continue visible-quality coverage with smaller phones, tablet containment, remote-loaded Space browse, gated Space browse, sleeping-card active visual state, and empty-box browse evidence in later passes.
