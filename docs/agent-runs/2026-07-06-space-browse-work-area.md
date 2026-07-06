# Agent Run Record: Space browse work area

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-37`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by rebuilding the Space browse card-list layer into a one-screen contained-card work area. The current box tray remains the physical address anchor, while the inspected card now fills the available object space with attached favorite, sleep, pager, and return controls.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a top-level physical hierarchy, not a generic page stack, dashboard, or flat card list.
- Users must understand the current `library -> group -> box -> card` ownership relationship.
- Cards are contained physical objects under the current box.
- Favorite remains a tag on the card object.
- Sleep remains a physical zone under the owning container and affects the learning flow.
- Returning to Learning must preserve the addressed card context.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- `SpaceSurface` no longer leaves the card-list layer as a short control panel with unused blank space underneath.
- The current box browse surface, contained card strip, and browsed card object now expand to fill the one-screen Space work area.
- Card question content is centered inside a new browsed card face, while the favorite/sleep tray, pager, and return actions remain attached to the same card object.
- The pager is pinned to the lower part of the card object instead of competing with the prompt area.
- Existing Space browse behavior, selectors, favorite/sleep state changes, Learning continuity, and route navigation are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Space physical-space artifacts, mobile reset decision/mapping, `apps/mobile/src/space/SpaceSurface.tsx`, Space/App tests, Space browse screenshot flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: expands Space browse into a full contained-card work area and centers card content in a card face.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: locks the expanded card strip/object, centered card face, and lower pinned pager behavior.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app light Space browse screenshot.
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`: refreshed current real app dark Space browse screenshot.
- `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app.png`: archived real iPhone 17 Pro simulator light Space browse evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app-dark.png`: archived real iPhone 17 Pro simulator dark Space browse evidence.
- `docs/agent-runs/2026-07-06-space-browse-work-area.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx --testNamePattern="uses a compact address clue instead of selector controls in the card list layer"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can browse the current Space box after login|can move a card into sleep zone and remove it from learning flow|can favorite a card from space and reflect it in learning flow"` -> passed; pretest visible metadata leak scan passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `npm --prefix apps/mobile run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/space-browse.png` -> passed.
- `cp docs/design/app-screenshots/current-real-app/space-browse.png docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app.png` -> passed.
- `cp docs/design/app-screenshots/current-real-app/dark/space-browse.png docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app-dark.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space-browse.png docs/design/app-screenshots/current-real-app/dark/space-browse.png` -> passed, both 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook-cet-pr-body-space-browse-work-area.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook-cet-pr-body-space-browse-work-area.md --changed-file ...` -> passed.

## Validation results

- Focused Space browse Jest: pass.
- Focused App Space continuity Jest: pass.
- Whitespace diff check: pass.
- Space browse light screenshot flow: pass on iPhone 17 Pro simulator.
- Space browse dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, current light/dark Space browse screenshots are 1206 x 2622.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Maestro selector validation: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Agent review gate: pass.
- PR design gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app-dark.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/design/app-screenshots/current-real-app/dark/space-browse.png`

## Design review checklist

- Q1 Law of One: Space browse keeps one current library accent as identity on the current-object marker and current learning-card label. The card object, attached trays, pager, return action, and page chrome use neutral app materials.
- Q2 Focal object: First-read path is route title -> current box tray -> contained card object -> centered card prompt -> attached favorite/sleep tray -> pager and return controls.
- Q3 Silhouette: Space browse remains a physical hierarchy surface. The rendered shape preserves the current `library -> group -> box -> card` address, a contained card object, favorite tag, sleep zone, and Learning continuity.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark simulator screenshots confirm the header, box tray, contained card object, action tray, pager, return dock, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Space-specific. It preserves the physical hierarchy, favorite tag, sleep zone, and Learning return path; Learning flip self-assess and Statistics ledger behavior are not changed.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused tests, full mobile gates, CloudBase tests, harness validation, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The Space card-list layer no longer feels like a form-like partial panel with a large unused lower region.
- The screen now presents a single contained card work area inside the current box, closer to the product's one-screen app grammar.
- Existing favorite, sleep, pager, return to Learning, membership, auth, sync, and route behaviors are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-shelf-desk-v1.md`.
- Implementation mapping: current box tray -> `space-browse-address-clue`; contained-card work area -> `space-contained-card-strip`; browsed card object -> `space-browse-card-object`; centered card face -> `space-browse-card-face`; favorite and sleep attachment -> `space-favorite-*`, `space-sleep-*`, and `space-browse-card-state-tray`; pager -> `space-browse-card-pager`; Learning continuity -> `space-return-learning`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-browse-work-area/space-browse-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Space browse, favorite, sleep, pager, and return handlers are reused.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Learning microcopy basis: N/A; this PR does not change Learning UI or card content.
- Unimplemented gap: This pass covers the phone Space browse card-list layer in light and dark mode. Space overview, auth gates, loading/empty/error states, tablet, small-phone, dynamic type, richer inspect transition, and alternate library identity colors remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The layout intentionally gives the inspected card object the available vertical space instead of adding a secondary sibling-card shelf. A future accepted interaction artifact can add that if product design wants multi-card preview inside the same box.
- Smaller phones and dynamic type still need separate visual containment passes.

## Follow-up

- Continue visible-quality coverage on Space non-ideal states, Learning detail/auth dark screenshots, tablet/small-phone containment, and richer Space inspect transitions.
