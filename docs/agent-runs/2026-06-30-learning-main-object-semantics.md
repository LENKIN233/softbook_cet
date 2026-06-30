# Agent Run Record: Learning main object semantics

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/learning-main-object-semantics`
- PR: https://github.com/LENKIN233/softbook_cet/pull/276
- Summary: Continued the user-visible mobile app quality reset by tightening the real Learning main screen around one current card object. This pass reduces status-chip noise, fixes the clipped progress affordance found in simulator review, makes multiple-choice selection read as an active operation instead of warning/error feedback, and refreshes the current real app Learning screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains a system-sequenced single-card flow, not a dashboard, report page, module picker, or scrolling page stack.
- The focal object is the current CET card. Secondary status, address, support tools, and navigation stay lower weight than the current task.
- Multiple-choice is an auto-scored interaction with prompt plus 2x2 option grid. Its active option state must not borrow flip self-assess semantics.
- Flip self-assess remains exactly two states: `有把握` / confident and `再回看` / review.
- User-visible UI must not expose metadata, source, harness, runtime, route, fixture, debug, repo, raw id, or TODO language.

## Implementation hypothesis changed

- The Learning card header now uses one compact object header: current session label, current-card interaction label, and a small progress capsule.
- The previous strong `先做这一张` chip was removed from the first-read path.
- The address strip is now a quiet attached clue instead of a heavy outlined row.
- Multiple-choice options now use an option-letter badge, low-alpha selected surface, and a slim selection rail. Success/danger color remains reserved for resolved answer states.
- The real simulator screenshot was inspected and iterated once after a clipped right-edge progress affordance was found.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Learning design and interaction artifacts, `apps/mobile/src/learning/LearningSurface.tsx`, App/Learning tests, Maestro flows, and current real app screenshots.
- Generated/dependency/cache/archive read: current simulator screenshots were inspected only as validation evidence, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: tightens the Learning object header, address strip, multiple-choice selected state, and one-screen styling.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: updates Learning surface assertions to the quieter current-card object copy.
- `apps/mobile/__tests__/App.test.tsx`: updates integration assertions for the new Learning object header and review copy.
- `docs/design/app-screenshots/current-real-app/learning.png`: refreshes the current Learning screenshot from the real iOS simulator.
- `docs/agent-runs/artifacts/2026-06-30-learning-main-object-semantics-simulator.png`: source simulator capture for the refreshed screenshot.
- `docs/agent-runs/2026-06-30-learning-main-object-semantics.md`: records this run.

## Commands run

- `npx prettier --write apps/mobile/src/learning/LearningSurface.tsx apps/mobile/__tests__/LearningSurface.test.tsx` -> passed.
- `npx prettier --write apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm test -- --runInBand --watchAll=false apps/mobile/__tests__/LearningSurface.test.tsx apps/mobile/__tests__/App.test.tsx apps/mobile/__tests__/App.remoteFallback.test.tsx` in `apps/mobile` -> passed, 3 suites and 48 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-main-object-semantics-simulator.png` -> passed; copied to `docs/design/app-screenshots/current-real-app/learning.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-main-object-semantics-simulator.png docs/design/app-screenshots/current-real-app/learning.png` -> passed, both 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused Learning/App Jest: pass.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- CloudBase API tests: pass.
- Learning main screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real Learning screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 and visually inspected after the clipped-progress fix.

## Design review checklist

- Q1 Law of One: Learning uses the current library accent as the single strong accent for current-card identity, progress, selected option, and primary submit. Mint and amber remain scoped to flip self-assess.
- Q2 Focal object: the current CET card is the focal object. First-read path is current-card object header -> quiet address clue -> prompt -> 2x2 option operation -> submit.
- Q3 Silhouette: the captured state matches the multiple-choice silhouette from `spec/visual-language.json`: prompt block above, 2x2 option grid below. The support/address layer remains attached to the object.
- Q4 Forbidden patterns: no visible metadata, source, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, gradient text, gamification chrome, full-width bottom tabbar, serif typography, or removed self-assess token copy was introduced.
- Q5 Layout containment: simulator screenshot confirms no horizontal overflow, no clipped CTA, no clipped progress capsule, and no bottom-tab overlap at 1206 x 2622.
- Q6 Surface-specific: Learning does not expose module selection as the primary path. Flip still uses exactly `有把握 = mint` and `再回看 = amber`; no auto-scored interaction asks for self-assess.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Self-assess remains two-state only, with no red four-level self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after focused tests, full mobile tests, typecheck, lint, metadata scans, selector validation, harness validation, CloudBase API tests, Learning screenshot flow, strict iOS smoke, and real simulator screenshot inspection.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning main screen is closer to the accepted `mobile-core-surface-reset-v1` and `learning-card-rhythm-v1` object grammar.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: current-card object -> `learning-current-card`; object header and progress -> `learning-card-address-shelf`; attached address clue -> `learning-card-location-strip`; multiple-choice operation -> existing `learning-option-*` grid; primary continuation -> `learning-submit-button`.
- Unimplemented gap: this run improves the Learning main task. Result detail and deeper Space card-list states still need separate real-app quality passes.

## Card make external workspace impact

- N/A.

## Risks and open questions

- The refreshed screenshot proves the selected multiple-choice state on iPhone 17 Pro. It does not prove every interaction's visual polish across every device class.
