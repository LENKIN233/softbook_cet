# Agent Run Record: Statistics progress rail

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-11`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by reshaping Statistics from a quiet ledger list into a stronger one-screen daily progress object. The surface now has a `今日节奏` progress rail, compact counts, and a connected next-step/check-in dock while preserving smoke selectors and real app screenshot evidence.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Product truth used

- Statistics is part of the top-level Learning / Space / Statistics / Mine IA.
- Statistics should reinforce continuity and confidence after real learning progress; it must not become a complex dashboard, mode picker, or generic analytics page.
- The main app should remain a one-screen, high-value action flow. Extra information should be organized into attached objects rather than long scrolling sections.
- User-visible UI and screenshots must not expose agent, harness, spec, runtime, endpoint, payload, repo path, TODO, or other internal language.

## Implementation hypothesis changed

- A daily statistics surface should first read as a progress object, not as four independent counters.
- `今日节奏` plus a filled rail makes the day's state legible at a glance while keeping the existing compact metrics for scanability.
- The existing next-step and check-in dock should remain the action center, but the progress rail should own the first-read hierarchy.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `StatisticsSurface`, App tests, current real app statistics screenshots, and Maestro smoke/statistics flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: adds the `statistics-progress-dock` daily progress rail, compact progress ratio, rail fill, and smaller metric nodes inside the daily object.
- `apps/mobile/__tests__/App.test.tsx`: asserts the progress rail copy, ratio, fill state, and checked-in copy while preserving old metric and check-in behavior.
- `apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml`: asserts the new progress dock before capturing Statistics screenshots.
- `apps/mobile/e2e/maestro/ios-smoke.yaml`: asserts the new progress dock in the local iOS smoke flow.
- `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: asserts the new progress dock in the remote iOS smoke flow.
- `docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-light-real-app.png`: real iPhone 17 Pro simulator light Statistics screenshot.
- `docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-dark-real-app.png`: real iPhone 17 Pro simulator dark Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app light Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current real app dark Statistics screenshot.
- `docs/agent-runs/2026-07-06-statistics-progress-rail.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/src/statistics/StatisticsSurface.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testNamePattern="statistics|metadata leakage"` -> passed, focused App tests; visible metadata leak pretest passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-light-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-dark-real-app.png` -> passed.
- Visual inspection of light and dark Statistics screenshots -> passed; progress object is readable, no keyboard residue, clipped label, tabbar collision, horizontal overflow, or internal metadata text found.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/*.png docs/design/app-screenshots/current-real-app/statistics.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed after restoring the Maestro files to scoped diffs.

## Validation results

- Focused App Jest: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Statistics screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/statistics-progress-rail-dark-real-app.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/design/app-screenshots/current-real-app/dark/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics keeps one quiet progress object. It does not introduce a second dashboard, competing hero, or marketing panel.
- Q2 Focal object: The daily progress rail is the first-read object; compact counts, next step, and check-in attach to it.
- Q3 Silhouette: The surface remains a single daily ledger object in the mobile shell, with a horizontal rail plus attached action dock. It does not become a long scroll or table.
- Q4 Forbidden patterns: The refreshed screenshots show no visible agent, harness, debug, runtime, repo, endpoint, payload, raw exception, fixture, TODO, or internal metadata language.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm no overflow, keyboard residue, clipped CTA, tabbar collision, or text overlap.
- Q6 Surface-specific: Statistics remains lightweight and confidence-oriented; it does not become a complex analytics dashboard or interrupt Learning/Space. Learning self-assess and Space hierarchy are unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, screenshot flows, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Statistics now presents the day as a unified progress rail rather than a row of disconnected counters.
- The surface still fits in one screen and preserves the existing check-in and next-step actions.
- Light and dark current-real-app screenshot evidence has been refreshed.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: daily object -> `StatisticsSurface`; progress rail -> `statistics-progress-dock`, `statistics-progress-rail`, `statistics-progress-fill`, and `statistics-progress-ratio`; compact metric nodes -> existing `statistics-metric-*`; current screenshot evidence -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-statistics-progress-rail/*-real-app.png` -> `docs/design/app-screenshots/current-real-app/statistics.png` and `docs/design/app-screenshots/current-real-app/dark/statistics.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: N/A; Space layout and operation model are unchanged.
- Learning microcopy basis: N/A; this PR does not change Learning card content.
- Unimplemented gap: This pass covers the signed-in, checked-in Statistics state in light and dark on iPhone 17 Pro. Small-phone/tablet containment, dynamic type, and review-pending Statistics state remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The progress ratio intentionally uses today's completed plus pending-review count as the local rail target; it is a presentation affordance, not a new algorithm or scoring contract.
- Review-pending Statistics state still needs separate real screenshot evidence in a future pass.

## Follow-up

- Continue quality passes on review-pending Statistics, small-phone/tablet containment, dynamic type, and post-auth transition state.
