# Agent Run Record: Mine one-screen frontend quality

## Task summary

- Date: 2026-06-28
- Branch: `codex/continue-frontend-quality`
- PR: N/A at record creation
- Summary: Continued the frontend quality rebuild by replacing the Mine surface's explanatory card stack with a compact one-screen personal center, adding real route actions, smoke coverage, and a real iOS simulator `mine.png` screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- The app is a CET4/6 preparation product built around a single-card Learning flow, physical Space, Statistics, and Mine.
- Login, membership/trial state, and user progress are app-level product surfaces, not explanatory design metadata.
- User-visible UI must not expose metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, or TODO language.
- The main mobile surfaces should operate as one-screen app flows; primary controls must be directly visible without scroll-dependent smoke paths.

## Implementation hypothesis changed

- Mine is now a one-screen personal center: profile state, four compact metrics, three real route actions, and a compressed membership access card.
- The old unreachable `RouteCanvas` and unused route explainer fields were removed so top-level routes cannot fall back to a visible "what this page does" explanation surface.
- Local and remote Maestro smoke flows now include Mine and end on Mine for screenshot capture.
- `docs/design/app-screenshots/current-real-app/mine.png` is part of the current real-app screenshot handoff set.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/e2e/maestro/*.yaml`, current screenshot docs, and previous frontend-flow run records.
- Generated/dependency/cache/archive read: existing simulator screenshots were inspected only as evidence context, not as product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/App.tsx`: removes route explainer fallback, rewrites Mine into a compact one-screen personal center, adds Mine route actions, and compresses membership access display.
- `apps/mobile/__tests__/App.test.tsx`: updates Mine regressions for compact status, action navigation, and removal of old explanatory copy.
- `apps/mobile/e2e/maestro/ios-smoke.yaml`: adds Mine visibility and action coverage to strict local iOS smoke.
- `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: mirrors Mine coverage in remote smoke.
- `docs/design/app-screenshots/README.md`: adds `current-real-app/mine.png` to the current real-app screenshot set.
- `docs/design/app-screenshots/current-real-app/mine.png`: real iOS simulator Mine screenshot from the current app.
- `docs/agent-runs/artifacts/2026-06-28-mine-one-screen-app-flow-simulator.png`: source simulator capture for the Mine screenshot.
- `docs/agent-runs/2026-06-28-mine-one-screen-frontend-quality.md`: records this run.

## Commands run

- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 158 tests.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `npm start -- --reset-cache` in `apps/mobile` -> Metro started for simulator validation and screenshot capture.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass twice; the second run ended on Mine for screenshot capture.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-06-28-mine-one-screen-app-flow-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/mine.png`.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 158 tests.
- Metadata leak scan: pass through `npm test` pretest.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Strict iOS Maestro smoke: pass with Mine coverage and no `scrollUntilVisible`.
- Real Mine screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622.

## Design review checklist

- Q1 Law of One: Mine now centers on one personal status surface instead of three explanatory panels.
- Q2 Focal object: the profile block and three route actions make the user's current study state the focal object.
- Q3 Silhouette: Mine uses a profile header, compact metric strip, route action cards, and membership access strip, matching a mobile app personal center rather than a long document page.
- Q4 Forbidden patterns: no user-visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, or TODO copy was introduced; scans passed.
- Q5 Layout containment: Mine smoke asserts the profile card, three route actions, and membership card are directly visible; real screenshot confirms one-screen containment.
- Q6 Surface-specific: Learning self-assess remains two choices; Space favorite remains a tag and sleep remains a card state operation. This change does not alter those surfaces.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code review, full mobile tests, metadata scans, harness validation, selector validation, strict iOS Maestro smoke, and real simulator screenshot inspection.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Mine is now a real one-screen app surface with route actions and compact personal state instead of a vertical explanation page.
- Design source: `spec/visual-language.json`, `docs/design/visual-reference.html`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: Mine consumes the same shell/navigation model as Learning, Space, and Statistics; route actions map to current Learning, Space overview, and Statistics.
- Unimplemented gap: this run does not redesign Statistics beyond smoke coverage; Statistics still deserves a later density pass.

## Card make external workspace impact

- N/A.

## Risks and open questions

- Mine is now covered in local and remote smoke YAML, but only the local iOS smoke was executed in this run.

## Follow-up

- Open a PR to `main`, include this run record, and require normal review/gates before merge.
