# Agent Run Record: Statistics daily object quality pass

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/statistics-daily-object-quality`
- PR: https://github.com/LENKIN233/softbook_cet/pull/274
- Summary: Continued the user-visible mobile app quality reset by converting Statistics from a report/dashboard-feeling page into a quiet daily learning object. This pass records a real iOS simulator screenshot and keeps Statistics inside the same one-screen app grammar as Learning, Space, and Mine.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics supports the learning flow. It must not become the product center, a dashboard, an achievement page, or a heavy analytics surface.
- The product explicitly minimizes the user cost of being interrupted by statistics and system state.
- User-visible UI must not leak agent, harness, spec, validator, metadata, runtime, mock, prototype, seed, fixture, debug, raw exception, API route, repo path, or TODO language.
- Statistics must use tabular number treatment with low visual weight.

## Implementation hypothesis changed

- The Statistics surface now has one main daily object: `今日学习`, status pill, low-weight tabular metrics, continuity action, quiet ledger, and compact practice signals.
- The previous standalone hero/report frame `今日统计与签到` was removed.
- Ledger rows are object tiles rather than line-separated report rows; sync and record details compress into a two-column secondary layer.
- The completed check-in action now reads `已记录` while the daily status pill carries `今日已签到`, reducing duplicate CTA copy.
- App tests now assert the desired state copy and guard against old report-like strings returning.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS flows, current real app screenshots, and recent mobile app quality run records.
- Generated/dependency/cache/archive read: real simulator screenshots were inspected only as validation evidence, not product truth.
- External workspace read: none. No card candidate content, approval batch, import, or `/Users/lenkin/programing/card make` artifact was modified.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: replaces the old statistics/report composition with a daily object, compact ledger tiles, low-weight tabular metrics, and deduplicated check-in completion state.
- `apps/mobile/__tests__/App.test.tsx`: asserts the new daily-object copy and prevents `今日统计与签到` / `今日练习信号` from returning.
- `docs/agent-runs/artifacts/2026-06-30-statistics-daily-object-quality-simulator.png`: source simulator capture for this pass.
- `docs/design/app-screenshots/current-real-app/statistics.png`: records the current real app Statistics screenshot.
- `docs/agent-runs/2026-06-30-statistics-daily-object-quality.md`: records this run.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-statistics-daily-object-quality-simulator.png` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> first attempt hit XCTest `kAXErrorInvalidUIElement` while reading view hierarchy before the first app assertion and was interrupted; clean rerun passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator after one transient XCTest hierarchy failure and rerun.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-06-30-statistics-daily-object-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics stays neutral and quiet. It uses shell accent only for status/action emphasis and does not compete with the active Learning/Space library color model.
- Q2 Focal object: The focal object is the daily learning object. First-read path is route header -> `今日学习` object -> status pill -> low-weight metrics -> continuity action -> quiet ledger.
- Q3 Silhouette: The surface no longer reads as a stats report. It presents as one current-day object with attached state and compact secondary layers.
- Q4 Forbidden patterns: No visible metadata, harness, debug, route, fixture, repo, runtime, raw id, TODO, removed self-assess token, or same-PR design authority was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the daily object, metrics, check-in action, ledger tiles, practice signals, and bottom chrome fit in one viewport without incoherent overlap.
- Q6 Surface-specific: This is Statistics-only. It preserves tabular number treatment and does not alter Learning sequencing, Space hierarchy, membership access, or flip self-assess semantics.
- AP-22: Design review checklist is answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after real simulator screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Statistics screenshot flow, and iOS smoke rerun.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Statistics tab now presents a quiet daily learning object instead of a report-like statistics/check-in page.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`, and `spec/visual-language.json`.
- Implementation mapping: daily object -> `statistics-day-object`; tabular metrics -> `statistics-metric-*`; continuity action -> `statistics-checkin-card` and `statistics-checkin-button`; quiet ledger -> `statistics-review-status`, `statistics-sync-label`, and `statistics-sync-detail`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Unimplemented gap: This pass improves phone Statistics. Tablet capture, dark-mode capture, and motion transitions for check-in completion still require separate accepted proof before implementation.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence is light-mode iPhone 17 Pro simulator coverage. React tests and Maestro smoke cover behavior, but this pass does not include separate tablet or dark-mode capture.
- The first iOS smoke attempt hit a transient XCTest view hierarchy error before business assertions; the clean rerun passed.

## Follow-up

- Continue app-quality passes on remaining secondary states and motion polish, using real simulator screenshots as the acceptance bar.
