# Agent Run Record: space browse rail polish

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/space-browse-rail-polish`
- PR: N/A
- Summary: Refined the real app Space box-inspection layer so the library / group / box selector no longer reads as wide guide rails and the return-to-Learning controls remain clear of the floating tab bar.

## Referenced specs

- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product truth used

- Space must preserve library -> group -> box -> card hierarchy and cannot collapse into a flat card list.
- Favorite remains a tag attached to a card; sleep remains a spatial state under the owning container.
- Returning from Space to Learning must preserve the user's sense that the card and address are the same object.

## Implementation hypothesis changed

- Before: the card-list layer used three full-width selector rails, and the bottom continuity actions could visually collide with the floating tab bar.
- After: Space keeps the same hierarchy and test IDs, but the selector is a compact shelf control with group and box on one row; the card and continuity controls are compressed enough to fit within the phone proof.

## Workspace boundary and read scope

- Active truth/source read: `spec/knowledge-map.json`, `spec/space-operations.json`, `spec/box-catalog.json`, `spec/visual-language.json`, `docs/design/physical-space/space-model-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.md`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`, `docs/design/app-screenshots/current-real-app/space-browse.png`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: reworked the Space card-list selector from wide rails into a compact shelf control and reduced card-list vertical pressure so continuity controls stay visible.
- `docs/agent-runs/artifacts/2026-07-01-space-browse-rail-polish-simulator.png`: real iPhone 17 Pro simulator screenshot after the change.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real-app screenshot.
- `docs/agent-runs/2026-07-01-space-browse-rail-polish.md`: this run record.

## Commands run

- `npm test -- --runInBand --watchAll=false __tests__/SpaceSurface.test.tsx` in `apps/mobile` -> passed, 7 tests.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npx prettier --write src/space/SpaceSurface.tsx` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-space-browse-rail-polish-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-space-browse-rail-polish-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-space-browse-rail-polish-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan && npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check && python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_browse_rail_polish_pr_body.md --changed-file apps/mobile/src/space/SpaceSurface.tsx --changed-file docs/agent-runs/2026-07-01-space-browse-rail-polish.md --changed-file docs/agent-runs/artifacts/2026-07-01-space-browse-rail-polish-simulator.png --changed-file docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_browse_rail_polish_pr_body.md` -> passed.

## Validation results

- Focused Space tests passed and preserved anonymous ordered selector IDs.
- Full mobile Jest, typecheck, lint, metadata scanners, backend contract tests, harness validation, screenshot flow, and iOS smoke passed.
- Real simulator screenshot confirms the compact selector no longer renders as three long rails, and the Space continuity actions are not clipped by the floating tab bar.
- PR body gates passed: design gate and agent review gate.
- CI: pending.

## Design review checklist

- Universal Q1-Q4: passed. The current library remains the only strong accent; the focal object remains current box -> contained card -> continuity controls; Space keeps its hierarchy silhouette; no forbidden flat list or internal metadata copy was introduced.
- Conditional Q5-Q6: passed. The phone screenshot proves 1206 x 2622 containment with no clipped return CTA or tab-bar collision; this is Space-only and does not alter Learning's sequence, stats numerals, or self-assess.
- AP-22: passed. Physical-space artifacts were read before implementation, and the change preserves hierarchy, current box focus, contained cards, favorite tag semantics, sleep state, and Learning continuity.
- AP-23: N/A. No self-assess UI changed; the two-state 有把握=mint / 再回看=amber policy is untouched.

## Agent review status

- Reviewer: Codex
- Status: passed local review and PR body gate; pending CI.
- Blocking findings: none so far.

## User-visible UI impact

- Space box inspection now feels more like a compact app control surface and less like a set of guide/reference lines. Bottom continuity actions remain visible above the floating navigation.

## Card make external workspace impact

- None. This task did not read or write `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change is layout-only and does not alter Space data, operations, or card content.

## Follow-up

- Continue reviewing real app screenshots for states where one-screen containment or object continuity still breaks.
