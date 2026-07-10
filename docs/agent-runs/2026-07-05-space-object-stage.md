# Agent Run Record: Space object stage

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-2`
- PR: https://github.com/LENKIN233/softbook_cet/pull/338
- Summary: Continued the mobile quality reset by reshaping Space overview and box browsing away from reference-line/page chrome. Space overview now presents the current box as a one-screen object stage with a compact address, a contained card deck, a low-weight sleep state, and one primary return-to-learning action. Space browse removes visible vertical reference markers and lowers the "position rail" language to app-facing "位置".

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space must preserve library / group / box / card hierarchy as a physical-space surface, not a flat list.
- Learning remains primary; Space supports the current card location and must provide a clear return path to the same learning object.
- Space is not a report page. It should expose location and operations as app controls, not reference rails, implementation labels, or page sections.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` overview no longer renders the left side-shelf/reference spine. The current-box stage uses full-width object cards and low-weight address dots.
- The overview surface and address shelf lose heavy borders so the screen reads as a single app object rather than nested cards.
- The sleep state becomes a quiet attached row instead of a dashed sub-panel.
- The return-to-learning control becomes the dominant solid CTA: `回学习 / 同一张卡，同一地址`.
- Space browse replaces vertical markers with compact dots, removes the "位置轨" visible label, and removes divider lines that made it read like a report.
- Existing stable selectors are preserved: `space-address-shelf`, `space-open-box-lid`, `space-sleep-alcove`, `space-return-learning`, `space-open-card-list`, `space-browse-rail`, `space-contained-card-strip`, `space-favorite-1`, and `space-sleep-1`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current real app Space screenshots, `apps/mobile/src/space/SpaceSurface.tsx`, and Space Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: removes overview reference spines, lowers nested borders, turns return-to-learning into the primary CTA, and removes browse reference markers/dividers.
- `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png`: real iPhone 17 Pro simulator Space overview screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png`: real iPhone 17 Pro simulator Space browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current real app Space overview screenshot.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space browse screenshot.
- `docs/agent-runs/2026-07-05-space-object-stage.md`: this run record.

## Commands run

- `git switch -c codex/fix/mobile-quality-followup-20260705-2 origin/main` -> passed after PR #337 merge cleanup.
- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/space/SpaceSurface.tsx` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile start -- --port 8081` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png docs/design/app-screenshots/current-real-app/space.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png docs/design/app-screenshots/current-real-app/space.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, all 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> initially failed on the old expected visible label `位置轨`; updated the Space test to the intentional app-facing label `位置`; rerun passed, 26 suites and 163 tests.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full Maestro selector validation: pass.
- Whitespace diff check: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Space overview selector validation: pass.
- Space browse selector validation: pass.
- Space overview screenshot flow: pass on iPhone 17 Pro simulator.
- Space browse screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png`
  - `docs/design/app-screenshots/current-real-app/space.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`
- PR design gate and agent review gate are pending for PR delivery.

## Design review checklist

- Q1 Law of One: Space uses the current library accent as the single strong color. Other hierarchy markers are low-weight dots/chips only.
- Q2 Focal object: First-read path is route title -> current box address -> current-box stage or box card object -> return-to-learning action -> floating chrome.
- Q3 Silhouette: Space remains library / group / box / card hierarchy, but overview is now an object stage instead of a reference-rail page. Browse remains a contained box-card inspection state.
- Q4 Forbidden patterns: The refreshed real screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, or report-first chrome.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm Space overview and browse fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Space preserves physical hierarchy and Learning continuity. This run does not change Learning sequencing, flip self-assess, Statistics tabular behavior, auth, purchase, membership entitlement, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed local code inspection, real screenshot inspection, typecheck, lint, metadata scans, selector validation, full mobile Jest, CloudBase function tests, harness validation, Space screenshot flows, and iOS smoke. PR-body gates pending.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Space overview and Space browse now remove visible reference-line affordances and better match the accepted one-screen object grammar.
- Card list navigation, favorite, sleep, return-to-learning behavior, trial gate flow, and stable selectors are preserved.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: address shelf -> `space-address-shelf`; current box stage -> `space-current-box-tray` / `space-open-box-lid`; contained cards -> `space-contained-card-strip`; sleep state -> `space-sleep-alcove`; return continuity -> `space-return-learning`; browse controls -> `space-browse-rail`, `space-favorite-*`, and `space-sleep-*`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-real-app.png` -> `docs/design/app-screenshots/current-real-app/space.png`; `docs/agent-runs/artifacts/2026-07-05-space-object-stage/space-browse-real-app.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Interaction/motion source: no new interaction family or motion implementation was added.
- Physical-space source: Space implementation follows the accepted mobile core reset mapping and preserves library / group / box / card hierarchy.
- Unimplemented gap: dark Space, tablet containment, gated Space, and empty/loading Space remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and handlers are preserved.
- Browse still has a dense inspection state; a later pass should consider making favorite/sleep operations more direct and less administrative.

## Follow-up

- Run full local gates, create/update PR, wait for required remote checks, merge if gates pass, and fast-forward `/Users/lenkin/programing/softbook_cet_design_quarantine`.
