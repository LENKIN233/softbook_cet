# Agent Run Record: Statistics one-screen dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-03`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by compressing Statistics from a vertical ledger/report stack into one current-day object. Metrics now read as a compact horizontal status band, next-step and check-in controls share one attached dock, and review/sync status is reduced to a low-weight two-column strip.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains the product center; Statistics supports confidence and continuity but must not become a dashboard, achievement system, or planning center.
- The app grammar remains current object -> attached state/action -> floating chrome. For Statistics, the focal object is the current learning day.
- Statistics must stay low pressure: tabular numbers, no reward chrome, no trend dashboard, no mode selection, and no interruption to the single-card route.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `statistics-metric-strip` is now a compact horizontal status band instead of four vertical ledger rows.
- `statistics-action-dock` is now one attached surface containing both next-step and check-in continuity controls, separated by a quiet divider.
- Review/sync status is shortened and rendered as a two-column strip so it supports the day object without extending the page like a report.
- Existing behavior, route handlers, check-in, review start, sync labels, metric selectors, and Maestro selectors are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, prior Statistics run record, current real app screenshots, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Statistics Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: compresses Statistics metrics, action dock, and status strip while preserving behavior and selectors.
- `apps/mobile/__tests__/App.test.tsx`: updates the review-status assertion to the new compact visible state copy.
- `docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app.png`: real iPhone 17 Pro simulator light Statistics screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app-dark.png`: real iPhone 17 Pro simulator dark Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app light Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current real app dark Statistics screenshot.
- `docs/agent-runs/2026-07-06-statistics-one-screen-dock.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/statistics/StatisticsSurface.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app-dark.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app-dark.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, all artifact and current screenshot files are 1206 x 2622.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_one_screen_dock_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_one_screen_dock_pr_body.md --changed-file ...` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Whitespace diff check: pass.
- Statistics light screenshot flow: pass on iPhone 17 Pro simulator.
- Statistics dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, all evidence and current screenshots are 1206 x 2622.
- Full local gates: pass.
- PR design gate: pass.
- Agent review gate: pass.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: Statistics uses one quiet route accent for the day object, metric band, and attached dock. It does not introduce competing achievement colors or reward states.
- Q2 Focal object: First-read path is route title -> current-day object -> compact metric band -> attached next-step/check-in dock -> low-weight review/sync strip -> floating chrome.
- Q3 Silhouette: Statistics now reads as a single current-day object, not a vertical report or stacked dashboard.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the header, metric band, attached action dock, status strip, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics remains supportive and low-pressure. It records completion/check-in/review status without competing with Learning as a primary dashboard and keeps tabular numeric treatment.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Statistics visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Statistics now presents the current learning day as one compact object instead of a report-like vertical ledger stack.
- The screen should feel less like a dashboard and more like a quiet app state that sends the learner back to Learning.
- Learning progression, check-in behavior, review start behavior, sync status, auth, membership, purchase, and Space state behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics daily object -> `apps/mobile/src/statistics/StatisticsSurface.tsx`; compact metric band -> `statistics-metric-strip` and `MetricLedgerRow`; attached next-step/check-in controls -> `statistics-action-dock`; low-weight status strip -> `LedgerRow`; screenshot evidence -> current real app Statistics light/dark screenshots.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/agent-runs/artifacts/2026-07-06-statistics-one-screen-dock/statistics-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/statistics.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Statistics navigation, review, and check-in handlers are reused.
- Physical-space source: N/A; this run does not alter Space.
- Learning microcopy basis: no visible-copy change in Learning. Statistics review-status visible copy is design-backed compression of the existing status sentence.
- Unimplemented gap: Light and dark phone Statistics after learning progress and check-in are covered. Tablet containment, signed-out Statistics gate, review-pending Statistics, and empty-progress Statistics remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by App tests and Maestro, reducing behavior risk.
- Smaller phones, tablet, and pending-review Statistics state should be covered in follow-up quality passes.

## Follow-up

- Continue visible-quality coverage with smaller phones, tablet containment, signed-out Statistics gate, review-pending Statistics, and empty-progress Statistics evidence in later passes.
