# Learning swipe gesture implementation

## Scope

- Branch: `module/learning-swipe-gesture`
- Base dependency: `fix/android-learning-small-screen` / PR #461
- Product surface: mobile Learning `swipe` interaction on iOS and Android
- Card/content scope: none; no candidate card, approved payload, audio asset, or CloudBase data changed

## Referenced authority

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth and implementation hypothesis

- Product truth: swipe is one of the five core interaction families, uses exactly one visible top card with left/right trails, is auto-scored, and keeps audio/hint as attached resources rather than new interaction families.
- Product truth: an ambiguous or cancelled drag returns to neutral without recording an answer; reduce-motion users retain a discrete left/right path.
- User-authorized threshold: distance at or above 25% of the measured top-card width commits the directional answer.
- Implementation hypothesis: absolute velocity at or above `0.65` commits in the velocity direction; successful travel settles over 220ms with at most five degrees of rotation, while cancelled travel uses a restrained spring. These values may be tuned without changing the interaction contract.

## Implementation

- Added a `PanResponder`-driven horizontal gesture to the existing swipe card silhouette.
- Drag follows the pointer; horizontal intent must exceed 8px and dominate vertical motion before the responder activates.
- Release uses a pure threshold resolver. A committed gesture travels out, records the two-state selection, and immediately enters the existing auto-scored result surface. An ambiguous drag snaps back and records nothing.
- Direction buttons remain available as 44px accessible alternatives and now resolve the answer directly. The top card exposes an `adjustable` accessibility role with increment/decrement actions.
- `AccessibilityInfo.reduceMotionChanged` disables travel and commits discrete actions immediately.
- Updated local and remote Maestro flows so swipe no longer requires a redundant submit-button tap.
- Aligned `react` and `react-test-renderer` to the `19.2.3` renderer embedded by React Native `0.85.2`; native Animated otherwise fails at runtime on the former `19.2.7` mismatch.

## Validation

- `cd apps/mobile && npm test -- --runInBand __tests__/LearningSurface.test.tsx __tests__/App.test.tsx`: passed, 74/74.
- `cd apps/mobile && npm test -- --runInBand --watchAll=false`: passed, 43 suites / 402 tests.
- `cd apps/mobile && npm run typecheck`: passed.
- `cd apps/mobile && npm run lint -- --quiet`: passed.
- `cd apps/mobile && node ../../scripts/validate_dependency_security.mjs`: passed, zero known vulnerabilities in mobile and CloudBase API targets.
- `cd infra/cloudbase/functions/softbook-api && npm ci && npm test`: passed, 170/170.
- `python3 scripts/validate_harness.py --skip-remote-guard --format text`: passed; completeness is partial until PR #460 lands the authoritative `android-release` expected context.
- `python3 scripts/validate_maestro_selectors.py`: passed.
- Android JDK 17 `:app:compileDebugKotlin`: passed with explicit local SDK/JDK paths; dependency deprecation warnings remain non-blocking.
- `git diff --check`: passed.

## Agent review status

- Reviewer: Codex implementation and evidence review.
- Status: Passed for the repository implementation scope.
- Blocking findings: None.
- Review summary: threshold direction, snapback, direct auto-scoring, reduce-motion, accessible alternate paths, compact layout, dependency alignment, E2E selectors, and cross-surface regressions were checked. No card-authoring or release-readiness claim is introduced.

## User-visible UI impact and implementation mapping

- Accepted design source: `docs/design/interaction-motion/learning-core-interactions-v1.md` and `docs/design/interaction-motion/learning-card-rhythm-v1.md`.
- Existing rendered/design source: `docs/design/decisions/learning-card-rhythm-decision-v1.md` and `docs/design/mocks/learning-card-rhythm-v1.md`.
- Implementation mapping: current swipe silhouette in `apps/mobile/src/learning/LearningSurface.tsx`; atomic auto-score handoff in `apps/mobile/App.tsx`; stable selector flow in `apps/mobile/e2e/maestro/ios-smoke.yaml` and `ios-remote-smoke.yaml` (the Android remote flow reuses the latter).
- Unimplemented gaps: current evidence is unit/native-compile evidence, not a physical-device gesture or reduce-motion visual pass. Dynamic font, 320dp full-flow, Android/iOS physical-device drag, and screen-reader operation remain beta acceptance work.

## Design review checklist

- Q1 Law of One/current library: the current card retains its library-derived accent; drag adds no new accent family.
- Q2 focal object/first-read path: the addressed top card remains focal, the left/right trails are secondary, and Learning chrome remains tertiary.
- Q3 interaction silhouette: the implementation preserves `single_top_card_with_left_right_trails`; horizontal motion becomes the primary affordance without introducing a new card type.
- Q4 forbidden design patterns: no forbidden gradient text, gamification chrome, reward burst, full-width tab bar, pure black/white, serif, raw metadata, or self-assess token change is introduced.
- Q5 containment: the existing accepted 320dp compact layout and 44px trail targets are preserved; no new horizontal layout width is introduced. Physical-device containment evidence remains pending.
- Q6 Learning-specific: Learning remains system-sequenced; swipe stays auto-scored and does not inherit flip's mint/amber self-assess pills.
- AP-22 pre-render proof: the six answers above bind implementation to the previously accepted Learning rhythm mock and motion artifacts rather than a same-PR design invention.
- AP-23: flip remains exactly `有把握` / `再回看`; this change touches only auto-scored swipe.

## Release non-claims

- This run does not prove Android/iOS physical-device gesture quality.
- It does not complete Mine 320dp, final CET4 content quality, 301-item perceptual audio QC, receiver CloudBase rehearsal, signing, or launch readiness.
- The branch must be rebased onto `main` after PR #461 and the Android Release gate land, then pass full required checks before merge.
