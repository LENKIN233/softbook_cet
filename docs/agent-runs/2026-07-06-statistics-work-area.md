# Agent Run Record: Statistics work area

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-41`
- PR: N/A at record creation
- Summary: Continued the mobile user-visible quality reset by reshaping Statistics from a short report card into a full-height one-screen daily object. The daily progress object now fills the phone work area, the progress dock owns the middle visual weight with a large quiet ratio, and the next-step/check-in ledger stays attached near the bottom without changing progress, check-in, review, sync, route, or membership behavior.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Statistics is a quiet daily continuity surface. It records today, supports check-in, and can route the user back to Learning or Review, but must not become a complex dashboard, achievement page, streak surface, or primary learning mode.
- Learning remains the system-sequenced single-card flow. Statistics can summarize progress but must not interrupt or replace the current-card task.
- Daily progress sync and check-in remain account-bound continuity state; user-facing copy must not expose raw runtime, remote, endpoint, harness, seed, fixture, or internal metadata language.
- This run does not change card content, learning scoring, review scheduling, check-in eligibility, sync semantics, auth, membership, physical-space rules, or top-level route order.

## Implementation hypothesis changed

- `StatisticsSurface` now treats `statistics-day-object` as a full-height phone work-area object with `flex: 1`, `minHeight: 0`, and stable top/middle/bottom regions.
- `statistics-progress-dock` now fills the middle region and centers a large `completed/target` ratio, so the expanded one-screen object no longer reads as a stretched empty card.
- `statistics-action-dock` is explicitly non-shrinking, keeping the next-step action, check-in state, and ledger rows attached above the floating tab bar.
- Existing selectors, route handlers, check-in behavior, review entry, sync labels, and metric values are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile reset mapping, design canon, current real app screenshots, `apps/mobile/src/statistics/StatisticsSurface.tsx`, focused App tests, Statistics Maestro screenshot flow, and iOS smoke flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/statistics/StatisticsSurface.tsx`: expands the daily object, makes the progress dock own the middle work area, adds the large progress ratio block, and anchors the action dock.
- `apps/mobile/__tests__/App.test.tsx`: locks the Statistics one-screen object layout and dock behavior in the progress/check-in flow.
- `docs/design/app-screenshots/current-real-app/statistics.png`: refreshed light real app Statistics screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`: refreshed dark real app Statistics screenshot.
- `docs/agent-runs/artifacts/2026-07-06-statistics-work-area/*.png`: archived light and dark real simulator screenshot evidence.
- `docs/agent-runs/2026-07-06-statistics-work-area.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/statistics/StatisticsSurface.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can check in from statistics|keeps completed progress"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `npm --prefix apps/mobile run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed in light and dark simulator appearances.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ...` -> passed for light and dark Statistics screenshots.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-statistics-work-area/statistics-real-app.png docs/agent-runs/artifacts/2026-07-06-statistics-work-area/statistics-real-app-dark.png docs/design/app-screenshots/current-real-app/statistics.png docs/design/app-screenshots/current-real-app/dark/statistics.png` -> passed, all measured screenshots are 1206 x 2622.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused Statistics Jest: pass.
- Real light Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Real dark Statistics screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, refreshed and archived Statistics screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-statistics-work-area/statistics-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-statistics-work-area/statistics-real-app-dark.png`
  - `docs/design/app-screenshots/current-real-app/statistics.png`
  - `docs/design/app-screenshots/current-real-app/dark/statistics.png`

## Design review checklist

- Q1 Law of One: Statistics uses the daily continuity accent only. The screen does not introduce a second strong subject color, correctness color, or gamified achievement hue.
- Q2 Focal object: First-read path is route title -> daily learning object -> middle progress ratio -> attached next-step/check-in ledger -> floating tab chrome.
- Q3 Silhouette: The Statistics silhouette is now a full-height daily object with quiet ledger treatment, not a short report card floating above an empty lower page.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, raw remote exception, status code, seed, fixture, TODO, gradient text, gamification chrome, streak, XP, full-width tabbar, serif, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm the header, daily object, progress ratio, ledger, next-step CTA, check-in state, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, horizontal overflow, CTA collision, or bottom chrome collision.
- Q6 Surface-specific: Statistics remains low-cost daily continuity and check-in. Learning remains the main system-sequenced path; Space hierarchy, Mine account ownership, and flip two-state self-assess remain unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, focused tests, real light/dark screenshot inspection, full mobile gates, CloudBase tests, harness validation, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The Statistics route now reads as a complete app-level daily work area instead of a compact report card with a large blank lower page.
- The progress region has a clearer primary visual hierarchy while preserving the quiet ledger role from the accepted design mapping.
- Existing Statistics actions and data behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`.
- Implementation mapping: daily object -> `StatisticsSurface` and `statistics-day-object`; daily ledger/progress -> `statistics-progress-dock`, `statistics-progress-ratio`, and metric strip; attached action/record region -> `statistics-action-dock`, `statistics-next-step-card`, `statistics-checkin-card`, and status ledger; code surface -> `apps/mobile/src/statistics/StatisticsSurface.tsx`.
- Screenshot evidence mapping: archived files in `docs/agent-runs/artifacts/2026-07-06-statistics-work-area/` update the corresponding current real app screenshots under `docs/design/app-screenshots/current-real-app/` and `docs/design/app-screenshots/current-real-app/dark/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route, check-in, review, and Learning continuation handlers are reused.
- Physical-space source: N/A; this PR does not alter Space UI or physical-space rules.
- Learning microcopy basis: no Learning copy change. Statistics copy changes are limited to a small progress-meter caption inside the existing daily ledger object.
- Unimplemented gap: This pass covers iPhone 17 Pro phone Statistics in light/dark for the existing screenshot flow. Smaller-phone, tablet, dynamic type, and alternative states with pending review before check-in remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The page is intentionally more spacious than the old report card. The large ratio is a visual hierarchy device, not a new scoring system or achievement/streak mechanic.
- Small-phone and dynamic type should be included in a later containment pass before treating the whole app quality goal as complete.

## Follow-up

- Continue visible-quality coverage on smaller phone containment, tablet Statistics layout, pending-review Statistics state, and remaining non-core route states that still look like reports rather than app objects.
