# Agent Run Record: Statistics daily ledger

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-1`
- PR: https://github.com/LENKIN233/softbook_cet/pull/337
- Summary: Continued the mobile quality reset by reshaping Statistics from a report-like progress panel into a quieter daily ledger object. The visible reference-line accent was removed, the metric strip was lowered, the inner action card was flattened into operation rows, and the checked-in summary now reads as tabular day state rather than explanatory copy.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics supports the single-card learning flow and must not become the product center or a dashboard-first report.
- The statistics focal object is the daily ledger object; numbers should stay tabular and low visual weight.
- Learning remains the primary route for actual work. Statistics can show next action and check-in, but it must not compete with Learning.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` no longer uses the tall `dailyAccent` vertical reference line; the daily object now uses a compact dot signal.
- The checked-in summary is now `首轮 n · 回看 n · 已记录`, matching ledger language instead of explanatory prose.
- The metric strip remains visible for test and user continuity but is smaller, bordered, and lower weight.
- The next-step/check-in area keeps stable selectors while losing the visible nested-card frame.
- Existing behavior and selectors are preserved: `statistics-day-object`, `statistics-metric-completed`, `statistics-action-dock`, `statistics-next-step-card`, `statistics-go-learning-button`, `statistics-checkin-card`, `statistics-checkin-button`, and `statistics-checkin-complete-label`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current real app Statistics screenshot, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, and the Statistics Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: removes the reference-line accent, flattens the action area, lowers metric hierarchy, and tightens daily ledger copy.
- `docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-05-statistics-daily-ledger.md`: this run record.

## Commands run

- `git status --short --branch` -> started on `codex/fix/mobile-quality-followup-20260705-1`, tracking `origin/main`, with only pre-existing untracked `exports/`.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed, both 1206 x 2622.
- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/statistics/StatisticsSurface.tsx docs/agent-runs/2026-07-05-statistics-daily-ledger.md` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_daily_ledger_pr_body.md --changed-file apps/mobile/src/statistics/StatisticsSurface.tsx --changed-file docs/agent-runs/2026-07-05-statistics-daily-ledger.md --changed-file docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png --changed-file docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_daily_ledger_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full Maestro selector validation: pass.
- Whitespace diff check: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Statistics Maestro selector validation: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics stays neutral and daily-led. The only strong action remains `回学习`; the daily signal uses the account/app accent at low weight.
- Q2 Focal object: First-read path is route title -> daily ledger object -> tabular metrics -> next learning action -> check-in continuity -> floating chrome.
- Q3 Silhouette: The screen remains a one-screen app support surface. It no longer reads as a dashboard/report page with a reference line and nested action card.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, or report-first chrome.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the daily ledger object, metric strip, operation rows, status rows, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics uses tabular number treatment and remains supporting, not primary. This run does not change Learning sequencing, flip self-assess, Space hierarchy, auth, purchase, membership entitlement, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Statistics screenshot flow, iOS smoke flow, selector validation, PR design gate, and agent review gate. Pending required remote checks and merge.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Statistics now presents daily progress as a quieter one-screen ledger, with the visible reference-line accent removed.
- The primary next action still returns the user to Learning.
- Check-in behavior, review entry behavior, sync labels, and stable selectors are preserved.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: daily ledger object -> `apps/mobile/src/statistics/StatisticsSurface.tsx` / `statistics-day-object`; tabular metrics -> `statistics-metric-strip`; next action -> `statistics-action-dock` / `statistics-go-learning-button`; check-in continuity -> `statistics-checkin-card` / `statistics-checkin-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-statistics-daily-ledger/statistics-real-app.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Interaction/motion source: no new interaction family or motion implementation was added.
- Physical-space source: N/A; this is Statistics-only and does not change Space.
- Unimplemented gap: dark Statistics, tablet containment, review-needed Statistics, and empty-day Statistics remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and statistics handlers are preserved.
- Follow-up screenshot work should cover review-needed and empty-day states to keep Statistics consistent across all states.

## Follow-up

- Create/update PR, wait for required remote checks, merge if gates pass, and fast-forward `/Users/lenkin/programing/softbook_cet_design_quarantine`.
