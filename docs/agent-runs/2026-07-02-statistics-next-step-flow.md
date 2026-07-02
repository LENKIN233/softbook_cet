# Agent Run Record: Statistics next-step flow

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/mobile-next-quality-pass`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by changing Statistics from a passive report-style surface into a quiet daily state with an explicit next step. The page now keeps tabular progress low-weight while offering `回学习` or `开始回看` from the real app surface.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics is a top-level surface, but it must stay simple: `simple_stats_and_checkin`, not a heavy stats dashboard.
- Statistics must enhance confidence and continuity without distracting users from the system-sequenced Learning path.
- Module browsing and review are secondary, targeted actions; they must not become the primary learning mode.
- Progress sync is daily-level and some progress should be inherited across surfaces.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `StatisticsSurface` now exposes a `statistics-next-step-card` immediately after the daily metric strip.
- When there are pending review cards, the card says `先处理回看` and routes through the existing review-start handler.
- When there is no pending review, the card says `继续下一张` or `回到第一张` and routes back to Learning.
- The old `练习信号` block was removed from the visible Statistics surface; progress remains in metric cards and two ledger rows.
- The Statistics screenshot flow now reuses the existing `auth-gate-keyboard-dismiss-target` before SMS submit, matching the already accepted remote and smoke flows.
- The current real app Statistics screenshot was refreshed from the iPhone 17 Pro simulator.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/statistics/StatisticsSurface.tsx`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Statistics Maestro flow, and current real app screenshot evidence.
- Generated/dependency/cache/archive read: simulator screenshots and dimensions were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: adds next-step action card, removes visible signal report block, keeps tabular metrics and ledger rows.
- `apps/mobile/App.tsx`: wires Statistics next-step actions to Learning and existing review start behavior.
- `apps/mobile/__tests__/App.test.tsx`: covers Statistics -> review and Statistics -> Learning actions, and guards against visible internal terminology.
- `apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml`: reuses the auth keyboard dismiss target before SMS submit.
- `docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png`: real iPhone 17 Pro simulator Statistics screenshot evidence.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed current real app Statistics screenshot.
- `docs/agent-runs/2026-07-02-statistics-next-step-flow.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx src/statistics/StatisticsSurface.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png docs/design/app-screenshots/current-real-app/statistics.png` -> passed, both 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Statistics screenshot flow: pass on iPhone 17 Pro simulator, iOS 26.5.
- Strict iOS smoke: pass on iPhone 17 Pro simulator, iOS 26.5.
- Screenshot dimensions: pass, `1206 x 2622`.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics keeps the current route accent restrained and does not introduce another dominant color system. The daily object remains the single focal state.
- Q2 Focal object: First-read path is Statistics header -> daily object -> metric strip -> next step -> continuity and ledger. The user sees what happened today and what to do next.
- Q3 Silhouette: The surface remains a one-screen daily-state panel with tabular metrics and low-weight ledger rows, not a dashboard or management table.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the next-step card, check-in card, ledger rows, and floating tab bar fit without clipped text, overlap, or bottom chrome collision.
- Q6 Surface-specific: Stats uses tabular numeric treatment and remains secondary to Learning. The new actions return to Learning or existing review flow instead of turning Statistics into module selection.
- AP-22: The design review checklist six questions are answered here before PR delivery, and pre-render proof is the real iPhone simulator screenshot.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Statistics screenshot flow, strict iOS smoke, typecheck, lint, full Jest, metadata scans, selector validation, harness validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Statistics now behaves more like a mainstream app surface: it records progress and then gives a clear next action instead of ending on passive signal data.
- The visible `练习信号` report block is removed from the main Statistics screen.
- The route still preserves daily progress, check-in, review status, and sync state without becoming a heavy dashboard.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: Statistics daily object and ledger rows -> `apps/mobile/src/statistics/StatisticsSurface.tsx`; route wiring -> `apps/mobile/App.tsx`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-statistics-next-step-simulator.png` -> `docs/design/app-screenshots/current-real-app/statistics.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The Statistics action card calls existing Learning and review behavior.
- Learning microcopy basis: no visible-copy change in Learning; Statistics copy changed as a product correction to remove passive report language and internal terminology.
- Unimplemented gap: Light-mode phone Statistics next-step state is verified. Dark mode/tablet Statistics, pending-review screenshot state, and remaining auth screenshot flows that still do not reuse the shared keyboard dismiss target remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- This run adds Statistics-to-review routing through the existing review-start handler. If the user lacks the review capability, existing membership gating sends them to Mine, preserving the current product contract.
- Only the checked-in no-pending-review Statistics screenshot was refreshed in this pass; pending-review screenshot evidence should be added in a later quality pass.

## Follow-up

- Continue quality passes on pending-review Statistics screenshot evidence, remaining auth screenshot flows that need shared keyboard dismissal, and dark/tablet containment.
