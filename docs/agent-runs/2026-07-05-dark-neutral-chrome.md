# Agent Run Record: Dark neutral chrome

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-15`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by replacing the dark-mode global purple-blue chrome with a neutral night material system and refreshing real dark-mode screenshots for Learning, Statistics, Mine, and Space.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- The mobile app should read as one focused object system, not a set of unrelated pages.
- Learning keeps the current card and current library accent as the primary focus.
- Statistics and Mine support the learning flow without becoming product centers.
- Space must preserve visible library / group / box / card hierarchy and may use the current library identity color as the spatial identity.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- Dark mode now uses neutral night materials for app chrome, shell accent, selected tab, and non-library primary actions.
- The previous dark global accent `#7C8BFF` is no longer used as the selected tab and primary action color across every surface.
- The selected tab and generic route actions now use a warm neutral material surface, so Learning's current library tone remains the only strong accent in Learning.
- Space can still show listening/library blue as the current physical-space identity; that color is now clearly a library identity, not the global chrome color.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, four main-route Maestro screenshot flows, iOS smoke flow, and current real dark app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: updates `DARK_PALETTE` neutral night chrome, selected tab, and non-library primary action colors.
- `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/learning-dark-real-app.png`: real iPhone 17 Pro simulator dark Learning screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/statistics-dark-real-app.png`: real iPhone 17 Pro simulator dark Statistics screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/mine-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/space-dark-real-app.png`: real iPhone 17 Pro simulator dark Space screenshot evidence.
- `docs/design/app-screenshots/current-real-app/dark/learning.png`: refreshed current real app dark Learning screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current real app dark Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine.png`: refreshed current real app dark Mine screenshot.
- `docs/design/app-screenshots/current-real-app/dark/space.png`: refreshed current real app dark Space screenshot.
- `docs/agent-runs/2026-07-05-dark-neutral-chrome.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testNamePattern="mine|statistics|keeps signed-out"` -> passed, 7 focused tests; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/learning-dark-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/statistics-dark-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/mine-dark-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/space-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/learning-dark-real-app.png docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/statistics-dark-real-app.png docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/mine-dark-real-app.png docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/space-dark-real-app.png docs/design/app-screenshots/current-real-app/dark/learning.png docs/design/app-screenshots/current-real-app/dark/statistics.png docs/design/app-screenshots/current-real-app/dark/mine.png docs/design/app-screenshots/current-real-app/dark/space.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under dark simulator appearance -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed after validation.

## Validation results

- Focused App Jest: pass, 7 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Dark Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Space screenshot flow: pass on iPhone 17 Pro simulator.
- Dark iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/learning-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/statistics-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/mine-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/space-dark-real-app.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`
  - `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - `docs/design/app-screenshots/current-real-app/dark/space.png`

## Design review checklist

- Q1 Law of One: Learning now leaves the current library/card tone as the only strong accent; dark selected tab and non-library primary actions are neutral material, not a second purple-blue accent. Space still uses listening/library blue as the current space identity, which is the intended current-library accent.
- Q2 Focal object: First-read path remains current card in Learning, daily object in Statistics, account object in Mine, current box/box desk in Space, then attached state and floating chrome.
- Q3 Silhouette: This pass does not change Learning, Statistics, Mine, or Space silhouettes. It only changes dark material tokens so the accepted mobile reset object grammar remains readable in dark mode.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro dark simulator screenshots confirm Learning, Statistics, Mine, and Space fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced, Statistics keeps tabular ledger values, Space preserves library / group / box / card hierarchy, and this pass does not alter flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real dark simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app dark screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real dark screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, four dark screenshot flows, and dark iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Dark mode no longer reads as a purple-blue theme across every surface.
- Selected tabs and generic route primary actions now use neutral night material, reducing conflict with current library identity colors.
- Current app screenshot evidence for dark Learning, Statistics, Mine, and Space has been refreshed from real app output.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: dark chrome tokens -> `apps/mobile/App.tsx` `DARK_PALETTE`; selected route chrome -> `PhoneShell` / `route-tab-*`; current dark screenshot evidence -> `docs/design/app-screenshots/current-real-app/dark/*.png`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-dark-neutral-chrome/*-dark-real-app.png` -> `docs/design/app-screenshots/current-real-app/dark/*.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: N/A; Space layout and operation model are unchanged.
- Learning microcopy basis: N/A; this PR does not change Learning UI copy or card content.
- Unimplemented gap: This pass covers dark main-route Learning, Statistics, Mine, and Space on iPhone 17 Pro. Dark auth, dark detail, dark Space browse, tablet, small-phone, dynamic type, remote-auth error, loading, empty, and recovery states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- `DARK_PALETTE` is shared app chrome. Dark screenshot flows and dark iOS smoke passed, but future dark auth/detail/Space browse passes should confirm all secondary surfaces inherit the neutral chrome correctly.
- Space still uses blue on the current library surface. That is intentional current-library identity, but future Space passes should verify non-listening libraries make the identity-color binding equally clear.

## Follow-up

- Continue quality passes on dark auth/detail/Space browse, tablet containment, small-phone containment, and error/loading/recovery states.
