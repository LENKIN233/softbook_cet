# Agent Run Record: Statistics route object quality pass

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/statistics-route-object-quality`
- Summary: Continued the user-visible app quality reset by reshaping Statistics from a stacked reporting/dashboard surface into one compact daily progress object. This pass adds the Statistics route identity to the focal card, turns metrics into a contained status strip, merges review/record/practice signals into one status dock, removes the full-height blank white panel, and refreshes the real iOS simulator Statistics screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics is a support surface for the CET learning loop. It should quietly record daily progress and check-in continuity without becoming the product center or a generic reporting dashboard.
- The core product remains the single-card Learning flow and the physical Space map; Statistics must not introduce a second learning mode or an independent card type.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- Statistics now reads as a daily progress object with the route badge `记`, not a statistics dashboard.
- The previous metric card row is reduced to a single soft status strip with stable metric test IDs.
- Review status, sync record, and practice signals are merged into one attached status dock instead of separate cards and divider lines.
- The daily object no longer stretches into an empty full-height white panel; it keeps natural height inside the app shell, matching the support-surface role.
- The current real app Statistics screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Statistics quality run record, mobile implementation mapping, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: replaces the dashboard-like metric/ledger/card stack with a daily progress object, status strip, continuity row, and attached status dock.
- `docs/agent-runs/artifacts/2026-07-01-statistics-route-object-quality-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: current real app Statistics screenshot.
- `docs/agent-runs/2026-07-01-statistics-route-object-quality.md`: this run record.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-statistics-route-object-quality-simulator.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-statistics-route-object-quality-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_route_object_quality_pr_body.md --changed-file apps/mobile/src/statistics/StatisticsSurface.tsx --changed-file docs/design/app-screenshots/current-real-app/statistics.png --changed-file docs/agent-runs/artifacts/2026-07-01-statistics-route-object-quality-simulator.png --changed-file docs/agent-runs/2026-07-01-statistics-route-object-quality.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_route_object_quality_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate validation: pass.
- Agent review PR body validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-statistics-route-object-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses the neutral shell accent and semantic success/warning only for numeric state. It does not introduce a competing library palette or gamified color system.
- Q2 Focal object: The focal object is the daily progress object. First-read path is route badge -> daily title -> status strip -> continuity action -> review/record/signal dock -> floating chrome.
- Q3 Silhouette: Statistics is a support surface, not the core Learning interaction. It follows the accepted object-and-attached-status silhouette instead of a dashboard/card-list silhouette.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no horizontal overflow, no clipped text, no CTA overlap, and no bottom chrome collision.
- Q6 Surface-specific: This is Statistics-only. It preserves support-metric tabular numbers and does not alter Learning sequencing, Space hierarchy, Auth semantics, Mine membership, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Statistics screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Statistics now presents today's progress, check-in continuity, review state, sync record, and practice signal as one app surface instead of a dashboard stack.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: daily object -> `statistics-day-object`; status strip -> `statistics-metric-*`; continuity row -> `statistics-checkin-card` and `statistics-checkin-button`; review/record/signal dock -> `statistics-review-status`, `statistics-sync-label`, and `statistics-sync-detail`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Unimplemented gap: This pass verifies light-mode phone output. Tablet, dark-mode screenshot evidence, and post-syncing/error visual states remain separate follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence is light-mode iPhone 17 Pro coverage. Behavior and text are covered by tests and smoke, but dark-mode and tablet visual captures are not included in this pass.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, and secondary sync/error visual states.
