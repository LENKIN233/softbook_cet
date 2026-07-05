# Agent Run Record: Route icon chrome

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-18`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by replacing single-character route badges with a shared icon system. The floating tab capsule, tablet route sidebar/header, and Mine route action dock now use consistent app-like route icons instead of `练` / `位` / `记` / `我` pseudo-icons.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- The app remains a CET4/6 exam-prep product built around single-card flow, high-value interactions, and physical-space card position continuity.
- Top-level navigation must remain a floating capsule app shell, not a full-width bottom tabbar.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, TODO, raw API, raw exception, or design-process terms.
- Mine is an account and membership surface attached to the same app shell; it must not become a generic settings page or a diagnostic panel.

## Implementation hypothesis changed

- `ShellRoute` no longer owns a single-character `badge`; route identity is rendered through `RouteIcon`.
- `RouteIcon` provides shared Learning card/book, Space node-link, Statistics bar, and Mine profile glyphs using React Native views, with no new icon dependency.
- Phone tabbar, tablet sidebar, tablet header pill, Mine avatar, and Mine route action cards now reuse the same route icon semantics.
- App tests now assert the phone route tabs keep only their labels and that logged-in Mine no longer renders standalone `练` / `位` / `记` / `我` pseudo-icons.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `docs/design/canon.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, current real app screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and existing Maestro screenshot/smoke flows.
- Generated/dependency/cache/archive read: simulator screenshots under `docs/design/app-screenshots/current-real-app/` and `docs/design/app-screenshots/current-real-app/dark/` were inspected as validation evidence. No generated dependency or archive source was used as product truth.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, candidate cards, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces route badge text with shared route icons across phone shell, tablet shell/header, Mine avatar, and Mine action cards.
- `apps/mobile/__tests__/App.test.tsx`: adds regression coverage against phone route pseudo-icons and Mine standalone route badge text.
- `docs/design/app-screenshots/current-real-app/learning.png`
- `docs/design/app-screenshots/current-real-app/detail.png`
- `docs/design/app-screenshots/current-real-app/space.png`
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/statistics.png`
- `docs/design/app-screenshots/current-real-app/mine.png`
- `docs/design/app-screenshots/current-real-app/dark/learning.png`
- `docs/design/app-screenshots/current-real-app/dark/detail.png`
- `docs/design/app-screenshots/current-real-app/dark/space.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`
- `docs/design/app-screenshots/current-real-app/dark/mine.png`
- `docs/agent-runs/2026-07-06-route-icon-chrome.md`: this run record.

## Commands run

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false --testNamePattern="renders correctly|mine page keeps profile status"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- `npm start -- --reset-cache` from `apps/mobile` -> started Metro for simulator validation.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed in light and dark.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/learning.png` -> saved light Learning screenshot.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/learning.png` -> saved dark Learning screenshot.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed in light and dark; screenshots saved to `detail.png` and `dark/detail.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed in light and dark; screenshots saved to `space.png` and `dark/space.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed in light and dark; screenshots saved to `space-browse.png` and `dark/space-browse.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` -> passed in light and dark; screenshots saved to `statistics.png` and `dark/statistics.png`.
- `maestro --device ... test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed in light and dark; screenshots saved to `mine.png` and `dark/mine.png`.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run design-metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 2 tests.
- Full mobile Jest: pass, 26 suites / 163 tests.
- Backend function tests: pass, 11 tests.
- Whitespace diff check: pass.
- Maestro selector validation: pass.
- Design metadata leak scan: pass.
- Mobile lint and typecheck: pass.
- Harness with and without remote guard: pass.
- Light real app screenshot flows: pass for Learning, detail, Space, Space browse, Statistics, and Mine.
- Dark real app screenshot flows: pass for Learning, detail, Space, Space browse, Statistics, and Mine.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: The route chrome now uses one shared icon language across phone tabs, tablet navigation, header pills, and Mine route actions. It does not introduce a second navigation pattern or a new dominant accent.
- Q2 Focal object: Learning still leads with the current card, Space with the current box desk, Statistics with today's record, and Mine with the account object. Icons are supporting chrome, not a competing content layer.
- Q3 Silhouette: The screenshots preserve the one-screen app shell and floating capsule silhouette from the accepted mobile core reset. No landing page, full-width tabbar, or scrolling navigation page was introduced.
- Q4 Forbidden patterns: Real light/dark screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or pseudo-icon badge text in route chrome.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the tab capsule, icon glyphs, Mine action cards, CTA rows, and safe-area bottom chrome fit without clipped labels, overlap, horizontal overflow, or bottom collision.
- Q6 Surface-specific: Learning remains system-sequenced and does not expose module selection as primary path. Statistics keeps tabular progress evidence. Flip self-assess remains exactly two states and was not changed.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Current real screenshots were inspected in light and dark; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Users now see a conventional icon-plus-label route shell instead of stacked single-character pseudo-icons.
- Mine route actions now match the same route icon language as the bottom navigation, improving perceived app coherence.
- No route behavior, auth flow, card content, membership state, or remote contract was changed.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: floating nav capsule -> `PhoneShell`; route icon language -> `RouteIcon`; tablet route sidebar/header -> `TabletShell` and `ShellHeader`; Mine account route actions -> `MineSurface` / `MineActionCard`; screenshot evidence -> current real app light/dark main-path screenshots.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing press handlers and route transitions are reused.
- Physical-space source: N/A for this implementation detail; Space product truth remains from `spec/knowledge-map.json` / `spec/space-operations.json`, but no spatial model behavior was changed.
- Learning microcopy basis: N/A; this run does not alter Learning task copy or card content.
- Unimplemented gap: Smaller phones, tablet screenshots, and dynamic type remain follow-up evidence; this run validated iPhone 17 Pro light/dark real app paths and iOS smoke.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The route icons are implemented as React Native view shapes rather than a third-party icon set because the mobile package has no icon dependency. Future design-system work may replace them with a formal icon library if the dependency is accepted.
- The glyphs are intentionally simple to reduce dependency and packaging risk; future polish can tune exact stroke geometry after tablet and smaller-phone screenshot review.

## Follow-up

- Continue checking user-visible one-screen quality page by page, with the next likely targets being smaller-device containment, tablet evidence, and remaining route-specific object controls.
