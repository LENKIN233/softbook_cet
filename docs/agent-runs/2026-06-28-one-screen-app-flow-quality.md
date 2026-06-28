# Agent Run Record: one-screen app flow quality repair

## Task summary

- Date: 2026-06-28
- Branch: `codex/rebuild-app-flow-quality`
- PR: https://github.com/LENKIN233/softbook_cet/pull/258
- Summary: Repaired the mobile app after simulator review showed it was still behaving like stacked pages instead of an operable app. The change removes phone primary-surface `ScrollView` shells, compresses Learning/Space/Statistics/Mine into one-screen app states, and verifies the real iOS simulator flow.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- Learning remains a system-sequenced single-card flow with one current card and one primary task.
- Single-card flow must be operable; it is not a dense one-screen poster or a scroll-dependent dashboard.
- User-visible metadata, harness, mock, runtime, route, fixture, debug, and repo language remain blockers.
- Space remains a physical current-position model; it must not degrade into a flat list or favorite/sleep-only page.

## Implementation hypothesis changed

- Phone shell now uses a compact top bar instead of a large page header competing with the active surface.
- Auth, learning loading, sleep recovery, Mine, RouteCanvas fallback, and Statistics are one-screen panels instead of long `ScrollView` pages.
- Learning hides auxiliary dock actions on non-flip interactions, keeps dense card actions visible, and compresses multiple-choice option tiles so submit and next actions are reachable.
- Space overview moves the return-to-learning action into the current-box header and removes the clipped bottom continuity card.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/src/statistics/StatisticsSurface.tsx`, Jest tests, and Maestro smoke flow.
- Generated/dependency/cache/archive read: none as product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/App.tsx`: compact phone shell; one-screen auth/loading/sleep/Mine/fallback states; reduced page-card density.
- `apps/mobile/src/learning/LearningSurface.tsx`: completion state no longer scrolls; non-flip interactions no longer show the auxiliary dock; multiple-choice options are compact and tappable.
- `apps/mobile/src/space/SpaceSurface.tsx`: current-box header now includes return-to-learning; clipped bottom continuity card removed.
- `apps/mobile/src/statistics/StatisticsSurface.tsx`: statistics rendered as a one-screen dashboard without `ScrollView`.
- `apps/mobile/__tests__/App.test.tsx`: regression for phone primary surfaces having no `ScrollView`.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: updated Space return-action assertion after removing bottom continuity strip.
- `docs/agent-runs/artifacts/*.png`: real iOS simulator screenshots from the running app.

## Real app screenshots

- `docs/agent-runs/artifacts/2026-06-28-one-screen-app-flow-simulator-auth.png`
- `docs/agent-runs/artifacts/2026-06-28-one-screen-app-flow-simulator-learning.png`
- `docs/agent-runs/artifacts/2026-06-28-one-screen-app-flow-simulator-space-fixed.png`
- `docs/agent-runs/artifacts/2026-06-28-one-screen-app-flow-simulator-statistics-final.png`

These are `simctl screenshot` captures from `com.softbook.cet` running in iPhone 17 Pro iOS 26.5 simulator, not mock images.

## Commands run

- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm test -- --runInBand` in `apps/mobile` -> 26 suites passed, 157 tests passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` with Homebrew OpenJDK -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ...` -> captured real app screenshots.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass.
- User-visible metadata scan: pass via Jest pretest.
- Design metadata leak scan: pass.
- Real iOS smoke: pass.
- Real iOS screenshots: pass.

## Design review checklist

- Q1 Law of One: Learning focuses on the current card/result; Space focuses on the current box; Statistics focuses on today.
- Q2 Focal object: each phone tab now has a clear first-read object and visible primary action without requiring page-length scrolling.
- Q3 Silhouette: Learning non-flip interactions no longer share a card-plus-auxiliary-dock pile; Space overview is address plus current box, with card list as a separate state.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, or repo language introduced; scans passed.
- Q5 Layout containment: verified by real simulator screenshots and Maestro smoke on iPhone 17 Pro iOS 26.5.
- Q6 Surface-specific: flip self-assess remains exactly two choices; Statistics uses tabular metric values.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code review, simulator screenshot inspection, full Jest, lint, typecheck, metadata scans, and real iOS Maestro smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. This is a user-facing mobile UI and interaction repair for primary app surfaces.
- Design source: accepted visual language plus `docs/design/single-card-ux-contract.md`; no new same-PR design artifact is being used as authority.
- Implementation mapping: current-card and current-box app states are implemented directly in RN surfaces.
- Unimplemented gap: no new native navigation framework or animation system introduced in this scoped repair.

## Card make external workspace impact

- N/A.

## Risks and open questions

- Maestro still uses `scrollUntilVisible` commands from the older smoke script; the real flow passes, but the script can be simplified later now that primary surfaces are contained.

## Follow-up

- Open a PR and require normal design/runtime gates before merge.
