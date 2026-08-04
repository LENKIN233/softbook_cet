# Agent Run Record: Mobile cross-platform containment

## Task summary

- Date: 2026-08-04
- Branch: `fix/mobile-cross-platform-containment`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/479`
- Summary: Corrects the shared React Native Mine layout that allowed the expanded Learning shortcut metadata to cross its rounded card boundary on standard iOS and Android phone viewports. The change preserves the full expansion on tablet-sized viewports and was exercised through real native builds and the complete shared mobile flow on both platforms.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`

## Product truth used

- iOS and Android share the same phone product structure and top-level Learning / Space / Statistics / Mine navigation.
- Mine remains a quiet account object that supports Learning rather than becoming the product center.
- A phone rendering must respect safe area and contain text, CTA, and floating navigation inside their intended surfaces.
- Membership, learning progress, review state, favorite state, and sleep state semantics are unchanged by this presentation-only correction.

## Implementation hypothesis changed

- The old compact threshold only adapted Mine at `<= 340dp` width or `<= 720dp` height, leaving standard 393–412dp phones on the tablet-like expanded composition.
- Standard phone viewports now use a bounded primary Learning shortcut: it retains its header, next-step copy, and central current action, while removing the three repeated metadata pills already represented by the account continuity and metric strips above it.
- Very small phones retain the existing compact composition, and tablet-sized viewports retain the expanded metadata row.
- Mine route cards now enforce their rounded visual boundary with `overflow: hidden`; intrinsic phone content has first been reduced to fit, so the boundary does not hide required actions.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and accepted design artifacts; `apps/mobile/App.tsx`; `apps/mobile/__tests__/App.test.tsx`; the shared Maestro mobile flow; existing small-screen Mine/Learning run records.
- Generated/dependency/cache/archive read: local `node_modules`, CocoaPods output, iOS DerivedData, Android Gradle output, simulator/emulator screenshots, JUnit output, and native build logs were used only for validation and were not treated as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` and its candidate/approval content were not read or changed.

## Files changed

- `apps/mobile/App.tsx`: adds standard-phone Mine containment selection, bounds the phone Learning shortcut, removes repeated phone-only metadata, and enforces the rounded action-card boundary.
- `apps/mobile/__tests__/App.test.tsx`: locks the standard iOS/Android phone viewport classification while preserving compact and tablet boundaries.
- `docs/agent-runs/2026-08-04-mobile-cross-platform-containment.md`: records authority, implementation mapping, real-device-class validation, review, and remaining risks.

## Commands run

- `npm ci` in `apps/mobile` -> completed from the exact `origin/main` worktree.
- `PATH=/opt/homebrew/opt/ruby@3.3/bin:$PATH bundle install` -> completed.
- `PATH=/opt/homebrew/opt/ruby@3.3/bin:$PATH bundle exec pod install` in `apps/mobile/ios` -> completed, 84 dependencies / 83 pods.
- `npm run typecheck` -> passed.
- `npm test -- --runInBand __tests__/App.test.tsx` -> passed, 70 tests.
- `npm test -- --runInBand --watchAll=false` -> passed, 45 suites / 436 tests.
- `npm run lint -- --quiet && npm run typecheck && npm run metadata-leak-scan && npm run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK`.
- `npm run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED --no-packager` -> real iOS Debug build, install, and launch passed on iPhone 17 Pro / iOS 26.5.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` -> passed the complete login, Space, five-interaction Learning, completion, Statistics, check-in, and Mine flow in 45 seconds after simulator keychain reset.
- `npm run android -- --no-packager` with JDK 17 / Android SDK -> real Android Debug build, install, and launch passed on the 1080x2340 / 440dpi Android 11 emulator.
- `maestro --device emulator-5554 test e2e/maestro/ios-smoke.yaml` -> passed the same complete shared flow in 89 seconds.
- Additional Android route captures for Statistics and Space -> visually inspected for rounded-border containment, CTA separation, and floating navigation separation.

## Validation results

- Shared code quality, TypeScript, metadata scans, 45 mobile test suites / 436 tests, and the full repository harness passed.
- iOS real native flow passed and the final Mine screenshot showed the Learning shortcut header, current action, and helper label entirely inside its dark rounded card.
- Android real native flow passed and the final Mine screenshot showed the same bounded composition; the previous metadata-pill spill below the card was absent.
- Android Statistics and Space screenshots showed no child crossing the main surface, action card, or bottom navigation bounds at the tested 393dp-class viewport.
- The first iOS Maestro attempt started from a previously authenticated Keychain session, so its signed-out selector correctly failed; the simulator keychain was reset and the complete clean-state flow then passed. This was an environment-state retry, not an app regression.

## Binary evidence

- Evidence manifest: N/A. Generated screenshots and JUnit files are local validation evidence and are not committed as ordinary Git content.
- Archive: N/A.
- Local screenshot references: `/Users/lenkin/.codex/visualizations/2026/08/04/mobile-ui-containment/ios-mine-fixed.png` and `/Users/lenkin/.codex/visualizations/2026/08/04/mobile-ui-containment/android-mine-fixed.png`.

## Agent review status

- Reviewer: Codex exact-head UI implementation review of `d9658a4ac506ee4098c19fe174de212ff90f7a7e`.
- Status: passed.
- Blocking findings: none.
- Review summary: the phone predicate covers the reproduced 393–412dp viewport class while preserving the existing compact override and the tablet expansion; the intrinsic phone card height, typography, and hidden duplicate metadata remove the overflow cause before `overflow: hidden` enforces the rounded boundary. Route actions, accessibility roles, user-visible copy, membership behavior, Learning behavior, Space behavior, and tablet content remain unchanged. Unit coverage and the native iOS/Android evidence exercise both the classification and rendered result.

## User-visible UI impact

- Yes. Standard iOS and Android phones now keep the Mine Learning shortcut fully inside its rounded dark card. Repeated metadata pills are omitted on phones because the same values are already visible in the account continuity and metric strips; the main route action remains explicit and tappable.
- Accepted design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` Mine account object -> `MineSurface`; route continuity -> `MineActionCard`; floating phone chrome -> `PhoneShell`.
- Interaction/motion artifact: N/A. No interaction behavior, feedback, transition, or motion timing changed.
- Physical-space artifact: N/A. Space semantics and spatial composition were not changed; Space was only included in regression validation.
- Unimplemented design gaps: physical-device screenshots, dynamic-type stress, dark appearance, landscape, and all membership error/recovery variants remain outside this focused correction.

## Design review checklist

- Q1 Law of One: Mine stays neutral; no new library accent or competing strong color is introduced.
- Q2 Focal object: the account object remains first read, followed by the bounded Learning shortcut, secondary routes, membership state, and floating chrome.
- Q3 Silhouette: the accepted Mine account-object composition is preserved. The change removes repeated phone metadata instead of creating a new dashboard or interaction shape.
- Q4 Forbidden patterns: no gradient title, achievement chrome, full-width bottom bar, serif type, removed self-assess token, or user-visible internal metadata is introduced.
- Q5 Phone containment: real 393dp-class iOS and Android screenshots show the dark Learning shortcut, secondary cards, membership CTA, safe area, and floating navigation inside their intended bounds.
- Q6 Surface-specific: Mine remains subordinate to Learning; Statistics remains tabular and quiet; flip self-assessment remains exactly `有把握` / `再回看` and was unchanged.
- AP-22 / VL-AP-07: all six questions are answered above, and both native phone platforms were rendered and visually inspected.

## Card make external workspace impact

- N/A. No card content, payload, approval, import, audio asset, or sibling workspace file changed.

## Risks and open questions

- Validation used simulators/emulators rather than physical iOS and Android handsets.
- The Android flow still produced one pending-review result from the existing shared fixture path; this pre-existing business-state parity issue is not caused by the layout patch and remains outside this UI containment scope.
- This run does not establish production SMS, CloudBase, payment, audio, or launch readiness.

## Follow-up

- Complete required GitHub checks, mark PR #479 ready, and merge the focused fix into `main`.
- Add dedicated dynamic-type, dark-mode, landscape, and physical-device visual evidence before broader mobile UI acceptance.
