# Agent Run Record: app interaction architecture

## Task summary

- Date: 2026-06-26
- Branch: `fix/app-interaction-architecture`
- PR: N/A
- Summary: Changed the mobile app from route-level demo composition toward explicit app flows: Learning now has a separate result detail screen, Space now has an overview-to-card-list flow, and protected trial entry no longer starts as a route side effect.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/product-core.json` keeps the core product as an operable single-card CET flow with Learning and Space continuity, not a generic page demo or dense dashboard.
- `spec/action-surface.json` and `spec/interactions.json` require current-card actions to remain explicit and bounded; result feedback should support the next learning step rather than becoming passive inline copy.
- `spec/knowledge-map.json` and `spec/space-operations.json` keep Space as a physical hierarchy with current position, contained cards, favorite tags, and sleep state.
- `spec/membership.json` keeps trial and membership transitions as access decisions. Entering a route should not silently consume the user's trial.
- `spec/visual-language.json#product_truth.single_card_flow_is_operable_focused_flow` requires a focused current-card task with primary action, feedback, recovery, and Learning to Space continuity.
- `spec/visual-language.json#product_truth.user_facing_ui_requires_design_artifact` is satisfied by the existing accepted visual anchor and `docs/design/mapping/learning-space-implementation-map-v1.md`; this PR maps existing implementation surfaces into clearer app flow without creating a new visual direction.

## Implementation hypothesis changed

- Added explicit app sub-screen state in `App.tsx`: Learning uses `practice` and `result_detail`; Space uses `overview` and `card_list`.
- Removed route-side-effect trial starts from first Space entry and gated Review entry. The user now sees the relevant gate and must press the membership action before trial starts.
- Learning's completed-card state now settles on the practice screen with `查看解析` and `继续下一张`; the full analysis lives on a separate `LearningResultDetailSurface`.
- Space overview now keeps the physical position and rules as the first read, with a `查看列表` entry; card actions and sleep/favorite controls move to the card-list sub-screen.
- Maestro smoke flows now follow the explicit trial and card-list entry flow and use currently supported anonymous test IDs.

## Workspace boundary and read scope

- Active source read: `AGENTS.md`, task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/space/SpaceSurface.tsx`, mobile Jest tests, and Maestro smoke flows.
- Generated/dependency/cache/archive read: none for product truth. Existing simulator screenshots were inspected only as prior artifact context.
- External workspace read: none.

## Files changed

- `apps/mobile/App.tsx`: added Learning/Space sub-screen state, removed auto-start trial side effects, wired result detail and card-list navigation.
- `apps/mobile/src/learning/LearningSurface.tsx`: added result summary, separate result detail surface, and local secondary button styles.
- `apps/mobile/src/space/SpaceSurface.tsx`: added `overview` / `card_list` screen prop and moved card-list/sleep operations behind an explicit list entry.
- `apps/mobile/__tests__/App.test.tsx`: updated app-flow tests for explicit trial entry, result/list behavior, and unlocked review coverage.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: marked direct card-list fixture tests with `screen="card_list"`.
- `apps/mobile/e2e/maestro/ios-smoke.yaml` and `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: updated selectors and explicit trial/list steps.
- `docs/design/app-screenshots/leadership-real-app-v2/{home,detail,space,card-list}.png`: refreshed real iOS simulator screenshots from the current app.
- `docs/agent-runs/2026-06-26-app-interaction-architecture.md`: recorded this run.

## Real app screenshots

- `docs/design/app-screenshots/leadership-real-app-v2/home.png`
- `docs/design/app-screenshots/leadership-real-app-v2/detail.png`
- `docs/design/app-screenshots/leadership-real-app-v2/space.png`
- `docs/design/app-screenshots/leadership-real-app-v2/card-list.png`

All four screenshots are real iOS simulator screenshots from the app after this interaction change.

## Commands run

- `git switch -c fix/app-interaction-architecture origin/main` -> success.
- `npm run typecheck -- --pretty false` in `apps/mobile` -> pass.
- `npm test -- --runTestsByPath __tests__/App.test.tsx __tests__/LearningSurface.test.tsx __tests__/SpaceSurface.test.tsx --watch=false` in `apps/mobile` -> 51 tests passed.
- `npm test -- --watch=false` in `apps/mobile` -> 26 suites passed, 156 tests passed.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run metadata-leak-scan` in `apps/mobile` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_maestro_selectors.py` -> `MAESTRO SELECTOR VALIDATION OK`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `git diff --check` -> pass.
- `npm start -- --reset-cache` in `apps/mobile` -> Metro started.
- `npm run ios -- --simulator "iPhone 17 Pro"` in `apps/mobile` -> app built, installed, and launched.
- `maestro test /tmp/softbook-interaction-screenshots.yaml` -> blocked by missing Java Runtime on this machine.
- `brew install cliclick` -> installed local pointer automation helper for simulator operation.
- `xcrun simctl io booted screenshot ...` plus simulator pointer input -> captured four real screenshots at 1206 x 2622.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass.
- User-visible metadata leak scan: pass.
- Design metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- Git whitespace check: pass.
- Real app screenshot verification: pass for home, result detail, Space overview, and Space card-list screens.

## Design review checklist

- Q1 Law of One: Learning detail uses the result tone as the only dominant state accent; Space keeps the current library tone as the spatial accent.
- Q2 Focal object: Learning reads current card -> result summary -> explicit analysis detail; Space reads current position -> current box -> explicit card list.
- Q3 Silhouette: Learning no longer reads as one long poster after completion; result detail is a separate app screen. Space no longer reads as a flat card dump in the overview.
- Q4 Forbidden patterns: No new visible metadata, mock, fixture, harness, raw route, or debug language introduced.
- Q5 Layout containment: Verified on 1206 x 2622 simulator screenshots. Primary controls remain inside their surfaces.
- Q6 Surface-specific: Flip self-assess remains two-state `有把握` / `再回看`; this change does not introduce four-state feedback or red error semantics.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code review and full validation.
- Blocking findings: none known.

## User visible UI impact

- Yes. Learning result detail and Space card-list entry are user-visible flow changes.
- Design source: existing accepted visual language and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Interaction/motion artifact: this is a navigation/state-flow correction using existing accepted interaction surfaces; no new motion language introduced.
- Implementation mapping: explicit app sub-screens now map the accepted Learning and Space surfaces to operable app flows.
- Unimplemented gap: no new native navigation library was introduced; this keeps the scope small and preserves the existing shell.

## Card make external workspace impact

- None. This change does not read, create, approve, or modify candidate card content in `/Users/lenkin/programing/card make`.

## Risks and open questions

- Maestro itself could not run because Java Runtime is missing locally. Selector validation passed, and screenshots were captured through the installed simulator with `xcrun simctl`.
- `cliclick` was installed with Homebrew to operate the simulator because Maestro was unavailable.
- Remote smoke assumes trial entry is available in the remote membership fixture. If that remote fixture changes to premium, the remote flow may need a conditional variant.

## Follow up

- After PR review, merge and fast-forward the design quarantine mirror if needed.
- Consider replacing the local route/sub-screen state with a formal navigation stack only if the app adds deep links or back-stack restoration.
