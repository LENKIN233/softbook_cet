# Agent Run Record: Statistics ledger flow pass

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mobile-route-quality-next`
- Summary: Continued the user-visible app quality reset by reshaping Statistics from a quiet but dashboard-like panel into a daily ledger object. This pass makes the day record the focal object, turns the metrics into low-weight ledger rows, attaches the check-in action to the object, keeps practice signals subordinate, and refreshes the real iOS simulator Statistics screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning stays the primary system-sequenced flow; Statistics supports continuity and confidence without becoming the product center.
- Statistics must be quiet and tabular. It must not become achievement chrome, a progress dashboard, a planner, or a user-management surface that competes with the current card.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome. For Statistics, the current object is the daily ledger object.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- The Statistics daily object now leads with the day record and a compact checked-in status.
- The four progress metrics now render as a low-weight ledger sheet rather than a broad dashboard strip.
- The check-in state is attached as an action slip directly under the ledger and remains reachable through the existing `statistics-checkin-button`.
- Practice signals remain visible but subordinate inside the lower ledger dock.
- The current real app Statistics screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, `apps/mobile/src/statistics/StatisticsSurface.tsx`, App tests, Maestro iOS Statistics/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: reshapes the daily object, metric ledger, check-in slip, and subordinate signal dock.
- `docs/agent-runs/artifacts/2026-07-01-statistics-ledger-flow-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: current real app Statistics screenshot.
- `docs/agent-runs/2026-07-01-statistics-ledger-flow.md`: this run record.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-statistics-ledger-flow-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-statistics-ledger-flow-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/statistics.png docs/agent-runs/artifacts/2026-07-01-statistics-ledger-flow-simulator.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator, including Learning, Space, Statistics check-in, and Mine paths.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-statistics-ledger-flow-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics stays neutral and uses only the existing subdued route accent for status and tabular values. It does not introduce a competing library palette, chart palette, or achievement color system.
- Q2 Focal object: The focal object is the daily ledger object. First-read path is route title -> day object -> ledger rows -> attached check-in slip -> subordinate review/sync/signal dock.
- Q3 Silhouette: The screen now follows a quiet ledger silhouette, not a dashboard strip or progress-board layout. Numbers are tabular and visually subordinate to the day record.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no title wrap, no clipped ledger rows, no check-in CTA collision, no horizontal overflow, and no bottom chrome overlap.
- Q6 Surface-specific: This is Statistics-only. It supports Learning continuity without becoming the product center, does not add planner/dashboard behavior, and preserves top-level navigation order.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Statistics screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Statistics now presents a daily ledger object with an attached check-in slip instead of a dashboard-like metrics panel.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: daily object -> `statistics-day-object`; metrics ledger -> `statistics-metric-strip` and `statistics-metric-*`; check-in slip -> `statistics-checkin-card` and `statistics-checkin-button`; status dock -> `statistics-review-status` / `statistics-sync-label`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the checked-in Statistics state. Dark-mode screenshot, tablet screenshot, pre-check-in screenshot, no-progress state, and queued-sync visual state remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the populated light-mode iPhone 17 Pro checked-in state. Long sync detail text, no-progress state, dark mode, and tablet captures remain separate coverage targets.

## Follow-up

- Continue real-app quality passes on Mine account/membership object, Statistics alternate states, and dark/tablet containment screenshots.
