# Mobile Daylight Studio Implementation V1

## Task summary

Implement the accepted Daylight Studio baseline in the production React Native and Web surfaces, remove the black/grey wireframe-like hierarchy, and verify real iOS, Android, and Web use.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-daylight-studio-v1.md`
- `docs/design/mapping/mobile-daylight-studio-implementation-map-v1.md`
- `docs/design/interaction-motion/mobile-daylight-studio-motion-v1.md`

## Product truth used

- Learning remains the system-sequenced single-card primary flow.
- The five interaction families remain visually distinguishable; flip alone uses the mint/amber two-level self assessment.
- Library identity is stable and only the current library may dominate a task screen.
- Learning, Space, Statistics, Mine keep the canonical top-level order across targets.
- User-visible metadata, runtime, prototype, and development language is a blocker.

## Implementation hypothesis changed

- Adopted the accepted Daylight Studio brand violet, opaque white task surfaces, warm page background, coral current-reading identity, and restrained semantic colors.
- Scoped the current library tone to Learning instead of recoloring the global app chrome.
- Replaced dark-default Web styling and nested wireframe-like containers with a dedicated phone/tablet/desktop composition.

## Workspace boundary and read scope

- Worked only in the topic worktree `/private/tmp/softbook-mobile-visual-rebuild-v5.tKcUu4`.
- Did not modify the user's dirty `main` worktree or the external `card make` workspace.
- Read only the product, platform, interaction, visual, runtime, delivery, and accepted-design authorities required for this UI implementation.

## Files changed

- `apps/mobile/App.tsx`
- `apps/mobile/android/app/src/main/res/values/styles.xml`
- `apps/mobile/src/visual/tokens.ts`
- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/src/space/SpaceSurface.tsx`
- `apps/mobile/src/statistics/StatisticsSurface.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/App.test.tsx`
- `docs/agent-runs/2026-08-11-mobile-daylight-studio-implementation-v1.md`

## Commands run

- `cd apps/mobile && npm run lint -- --quiet`
- `cd apps/mobile && npm run typecheck`
- `cd apps/mobile && npm test -- --runInBand --watchAll=false`
- `cd apps/web && npm run lint`
- `cd apps/web && npm run typecheck`
- `cd apps/web && npm test`
- `cd apps/web && npm run build`
- Real browser interaction at 320/360/393/430/834/1366/1440 widths.
- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run android -- --device emulator-5554`
- `npm run ios -- --udid 791B24E8-F9F1-4447-8B3C-C0ED18039BFF`
- `/opt/homebrew/bin/maestro test --udid 791B24E8-F9F1-4447-8B3C-C0ED18039BFF e2e/maestro/ios-smoke.yaml`
- `/opt/homebrew/bin/maestro test --udid emulator-5554 e2e/maestro/ios-smoke.yaml`
- `python3 scripts/validate_harness.py --mode local`
- `node scripts/check_design_metadata_leaks.mjs`
- `./scripts/run_local_gates --profile dev --base origin/main --output exports/local-gates/mobile-daylight-studio-implementation-v1.json`

## Validation results

- Mobile lint/typecheck: Passed.
- Mobile Jest: 46 suites / 492 tests passed.
- Web lint/typecheck/build: Passed.
- Web Vitest: 2 files / 12 tests passed.
- Web browser: login, flip, two-level assessment, continuation, choice submission/result, four routes, and no horizontal overflow passed.
- iOS debug build/install/launch: Passed on iPhone 17 Pro simulator (iOS 26.4).
- Android debug build/install/launch: Passed on API 30 arm64 emulator with Android Studio JDK 21.
- iOS Maestro full user flow: Passed — auth, Space hierarchy, favorite/sleep/wake, all five card interactions, Statistics check-in, Mine and route continuity.
- Android Maestro full user flow: Passed with the same user journey; the iOS-only keyboard accessory step was optional and absent as expected.
- Native visual containment: Passed at standard iPhone size, Android 360dp, Android 320dp-equivalent narrow width, and iOS accessibility-large content size.
- Android system chrome: Passed after matching light status/navigation bars to the Daylight canvas.
- Android Space composition: Passed after removing the translucent elevated thumbnail combination that produced a grey compositor rectangle.
- Statistics compact layout: Passed after introducing an owned vertical scroll surface; no card overlap at 320dp.
- Mobile lint/typecheck: Passed after the final diff.
- Mobile Jest: 46 suites / 492 tests passed after the final diff.
- Web lint/typecheck/build: Passed after the final diff.
- Web Vitest: 2 files / 12 tests passed after the final diff.
- Harness local validation and design metadata leak scan: Passed.
- Local dev gates: `PASSED_WITH_EXCEPTION` (23/24); the only exception is the registered dev-only Node 25.9.0 vs expected 22.13.0 toolchain drift. All required executable gates passed.

## Agent review status

- Reviewer: Codex UI/UX director frozen-diff review
- Review status: Passed
- Blocking findings: None
- Review summary: P1 findings discovered during simulator review were fixed before freeze: nested auth/mine borders, Android grey system chrome, Android Space translucent-elevation compositor artifact, Statistics line-frame hierarchy, 320dp Statistics card overlap, and accessibility-size brand/metric wrapping. Final P0=0, P1=0, P2=0 for the changed surfaces.

## Design review checklist

- Q1 — Law of One: Learning binds the single strong task accent to the current library only. Global navigation, auth, Stats and Mine retain the stable brand violet; Space uses the selected/current library tone only inside its spatial object.
- Q2 — Focal path: Learning reads current card → task action → utility/navigation. Auth reads verification promise → phone field → obtain/submit action. Space reads address → box/card object → return-to-learning action. Stats reads today object → metrics → next action. Mine reads account continuity → continue-learning action → membership/supporting actions.
- Q3 — Canonical silhouettes: Learning remains one dominant card; Space preserves shelf/section/box/card hierarchy and Learning ↔ Space return continuity; Stats is a compact progress ledger rather than a competing dashboard; Mine is an account/continuity surface. No module picker replaces the learning path.
- Q4 — Forbidden patterns: no gradient text, serif display type, pure `#000`/`#fff` theme, gamification chrome, full-width tab bar, or removed self-assess semantics. The tab bar remains a floating capsule and opaque color surfaces replace glassy nested outlines.
- Q5 — Containment: real Web widths 320/360/393/430/834/1366/1440 had no horizontal overflow. Native checks covered iPhone 17 Pro, Android 360dp, Android 320dp-equivalent width, and iOS accessibility-large. Safe areas, system bars, CTA reachability and tab-bar containment passed.
- Q6 — Surface-specific: flip retains exactly `有把握` (mint) and `再回看` (amber); auto-scored families do not reuse self-assessment colors; Stats values use tabular numbers; Learning remains system-sequenced and exposes no module selection as its primary path.

## User-visible UI impact

- Removes system-dark black/grey defaults and the global current-library recoloring of chrome.
- Establishes a stable violet brand, white focal task, scoped library accent, clearer primary actions, floating navigation, and dedicated responsive Web layouts.
- Removes engineering-state copy such as development-build, wiring, and not-integrated language from Web UI.

## Card make external workspace impact

- None. Existing development card fixtures were consumed for interaction testing only; no candidate content was produced or approved.

## Risks and open questions

- Release signing, private production content, and external runtime deployment remain outside this UI implementation scope.
- The local dev gate records a declared development-only Node toolchain exception; CI uses the repository-pinned runtime and remains the merge authority.

## Follow up

- Commit the frozen diff, open the implementation PR, wait for required CI, then merge only after required checks and review remain green.
