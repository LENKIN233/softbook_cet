# Agent Run Record: Statistics ledger dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-06`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by tightening the Statistics signed-in daily object. The bottom review/sync status area now renders as a compact vertical ledger inside the one-screen Statistics object instead of two cramped side-by-side cards with clipped detail text.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics is a top-level route, but it must stay quiet and supportive; learning progress should not become a dense dashboard that interrupts the single-card flow.
- Daily progress, review status, and sync/check-in state are supporting evidence for continuity, not the primary task.
- User-visible Statistics UI must not expose raw card ids, source metadata, agent/harness/spec/debug/runtime terms, internal remote error vocabulary, or implementation language.

## Implementation hypothesis changed

- The Statistics daily object keeps the primary path as daily summary -> metric strip -> next-step/check-in action dock.
- The bottom status area is now a two-row vertical ledger, which keeps review and record states readable without creating two cramped mini cards.
- The `statistics-action-dock`, check-in action, learning/review next action, metric selectors, and sync/review status selectors are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset design and mapping, current real app Statistics screenshots, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Statistics Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: changes the bottom status ledger from side-by-side mini cards to compact vertical rows and keeps text to one line to prevent clipping.
- `apps/mobile/__tests__/App.test.tsx`: adds a regression assertion that the Statistics ledger rail remains vertical.
- `docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-real-app.png`: real iPhone 17 Pro simulator light Statistics screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-dark-real-app.png`: real iPhone 17 Pro simulator dark Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app light Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed current real app dark Statistics screenshot.
- `docs/agent-runs/2026-07-06-statistics-ledger-dock.md`: this run record.

## Commands run

- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --runTestsByPath __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, both real simulator evidence screenshots are 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Statistics light screenshot flow: pass on iPhone 17 Pro simulator.
- Statistics dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, two evidence screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Selector and metadata-leak gates: pass.
- Full local gates: pass.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: Statistics keeps one quiet daily-progress accent. The ledger rows use low-weight borders and do not introduce a second dominant color system.
- Q2 Focal object: First-read path is route chrome -> daily object -> metric strip -> next-step/check-in action dock -> compact review/record ledger.
- Q3 Silhouette: Statistics now reads as one bounded daily object with an attached status ledger, not a dashboard stack of unrelated cards.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the status ledger fits without clipped detail text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics remains a supportive progress surface and does not become module navigation, complex analytics, or an interruption to the Learning flow.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Statistics visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Statistics signed-in state now has a cleaner bottom status ledger, removing cramped mini cards and the prior clipped/near-clipped detail copy.
- Learning progression, review, space operations, auth, membership, purchase, sync semantics, and card content are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, `docs/design/visual-reference.html`, and `spec/visual-language.json`.
- Implementation mapping: Daily object -> `statistics-day-object`; metric strip -> `statistics-metric-strip`; action dock -> `statistics-action-dock`; next-step card -> `statistics-next-step-card`; check-in card -> `statistics-checkin-card`; compact status ledger -> `statistics-status-ledger` / `statistics-ledger-rail`; review and record rows -> `statistics-review-status` and `statistics-sync-label`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-real-app.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/agent-runs/artifacts/2026-07-06-statistics-ledger-dock/statistics-dark-real-app.png` -> `docs/design/app-screenshots/current-real-app/dark/statistics.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing go-learning, start-review, and check-in handlers are reused.
- Physical-space source: N/A; this run does not alter Space semantics.
- Learning microcopy basis: no visible-copy change in Learning. Statistics visible copy is unchanged; only layout and status-ledger containment changed.
- Unimplemented gap: Smaller-phone Statistics containment, tablet Statistics containment, pending-review Statistics state, no-progress Statistics state, and remote sync-error visual state remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The status rows now use single-line detail text to preserve containment. Longer future sync messages should be covered in a follow-up stress-state pass.
- Existing stable selectors were preserved and checked by Jest and Maestro.

## Follow-up

- Continue visible-quality coverage with smaller-phone Statistics, tablet Statistics, pending-review Statistics, no-progress Statistics, remote sync-error Statistics, and remaining protected-route auth gates.
