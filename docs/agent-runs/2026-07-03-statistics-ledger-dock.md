# Agent Run Record: Statistics ledger dock

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-2`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping Statistics into a quiet daily ledger object. The screen no longer presents progress as four mini dashboard cards plus separate action cards; metrics, next step, check-in, and record status now live inside one daily object with a low-weight ledger and attached action dock.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains the product center; Statistics supports the flow and must not become a dashboard, achievement system, or planning center.
- Statistics should render the daily learning state as a quiet ledger object: low visual weight, tabular numbers, and no interruption to the single-card learning route.
- The mobile app grammar remains current object -> attached state/action -> floating chrome. For Statistics, the focal object is the current learning day.
- Top-level navigation remains Learning / Space / Statistics / Mine.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` keeps `statistics-day-object` as the only top-level surface object.
- The former four-card metric strip is replaced by `MetricLedgerRow` rows inside `statistics-metric-strip`, keeping stable metric selectors and adding explicit `*-value` nodes.
- The next-step action and check-in continuity controls are attached to `statistics-action-dock` instead of reading as independent page cards.
- The status area is reduced to a low-weight ledger separated by a thin top rule.
- `App.test.tsx` now asserts that the next-step and check-in controls are descendants of `statistics-action-dock`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, current real app screenshots, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, and the Statistics Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: replaces metric mini cards with ledger rows and moves next-step/check-in into one attached action dock.
- `apps/mobile/__tests__/App.test.tsx`: reads explicit metric value nodes and asserts Statistics action controls stay inside `statistics-action-dock`.
- `docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-03-statistics-ledger-dock.md`: this run record.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Full harness validation: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses one quiet current-route accent for the day object, status pill, ledger emphasis, and attached action dock; it does not introduce competing achievement colors.
- Q2 Focal object: The route title leads into one current daily ledger object, then attached next-step/check-in controls, then low-weight record rows and floating chrome.
- Q3 Silhouette: Statistics now reads as a quiet ledger and attached dock rather than a dashboard of separate mini cards.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the header, ledger rows, attached action dock, record rows, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics stays supportive and low-pressure. It records completion/check-in/review status without competing with Learning as a primary dashboard.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Statistics screenshot flow, strict iOS smoke, App/full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Statistics now presents the current learning day as a quieter ledger object.
- The current real app Statistics screenshot now shows low-weight ledger rows and an attached action dock rather than multiple independent dashboard cards.
- Learning progression, check-in behavior, review start behavior, sync status, auth, membership, purchase, and Space state behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics daily object -> `apps/mobile/src/statistics/StatisticsSurface.tsx`; quiet ledger rows -> `MetricLedgerRow`; attached next-step/check-in controls -> `statistics-action-dock`; screenshot evidence -> current real app Statistics screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-statistics-ledger-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing Statistics navigation, review, and check-in handlers are reused.
- Physical-space source: N/A; this run does not alter Space.
- Unimplemented gap: Light-mode phone screenshot covers signed-in Statistics after learning and check-in. Dark mode, tablet containment, signed-out Statistics gate, review-pending Statistics, and empty-progress Statistics screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by App tests and Maestro, reducing behavior risk.
- Smaller phones, dark mode, and pending-review Statistics state should be covered in follow-up quality passes.

## Follow-up

- Continue user-visible quality passes on signed-out/gated route states, dark/tablet containment, and remaining one-screen cohesion issues.
