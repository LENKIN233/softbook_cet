# Agent Run Record: Statistics daily object

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-5`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping Statistics from a report-like ledger into a tighter one-screen daily object. Metrics now read as a low-weight horizontal ledger, the next Learning action is visually active, and check-in/sync status remains attached without turning Statistics into a dashboard.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics is in v1 scope as simple stats and check-in, but it must support Learning rather than become a product-center dashboard.
- The default route after reading progress should remain Learning or Review, not extended statistics management.
- This run does not change learning progress, review selection, check-in eligibility, auth, membership, sync, or Space behavior.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` now renders the four metrics as compact horizontal ledger tiles instead of a vertical report table.
- The long daily accent is shortened into a quiet object marker.
- The next-step row is a card-attached action layer, and the non-review `回学习` CTA uses a dark active button so it no longer reads as disabled.
- The check-in row and review/sync ledger stay attached to the daily object with lower visual weight.
- Existing test IDs and behavior are preserved: `statistics-metric-*`, `statistics-action-dock`, `statistics-next-step-card`, `statistics-go-learning-button`, `statistics-start-review-button`, `statistics-checkin-card`, and `statistics-checkin-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, statistics Maestro screenshot flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: refines the Statistics daily object, metric ledger, next-step action, check-in row, and status ledger styling while preserving behavior.
- `docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-03-statistics-daily-object.md`: this run record.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-statistics-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ../../docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png` in `apps/mobile` -> passed.
- `cp ../../docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png ../../docs/design/app-screenshots/current-real-app/statistics.png` in `apps/mobile` -> passed.
- `sips -g pixelWidth -g pixelHeight ../../docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png ../../docs/design/app-screenshots/current-real-app/statistics.png` in `apps/mobile` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_daily_object_pr_body.md --changed-file apps/mobile/src/statistics/StatisticsSurface.tsx --changed-file docs/agent-runs/2026-07-03-statistics-daily-object.md --changed-file docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png --changed-file docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_daily_object_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Mobile lint: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Maestro selector validation: pass.
- Harness validation: pass.
- Whitespace diff check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses a neutral route accent and one dark primary CTA. It does not introduce competing library colors or reward colors.
- Q2 Focal object: First-read path is route title -> daily object -> compact metric ledger -> next Learning action -> check-in/status support -> floating chrome.
- Q3 Silhouette: Statistics remains a quiet daily object surface with tabular metric tiles. It does not mimic Learning interaction silhouettes or Space hierarchy.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or dashboard-first chrome appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the daily object, metric tiles, next-step action, check-in row, review/sync status, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics keeps tabular numbers and remains subordinate to Learning. Learning sequencing, flip self-assess, module role, Space hierarchy, Mine, auth, membership, purchase, and sync contracts are unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Statistics screenshot flow, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Statistics now presents today as a focused daily object instead of a vertical report page.
- The next Learning action is visually active, while check-in and status remain available but lower weight.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: daily object -> `apps/mobile/src/statistics/StatisticsSurface.tsx` / `statistics-day-object`; metric ledger -> `statistics-metric-strip` and `statistics-metric-*`; next action -> `statistics-next-step-card` and `statistics-go-learning-button` / `statistics-start-review-button`; check-in -> `statistics-checkin-card`; screenshot evidence -> current real app Statistics screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-statistics-daily-object-simulator.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing go-learning, start-review, and check-in handlers are reused.
- Physical-space source: N/A; this is Statistics-only and does not change Space.
- Learning microcopy basis: no Learning UI copy changed. Statistics copy remains design-backed daily-object support copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone Statistics after two completed cards and check-in is covered. Dark mode, tablet containment, pending-review Statistics screenshot, and empty-day Statistics screenshot remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Pending-review and empty-day variants should be covered by follow-up screenshot passes.

## Follow-up

- Continue quality passes on Statistics state variants, Mine membership object polish, smaller-device containment, and dark/tablet screenshots.
