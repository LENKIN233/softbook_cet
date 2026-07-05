# Agent Run Record: Statistics action ledger

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-16`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by tightening Statistics into a one-screen learning-day object. The metric band is now lower weight, review/sync status sits inside the same attached action dock, and the page no longer reads as a report tail below the primary action.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains the product center; Statistics supports confidence and continuity without becoming a dashboard, trend board, reward system, or planner.
- Statistics is a quiet learning-day ledger attached to the current route, not a standalone analytics page.
- The visible app grammar remains current object -> attached state/action -> floating chrome.
- User-visible UI and screenshot artifacts must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `statistics-metric-strip` now uses one shared compact ledger band instead of four separate mini-cards.
- `statistics-status-ledger` moved into `statistics-action-dock`, so review and record state read as attached support information rather than a separate page tail.
- The status ledger changed from vertical rows to a two-column row while preserving existing selectors, check-in, review, learning return, and sync-status behavior.
- Existing route, auth, check-in, review, membership, and Space behavior are unchanged.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, current Statistics/Mine screenshots, prior Statistics run record, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, and the Statistics Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, candidate card content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: compresses metric and status presentation into one action-ledger surface while preserving behavior and selectors.
- `apps/mobile/__tests__/App.test.tsx`: updates the Statistics ledger layout assertion to match the compact attached ledger.
- `docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-light.png`: real iPhone 17 Pro simulator light Statistics screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-dark.png`: real iPhone 17 Pro simulator dark Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app light Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current real app dark Statistics screenshot.
- `docs/agent-runs/2026-07-06-statistics-action-ledger.md`: this run record.

## Commands run

- `npm exec prettier -- --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` from `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `git diff --check` -> passed.
- `npm start -- --reset-cache` from `apps/mobile` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-light.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-dark.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-light.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-dark.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run design-metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` for the two artifact screenshots and two current screenshots -> passed, all 1206 x 2622.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_action_ledger_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_action_ledger_pr_body.md --changed-file ...` -> passed after making Q1/Q4 checklist evidence explicit in the PR body.

## Validation results

- Focused App Jest: pass, 47 tests.
- Full mobile Jest: pass, 26 suites / 163 tests.
- Whitespace diff check: pass.
- Maestro selector validation: pass.
- Design metadata leak scan: pass.
- Mobile lint and typecheck: pass.
- Backend function tests: pass, 11 tests.
- Harness with and without remote guard: pass.
- Statistics light/dark screenshot flows: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass.
- Screenshot dimensions: pass, 1206 x 2622.
- Agent review gate: pass.
- PR design gate: pass.

## Design review checklist

- Q1 Law of One: Statistics keeps one quiet day-object accent and does not introduce competing achievement colors or reward states.
- Q2 Focal object: First-read path is route title -> current-day object -> compact progress/metric band -> attached next-step/check-in/status dock -> floating chrome.
- Q3 Silhouette: Statistics now reads as one learning-day object with attached action ledger, not a stacked dashboard or vertical report page.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm header, metric band, attached action ledger, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics remains supportive and low pressure. It records completion, review, and continuity state without competing with Learning as a primary dashboard and keeps tabular numeric treatment.
- AP-22: The design review checklist is answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Statistics visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Statistics now keeps metrics and review/record state attached to the same action dock, making the screen feel more like a mainstream app state and less like a report page.
- Learning progression, check-in behavior, review start behavior, sync status, auth, membership, purchase, and Space state behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics daily object -> `apps/mobile/src/statistics/StatisticsSurface.tsx`; compact metric band -> `statistics-metric-strip` and `MetricLedgerRow`; attached next-step/check-in/status dock -> `statistics-action-dock`; low-weight review/sync status -> `LedgerRow`; screenshot evidence -> current real app Statistics light/dark screenshots.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-light.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/agent-runs/artifacts/2026-07-06-statistics-action-ledger/statistics-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/statistics.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Statistics navigation, review, and check-in handlers are reused.
- Physical-space source: N/A; this run does not alter Space.
- Learning microcopy basis: N/A; this run does not change Learning microcopy.
- Unimplemented gap: Light and dark phone Statistics after learning progress and check-in are covered. Smaller phones, tablet containment, signed-out Statistics gate, review-pending Statistics, and empty-progress Statistics remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by App tests and Maestro, reducing behavior risk.
- Smaller phones, tablet, review-pending, and empty-progress Statistics states should be covered in later quality passes.
