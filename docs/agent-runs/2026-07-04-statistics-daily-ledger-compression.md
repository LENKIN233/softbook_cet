# Agent Run Record: Statistics daily ledger compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-6`
- PR: N/A at record creation
- Summary: Continued the mobile quality reset by reshaping Statistics from a report-like stack of nested cards into one daily progress object with a quiet metric band, an attached action dock, and a low-weight ledger. The page now supports the Learning flow without becoming a dashboard.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/single-card-ux-contract.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics must support the Learning flow and continuity confidence without becoming the product center.
- Top-level IA remains Learning / Space / Statistics / Mine.
- Daily-level progress sync and some progress inheritance are required; exact same-card cross-device resume is not required.
- Statistics uses tabular number treatment with low visual weight, not dashboard or gamification chrome.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` keeps one outer daily object and removes the heavy inner-card borders from the metric strip, next-step row, check-in row, and status ledger.
- The metric area now reads as a quiet tabular band instead of a numeric dashboard card.
- The next-step and check-in operations are combined in one attached action dock with a light divider, not two peer cards.
- The review/sync ledger is demoted to low-weight rows separated from the object by one top rule.
- Existing behavior and stable selectors are preserved: `statistics-metric-completed`, `statistics-checkin-button`, `statistics-checkin-complete-label`, `statistics-action-dock`, `statistics-next-step-card`, `statistics-checkin-card`, and `statistics-go-learning-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, single-card UX contract, `spec/visual-language.json`, current real app screenshots, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/__tests__/App.test.tsx`, Statistics and smoke Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: compresses nested statistic cards into a single daily object with a metric band, action dock, and low-weight ledger.
- `docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-04-statistics-daily-ledger-compression.md`: this run record.

## Commands run

- `npx prettier --write src/statistics/StatisticsSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `npm start -- --host 127.0.0.1` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/statistics.png` -> passed, 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_statistics_daily_ledger_compression_pr_body.md --changed-file apps/mobile/src/statistics/StatisticsSurface.tsx --changed-file docs/agent-runs/2026-07-04-statistics-daily-ledger-compression.md --changed-file docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png --changed-file docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_statistics_daily_ledger_compression_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Statistics screenshot flow: pass.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses a neutral daily progress object with one quiet teal/mint continuity accent. It does not introduce competing library identity colors.
- Q2 Focal object: First-read path is daily progress object -> attached action dock -> low-weight ledger -> floating chrome. The metric band supports the daily object rather than becoming the focal dashboard.
- Q3 Silhouette: Statistics follows the mobile core reset Statistics silhouette: daily object plus tabular ledger rows. It is not a Learning interaction and does not mimic card-answer silhouettes.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot at 1206 x 2622 confirms route header, daily object, metric band, action dock, ledger rows, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Statistics uses tabular number treatment and stays low-weight. Learning sequencing and flip self-assess are unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Statistics screenshot flow, iOS smoke flow, and Maestro selector validation.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Statistics now reads as an app support state rather than a report/dashboard.
- Check-in behavior, go-learning/review actions, metric values, and sync labels are unchanged.
- Existing screenshot and smoke selectors are preserved.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/single-card-ux-contract.md`, and `spec/visual-language.json`.
- Implementation mapping: daily object -> `StatisticsSurface` / `statistics-day-object`; metric ledger -> `statistics-metric-strip`; next action -> `statistics-action-dock` and `statistics-next-step-card`; check-in -> `statistics-checkin-card` and `statistics-checkin-button`; low-weight review/sync ledger -> `statistics-review-status` and `statistics-sync-label`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-statistics-daily-ledger-compression-simulator.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: N/A; Statistics does not change Space hierarchy or operations.
- Statistics microcopy basis: no visible-copy change; this pass changes hierarchy, surfaces, and density only.
- Unimplemented gap: This pass covers signed-in light-mode Statistics after real learning and check-in. Signed-out Statistics auth gate, dark mode, tablet containment, and error/retry visual states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because this run preserves state derivation, action handlers, and stable selectors.
- Future passes should cover signed-out/error Statistics variants and tablet/dark-mode containment.

## Follow-up

- Continue quality passes on incorrect/review Detail tones, signed-out Statistics variants, dark mode, tablet containment, and transition motion continuity.
