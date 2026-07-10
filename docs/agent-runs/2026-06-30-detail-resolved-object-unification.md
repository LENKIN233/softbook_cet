# Agent Run Record: Detail resolved object unification

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/detail-resolved-object-unification`
- PR: https://github.com/LENKIN233/softbook_cet/pull/277
- Summary: Continued the user-visible mobile app quality reset by making the Learning result detail state inherit the same current-card object grammar as the main Learning screen. This pass moves dominant identity from result feedback color back to the current library color, removes duplicate result chrome, keeps correctness as an attached feedback signal, and refreshes the real Detail simulator screenshot.

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
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Detail is a resolved state of the current Learning card, not a separate report page.
- The current library identity remains the screen's single dominant accent; correctness feedback must not become the primary app identity color.
- Multiple-choice detail is auto-scored and must not ask for flip-style self-assess.
- Result explanation should be a human learning slip with quiet continuation, not a status dashboard or metadata surface.
- User-visible UI must not expose metadata, source, harness, runtime, route, fixture, debug, repo, raw id, or TODO language.

## Implementation hypothesis changed

- The Detail header now uses the same current-card object header pattern as Learning main: library accent rail, quiet resolved-state label, and current-card interaction label.
- The outer Detail card border, shadow, and continue CTA now use the current library accent instead of success/failure feedback color.
- Result feedback remains scoped to the outcome label, answer cells, and narrow answer-slip rail.
- The duplicate right-side `答对` status pill was removed because the outcome is already communicated in the resolved card copy and answer slip.
- The old `TagChip` helper and styles were removed after the resolved Detail state stopped using status chips.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Learning/detail mapping and rhythm artifacts, `apps/mobile/src/learning/LearningSurface.tsx`, App/Learning tests, Maestro flows, and current real app screenshots.
- Generated/dependency/cache/archive read: current simulator screenshots were inspected only as validation evidence, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: unifies Detail resolved object semantics with the Learning current-card object and scopes feedback colors to answer/result elements.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshes the current Detail screenshot from the real iOS simulator.
- `docs/agent-runs/artifacts/2026-06-30-detail-resolved-object-unification-simulator.png`: source simulator capture for the refreshed screenshot.
- `docs/agent-runs/2026-06-30-detail-resolved-object-unification.md`: records this run.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx __tests__/App.remoteFallback.test.tsx` in `apps/mobile` -> passed, 3 suites and 48 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-detail-resolved-object-unification-simulator.png` -> passed; copied to `docs/design/app-screenshots/current-real-app/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-detail-resolved-object-unification-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed after removing the unused `TagChip` helper.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `python3 scripts/validate_harness.py` -> passed.
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
- Learning detail screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real Detail screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 and visually inspected after the duplicate status pill was removed.

## Design review checklist

- Q1 Law of One: Detail uses the current library accent as the single dominant accent for current-card identity, outer card, and continue CTA. Success/warning/danger colors are scoped to feedback labels, answer cells, and the answer-slip rail.
- Q2 Focal object: the current CET card is the focal object. First-read path is resolved object header -> outcome cue -> prompt -> answer cells -> attached answer slip -> continue.
- Q3 Silhouette: Detail remains the resolved state of the Learning current-card silhouette, with answer detail attached as a slip instead of a separate report page.
- Q4 Forbidden patterns: no visible metadata, source, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, gradient text, gamification chrome, full-width bottom tabbar, serif typography, or removed self-assess token copy was introduced.
- Q5 Layout containment: simulator screenshot confirms no horizontal overflow, no clipped CTA, no clipped status chrome, and no bottom-tab overlap at 1206 x 2622.
- Q6 Surface-specific: Learning does not expose module selection as the primary path. Flip still uses exactly `有把握 = mint` and `再回看 = amber`; auto-scored Detail does not ask for self-assess.
- AP-22: The six-question design review checklist above was answered before delivery with concrete simulator screenshot evidence.
- AP-23: Self-assess remains two-state only, with no red or four-level self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after focused tests, full mobile tests, typecheck, lint, metadata scans, selector validation, harness validation, CloudBase API tests, Detail screenshot flow, strict iOS smoke, and real simulator screenshot inspection.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning Detail now better matches the accepted `mobile-core-surface-reset-v1` resolved-object grammar and the current Learning main object semantics.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/interaction-motion/learning-core-interactions-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: resolved object -> `learning-result-detail-screen`; answer rows -> `learning-detail-selected-answer` and `learning-detail-correct-answer`; attached answer slip and continuation -> `apps/mobile/src/learning/LearningSurface.tsx`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Unimplemented gap: this run improves the resolved Detail state on phone. Remaining secondary states and transition motion still need separate real-app quality passes.

## Card make external workspace impact

- N/A.

## Risks and open questions

- The screenshot proves the positive multiple-choice resolved state. Incorrect/review resolved states share the same code path but were not separately captured in this run.
