# Agent Run Record: Space overview neutral return

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260705-16`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by removing excessive library-accent color from Space overview and Space browse. Space now reads as a neutral physical object surface with the active library color reserved for current-object markers and identity, while real app screenshot evidence was refreshed for Space and stale auth gates.

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

- Space is a top-level physical hierarchy, not a flat card list, dashboard, favorite box, or sleep box.
- Users must understand the current `library -> group -> box -> card` ownership relationship.
- Cards remain contained objects under the current box.
- Favorite remains a tag on a card object.
- Sleep remains a physical zone under the owning container and affects the learning flow.
- Return to Learning must preserve the addressed card context.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- `SpaceSurface` now reuses the shared app primary-action tokens for Space return actions instead of painting them with the active library accent.
- Space overview neutralizes address rails, object containers, sleep alcove, counts, and helper labels so the current library color is no longer a full-page theme.
- Space browse neutralizes the outer tray, active selector chips, status badge, card secondary actions, and return CTA while keeping current-object markers and current-card labels visible.
- The active library color is still present as a small identity marker for the current physical object, not as the global app chrome.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Space physical-space artifacts, mobile reset decision/mapping, `apps/mobile/src/space/SpaceSurface.tsx`, Space/App tests, Space/auth screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: replaces broad library-accent Space chrome with neutral object surfaces and shared primary-action tokens for Space overview and browse.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app.png`: real iPhone 17 Pro simulator light Space overview evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app.png`: real iPhone 17 Pro simulator light Space browse evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app-dark.png`: real iPhone 17 Pro simulator dark Space overview evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app-dark.png`: real iPhone 17 Pro simulator dark Space browse evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-space-real-app.png`: refreshed real signed-out Space auth gate evidence.
- `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-statistics-real-app.png`: refreshed real signed-out Statistics auth gate evidence.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current real app Space overview screenshot.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics auth gate screenshot.
- `docs/agent-runs/2026-07-06-space-overview-neutral-return.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/space/SpaceSurface.tsx` -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed; 26 suites and 163 tests, with expected mocked sync warning logs.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed; 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app-dark.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app-dark.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-space-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-statistics-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` for six artifact screenshots and four current-real-app screenshots -> passed, all 1206 x 2622.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.

## Validation results

- Focused Space Jest: pass, 7 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Light Space overview screenshot flow: pass on iPhone 17 Pro simulator.
- Light Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Space overview screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- Space auth gate screenshot flow: pass on iPhone 17 Pro simulator.
- Statistics auth gate screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/space-browse-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-space-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/auth-statistics-real-app.png`
  - `docs/design/app-screenshots/current-real-app/space.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
  - `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/design/app-screenshots/current-real-app/auth-statistics.png`

## Design review checklist

- Q1 Law of One: Space uses one active library accent only as identity on the current object marker/current card state. The broad page chrome, return CTAs, active chips, count labels, and auxiliary surfaces now use neutral app materials.
- Q2 Focal object: Space overview first-read path is address shelf -> current box desk -> contained cards -> sleep alcove -> neutral return action. Space browse first-read path is current contained card -> attached favorite/sleep/pager/return controls -> compact location rail.
- Q3 Silhouette: Space remains a physical hierarchy surface. The rendered shape preserves library / group / box / card ownership, current box/card focus, contained card objects, favorite tag, sleep pocket, and Learning continuity.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark simulator screenshots confirm Space overview, Space browse, Space auth gate, and Statistics auth gate fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Space/auth-screenshot evidence only. It preserves Learning system sequencing, does not change flip self-assess, and does not change Statistics ledger behavior.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused and full mobile tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, six screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Space overview no longer reads as a full blue theme page; it reads as a neutral physical box desk with a small current-library identity signal.
- Space browse no longer reverts to a blue prototype style; it now shares the same neutral main action and object-marker grammar as overview.
- Stale auth gate screenshots for Space and Statistics have been refreshed from real app output.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-shelf-desk-v1.md`.
- Implementation mapping: address shelf -> `space-address-shelf`; current box tray -> `space-current-box-tray`; contained objects -> `space-open-box-deck` and `space-contained-card-strip`; favorite tag -> `space-favorite-*`; sleep pocket -> `space-sleep-*` and `space-sleep-alcove`; Learning continuity -> `space-return-learning`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-space-overview-neutral-return/*-real-app*.png` -> refreshed files in `docs/design/app-screenshots/current-real-app/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Space overview, browse, favorite, sleep, pager, auth gate, and return handlers are reused.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Learning microcopy basis: N/A; this PR does not change Learning copy or card content.
- Unimplemented gap: This pass covers phone Space overview/browse in light and dark plus refreshed light auth gates. Tablet, small-phone, dynamic type, Space loading/empty/error/gated-after-login states, richer Space inspect motion, and non-listening library color screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Space browse still intentionally concentrates on the current inspected card rather than adding filler content to use every vertical pixel. Future product design can add a purpose-built sibling-card shelf if an accepted interaction artifact defines it.
- The neutral return action is shared app chrome. Future non-listening screenshots should verify that orange/mint/purple/cyan/red/amber library identity markers all remain legible against the neutral surface.

## Follow-up

- Continue quality passes on Space non-ideal states, Learning detail/auth dark screenshots, tablet/small-phone containment, and richer Space inspect transition.
