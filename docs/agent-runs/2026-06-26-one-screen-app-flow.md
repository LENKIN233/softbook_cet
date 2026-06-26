# Agent Run Record: one-screen app flow

## Task summary

- Date: 2026-06-26
- Branch: `fix/one-screen-app-flow`
- PR: N/A
- Summary: Reworked Learning and Space from vertically stacked surfaces into operable one-screen app flows. Learning keeps dense interaction types inside the current-card surface without bottom-tab collisions. Space uses an overview-to-card-list flow where the overview focuses on the current box and the list screen handles browse, favorite, and sleep actions.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/requirement-memory.json` and `spec/product-core.json` keep Learning as a single-card flow, not a scroll-first lesson page.
- `spec/interactions.json` keeps interaction choices and self-assessment as current-card actions, not separate content sections.
- `spec/knowledge-map.json` and `spec/space-operations.json` keep Space as a physical current-position model with shelf, box, cards, favorite, and sleep states.
- `spec/visual-language.json` requires user-facing screens to inherit the accepted visual language and makes operability part of the single-card flow: a primary action must not require a page-length scroll.
- Accepted mapping artifacts keep Learning's current object / action plane and Space's shelf / current box / card-list mapping as the implementation basis.

## Implementation hypothesis changed

- Learning current-card screens now render as a fixed one-screen surface instead of resetting and depending on an outer vertical `ScrollView`.
- Flip support, result summary, and result detail are contained within one-screen states; result state hides non-primary dock actions.
- Dense Learning interaction types (`lock`, `elimination`, `swipe`) hide auxiliary context/dock content and use compact controls so choices and submit remain above the bottom tab bar.
- Space overview keeps the address shelf, current box, current card hint, list entry, and return-to-learning affordance in one screen.
- Space card list is a second screen with one current card, pager controls, compact library/group/box selectors, and inline favorite/sleep actions.
- Maestro smoke flows now follow the app flow: unlock trial, enter Space list, operate current card actions, then return to Learning.

## Workspace boundary and read scope

- Active source read: `AGENTS.md`, task-relevant specs listed above, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/space/SpaceSurface.tsx`, mobile Jest tests, and Maestro smoke flows.
- Generated/dependency/cache/archive read: none as product truth.
- External workspace read: none. No candidate card content was created, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: one-screen current-card layout, compact dense interactions, result/detail containment, and dock visibility rules.
- `apps/mobile/src/space/SpaceSurface.tsx`: one-screen Space overview, compact card-list screen, inline sleep/favorite actions, and one-card pager behavior.
- `apps/mobile/__tests__/App.test.tsx`: updated expectations for one-screen Space list and inline sleep recovery.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: moved selector ID assertions to the card-list layer.
- `apps/mobile/e2e/maestro/ios-smoke.yaml` and `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: updated smoke flow to avoid scroll-first Space operations and use anonymous id selectors only.
- `docs/design/app-screenshots/one-screen-app-flow/*.png`: refreshed real iOS simulator screenshots from the current app.
- `docs/agent-runs/2026-06-26-one-screen-app-flow.md`: recorded this run.

## Real app screenshots

- `docs/design/app-screenshots/one-screen-app-flow/learning.png`
- `docs/design/app-screenshots/one-screen-app-flow/learning-result.png`
- `docs/design/app-screenshots/one-screen-app-flow/learning-detail.png`
- `docs/design/app-screenshots/one-screen-app-flow/space-overview.png`
- `docs/design/app-screenshots/one-screen-app-flow/space-card-list.png`

All five screenshots were captured by Maestro from the iOS simulator running `com.softbook.cet`; they are not mock images.

## Commands run

- `npm run typecheck -- --pretty false` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm test -- --watch=false` in `apps/mobile` -> 26 suites passed, 156 tests passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_maestro_selectors.py` -> `MAESTRO SELECTOR VALIDATION OK`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `git diff --check` -> pass.
- `maestro test /tmp/softbook-one-screen-screenshots.yaml` -> pass; generated the real app screenshot set.
- `maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> pass after one-screen dense-interaction fixes.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass.
- User-visible metadata leak scan: pass.
- Design metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- Git whitespace check: pass.
- Real iOS app screenshot capture: pass.
- Real iOS smoke: pass.

## Design review checklist

- Q1 Law of One: Learning focuses each screen on the current card state; Space overview focuses on the current box as the spatial object.
- Q2 Focal object: Primary actions are visible in one screen: flip/result actions in Learning, list entry and current card controls in Space.
- Q3 Silhouette: Removed the long stacked-page silhouette from Space and from dense Learning interactions; card list and overview are separate app states.
- Q4 Forbidden patterns: No visible raw metadata, harness, mock, route, fixture, or internal debug language introduced.
- Q5 Layout containment: Verified with 1206 x 2622 iOS simulator screenshots. Dense Learning interactions no longer tap through to the bottom tab bar.
- Q6 Surface-specific: Flip self-assess remains two-state `有把握` / `再回看`; this change does not introduce four-state feedback or red error semantics.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual review, real iOS smoke, full test validation, and metadata leak scans.
- Blocking findings: none known.

## PR gate evidence mirror

- Design artifact: `docs/design/mocks/learning-card-rhythm-v1.md` and `docs/design/mocks/space-surface-shelf-desk-v1.md`.
- Implementation mapping: `docs/design/mapping/learning-space-implementation-map-v1.md` mapped to `apps/mobile/src/learning/LearningSurface.tsx` and `apps/mobile/src/space/SpaceSurface.tsx`.
- Interaction/motion artifact: `docs/design/interaction-motion/learning-card-rhythm-v1.md`.
- Physical space artifact: `docs/design/physical-space/space-state-baseline-v1.md`.
- Unimplemented design gaps: no new native navigation or animation framework was added in this scoped fix; existing shell state handles the one-screen flow.
- Learning microcopy basis: design-backed product correction for one-screen operability; no hard leak introduced and metadata leak scans passed.
- Universal Q1-Q4: Law of One/current library is preserved through one dominant current-card or current-box state; focal object/first-read path is current card -> action/result and Space address -> current box -> list; interaction silhouette is no longer a long stacked page; forbidden patterns/no forbidden metadata, mock, harness, route, fixture, or debug language introduced.
- Conditional Q5-Q6: Q5 phone viewport/safe-area containment verified on 1206 x 2622 screenshots with no overflow into bottom tab; Q6 learning/flip self-assess remains two-state and Space stays a physical current-box surface.
- AP-22: AP-22 pre-render proof is the committed real app screenshot set in `docs/design/app-screenshots/one-screen-app-flow/` plus the answered six questions in the design review checklist.
- AP-23: AP-23 policy is preserved: flip self-assess remains two states, `有把握` uses mint/confident semantics and `再回看` uses amber/review semantics.

## User visible UI impact

- Yes. This is a user-facing Learning and Space interaction/layout change.
- Design source: accepted visual language plus existing Learning/Space implementation mapping and interaction-motion artifacts listed above.
- Interaction/motion artifact: existing Learning card rhythm and Space physical-state baseline; no new motion language introduced.
- Implementation mapping: current-card dense interactions and Space card operations now map to operable one-screen app states instead of scroll-dependent page sections.
- Unimplemented gap: no new native navigation library or animation system was introduced; this stays within the current shell.

## Risks and open questions

- The remote Maestro smoke was syntax-updated but not run against a remote backend in this local pass.
- The one-screen strategy intentionally suppresses auxiliary Learning dock actions on dense interaction types; those actions remain available on the flip/current-card state.
