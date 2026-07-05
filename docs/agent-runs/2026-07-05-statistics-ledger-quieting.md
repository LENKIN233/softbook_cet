# Agent Run Record: Statistics ledger quieting

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-11`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping Statistics from a large metric-dashboard surface into a quieter daily ledger object. This pass keeps Statistics subordinate to Learning, preserves existing state and selectors, and refreshes the real iPhone simulator Statistics screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics supports the Learning flow and must not become the product center.
- Statistics should be a quiet daily object with tabular ledger rows.
- Numbers can confirm progress, but the primary next step remains returning to Learning or starting review.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, queue, cache, payload, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` now treats metrics as ledger rows rather than a focal dashboard strip.
- `今日完成`, `首轮`, `回看`, and `待回看` keep tabular numeric treatment with lower visual weight.
- Next-step and check-in controls remain attached to the daily object as compact action rows.
- Review and sync status become low-weight ledger rows instead of separate card tiles.
- Existing behavior and selectors are preserved: `statistics-day-object`, `statistics-metric-strip`, `statistics-metric-completed`, `statistics-metric-learning`, `statistics-metric-review`, `statistics-metric-pending-review`, `statistics-action-dock`, `statistics-next-step-card`, `statistics-go-learning-button`, `statistics-start-review-button`, `statistics-checkin-card`, `statistics-checkin-button`, `statistics-review-status`, and `statistics-sync-label`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset decision/mapping artifacts, `apps/mobile/src/statistics/StatisticsSurface.tsx`, App tests, Statistics screenshot Maestro flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: turns the metric strip into a vertical ledger, compacts action rows, and lowers review/sync status visual weight.
- `docs/agent-runs/artifacts/2026-07-05-statistics-ledger-quieting-simulator.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-05-statistics-ledger-quieting.md`: this run record.

## Commands run

- `npm exec prettier -- --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed; expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-statistics-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot /tmp/softbook-statistics-current.png` -> passed.
- `cp /tmp/softbook-statistics-current.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `cp /tmp/softbook-statistics-current.png docs/agent-runs/artifacts/2026-07-05-statistics-ledger-quieting-simulator.png` -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> first run failed because `can complete the local single-card deck and restart it` exceeded the 5s Jest timeout while all other 162 tests passed; the same test had passed in focused App tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> rerun passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `file docs/design/app-screenshots/current-real-app/statistics.png docs/agent-runs/artifacts/2026-07-05-statistics-ledger-quieting-simulator.png` -> passed, both 1206 x 2622 PNG.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Full mobile Jest: pass on rerun, 26 suites and 163 tests. The prior full run had one 5s timeout in an already-focused-passing App test and no assertion failure.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-statistics-ledger-quieting-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses the existing route/accent system quietly. The daily ledger does not introduce a new competing color system, and the only strong action remains the route back to Learning.
- Q2 Focal object: First-read path is daily ledger object -> tabular progress rows -> next Learning action -> check-in status -> low-weight review/sync rows -> floating navigation.
- Q3 Silhouette: Statistics now follows the accepted daily ledger silhouette with tabular rows. It does not behave like a primary dashboard or achievement board.
- Q4 Forbidden patterns: Refreshed screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, game reward chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the daily ledger, action rows, check-in row, review/sync rows, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics stays tabular and supportive. It does not compete with Learning as product center, and it keeps the next step pointed back to Learning or review.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Statistics screenshot flow, and iOS smoke flow.
- Blocking findings: none known after verification.

## User-visible UI impact

- Yes. Statistics now reads more like a quiet daily ledger and less like a dashboard.
- Numeric progress remains visible but no longer dominates the screen.
- The primary next step remains clear: return to Learning or start review.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`; daily object -> `StatisticsSurface`; ledger rows -> `statistics-metric-*`; next action -> `statistics-next-step-card` and Learning/review buttons; continuity -> `statistics-checkin-card`; low-weight status ledger -> `statistics-review-status` and `statistics-sync-label`.
- Interaction/motion source: N/A; this PR does not change Learning/core interaction behavior.
- Physical-space source: N/A; this PR does not change Space UI or Space behavior.
- Learning microcopy basis: N/A; this PR does not change Learning UI copy or card payload content.
- Unimplemented gap: This pass covers light-mode phone Statistics after progress and check-in. Empty-state Statistics, pending-review Statistics, dark mode, tablet containment, and richer transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- This pass changes visual hierarchy only; it does not change progress sync, check-in, review selection, or membership behavior.
- Follow-up screenshots should capture Statistics before check-in and with pending review cards to ensure the ledger treatment holds across states.

## Follow-up

- Continue quality passes on Space browse depth, Mine signed-in state, and non-ideal Learning states after this PR is gated and merged.
