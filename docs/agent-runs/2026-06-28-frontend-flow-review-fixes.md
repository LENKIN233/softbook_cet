# Agent Run Record: frontend flow review fixes

## Task summary

- Date: 2026-06-28
- Branch: `codex/fix-frontend-flow-review`
- PR: https://github.com/LENKIN233/softbook_cet/pull/259
- Summary: Fixed the frontend review blockers found after the app-flow quality review: Space now keeps Learning-to-Space continuity without overwriting manual card-list operations, Maestro smoke no longer scrolls to primary controls, and current real-app screenshots have a single non-stale handoff directory.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow with one current task and visible primary actions.
- Space is a physical library / group / box / card model and must preserve Learning-to-Space continuity.
- Space user operations include browsing box contents plus favorite and sleep state changes; favorite remains a tag and sleep remains a physical state, not a separate module picker.
- User-visible app evidence must not expose metadata, harness, mock, runtime, route, fixture, debug, repo, or raw id language.

## Implementation hypothesis changed

- `SpaceSurface` now has a follow-current selection mode for overview continuity and a manual mode for card-list browsing and card state operations.
- Maestro smoke flows assert primary controls are visible directly instead of using `scrollUntilVisible`.
- `validate_maestro_selectors.py` now rejects `scrollUntilVisible` in one-screen smoke flows.
- `docs/design/app-screenshots/current-real-app/` is the current real-app screenshot handoff path; older real-app captures are archived.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/e2e/maestro/*.yaml`, `scripts/validate_maestro_selectors.py`, `scripts/harness_validator/sections/delivery_runtime.py`, and current screenshot artifacts.
- Generated/dependency/cache/archive read: existing screenshot PNGs and previous agent-run artifacts were inspected only as evidence context, not as product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: syncs overview focus to the current learning card while preserving manual card-list browse/favorite/sleep operations.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: adds a regression for Space resyncing after `currentLearningCard` changes.
- `apps/mobile/e2e/maestro/ios-smoke.yaml`: strict one-screen smoke path with direct visibility assertions for primary actions.
- `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: same strict one-screen assertions for the remote smoke path.
- `scripts/validate_maestro_selectors.py`: rejects `scrollUntilVisible` in one-screen smoke flows.
- `scripts/harness_validator/sections/delivery_runtime.py`: adds the new validator regression expectation.
- `docs/design/app-screenshots/README.md`: defines the current real-app screenshot set and archive boundary.
- `docs/design/app-screenshots/current-real-app/*.png`: current real-app screenshot handoff set copied from simulator captures.
- `docs/design/app-screenshots/archive/**`: older screenshot sets moved out of the current handoff path.
- `docs/agent-runs/2026-06-28-frontend-flow-review-fixes.md`: records this run.

## Commands run

- `git fetch origin main && git switch -c codex/fix-frontend-flow-review origin/main` -> pass.
- `npm test -- SpaceSurface.test.tsx --runInBand` in `apps/mobile` -> pass.
- `npm test -- App.test.tsx --runInBand --testNamePattern="can move a card into sleep zone and remove it from learning flow"` in `apps/mobile` -> pass after narrowing Space sync.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 158 tests.
- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/*.png` -> all current screenshots are 1206 x 2622.
- `npm start -- --reset-cache` in `apps/mobile` -> Metro started for simulator smoke, then stopped after validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass after Metro was running.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 158 tests.
- Metadata leak scan: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Strict iOS Maestro smoke: pass with no `scrollUntilVisible` in the flow.
- Current screenshot dimensions: pass at 1206 x 2622.

## Design review checklist

- Q1 Law of One: Learning keeps one current card as the focal object; Space overview follows the current box; card-list operations stay in the selected box and do not introduce competing library accents.
- Q2 Focal object: the fixed Space continuity centers on the current box/card path, while manual card-list operations center on the selected card object.
- Q3 Silhouette: this change does not alter Learning interaction silhouettes; the smoke flow now verifies each primary action is directly visible in its existing silhouette.
- Q4 Forbidden patterns: no user-visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, or TODO copy was introduced; scans passed.
- Q5 Layout containment: strict Maestro smoke passed without `scrollUntilVisible`; current real-app screenshots remain 1206 x 2622.
- Q6 Surface-specific: flip self-assess remains two choices only; Space favorite remains a tag and sleep remains a card state operation.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code review, targeted regression tests, full mobile tests, harness validation, metadata scans, screenshot dimension checks, and strict iOS Maestro smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. This repairs Space interaction continuity and the evidence path used for real-app screenshots.
- Design source: accepted visual language and Learning/Space implementation mapping; no same-PR design artifact is used as implementation authority.
- Implementation mapping: Space overview follows current Learning position; Space card list preserves browse and state operations as the selected physical object context.
- Unimplemented gap: the current screenshot set covers auth, learning, space, and statistics; it does not add a new Mine screenshot.

## Card make external workspace impact

- N/A.

## Risks and open questions

- Older screenshot files remain under `docs/design/app-screenshots/archive/` for audit history only. They are intentionally no longer the current handoff source.

## Follow-up

- Open a PR to `main`, include this run record, and require normal review/gates before merge.
