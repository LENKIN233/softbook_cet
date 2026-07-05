# Agent Run Record: Space browse unified tray

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-12`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by compressing Space browse from stacked card/detail panels into one unified box tray. The current contained card remains the first-read object, while the library/group/box selector is reduced to an attached location rail.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a top-level physical hierarchy, not a generic list, stats panel, or favorites manager.
- Users must be able to inspect library / group / box / card hierarchy and box contents.
- Cards remain contained objects under the selected box.
- Favorite is a tag on a card object, never a physical favorite box.
- Sleep is a physical state under the owning container and affects learning flow.
- Return to Learning must preserve the addressed card context.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` card-list mode now renders as a single outer `boxBrowseSurface` tray instead of two separate large panels.
- The current inspected card removes nested card border/shadow so the object reads as part of the tray rather than a card inside another card.
- The address selector keeps the existing library/group/box controls and testIDs but becomes a compact attached rail with lower visual weight.
- Existing behavior and selectors are preserved: `space-browse-rail`, `space-contained-card-strip`, `space-library-*`, `space-group-*`, `space-box-*`, `space-favorite-*`, `space-sleep-*`, and `space-return-learning`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Space design/mapping artifacts, `apps/mobile/src/space/SpaceSurface.tsx`, Space/App tests, Space browse Maestro flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: unifies Space browse into one tray, removes nested-card chrome from the inspected card, and compresses the address selector into an attached location rail.
- `docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-05-space-browse-unified-tray.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/space/SpaceSurface.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` -> passed, 54 tests; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-space-browse-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space-browse.png docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused Space/App Jest: pass, 54 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse uses the active Space library accent only. The current card object, return action, active address chips, and Space tab share one dominant accent without introducing a competing library hue.
- Q2 Focal object: First-read path is current contained card -> attached favorite/sleep/pager/return controls -> compact location rail -> floating chrome. The card and location controls now read as one tray instead of two page panels.
- Q3 Silhouette: Space remains a physical hierarchy surface, not a Learning interaction silhouette. The rendered shape keeps current card/card-box focus, contained card object, favorite tag, sleep pocket, location rail, and return continuity.
- Q4 Forbidden patterns: Refreshed screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the current card object, attached controls, compact location rail, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Space-only. It preserves visible hierarchy and does not alter Learning sequencing, flip self-assess, or Statistics tabular treatment.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App/Space tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Space browse screenshot flow, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Space browse now reads as one unified contained-card tray rather than two stacked panels.
- The hierarchy remains operable through existing library, group, and box chips.
- Favorite and sleep remain attached to the selected card object, and return to Learning remains primary.

## Design source and implementation mapping

- Design source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: current object / contained object -> `space-contained-card-strip` and `inspectCardTile`; address shelf -> `space-address-shelf` and `space-browse-rail`; favorite tag -> `space-favorite-*`; sleep pocket -> `space-sleep-*`; Learning continuity -> `space-return-learning`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-space-browse-unified-tray/space-browse-real-app.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing library/group/box selection, favorite, sleep, pager, and return handlers are reused.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Learning microcopy basis: N/A; this PR does not change Learning copy or card content.
- Unimplemented gap: This pass covers light-mode phone Space browse. Dark mode, tablet containment, richer Space inspect transition, and non-ideal Space browse states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The address selector remains chip-based for smoke coverage. A future Space interaction artifact should replace it with a more purpose-built shelf control.
- This pass improves the current light-mode browse frame. Dark mode and non-ideal states still need dedicated screenshot passes.

## Follow-up

- Continue quality passes on Mine, Space non-ideal states, dark mode, and richer Space inspect transition.
