# Agent Run Record: Learning detail visual polish

## Task summary

- Date: 2026-06-30
- Branch: `codex/polish-learning-detail-visuals`
- PR: pending
- Summary: Responded to the feedback that the Learning detail screen still looked ugly after guide-line cleanup. This pass reduces the heavy engineering feel by removing the gray detail bar, lowering success-green border weight, replacing the detail badge copy with a user-facing result pill, whitening the explanation slip, and using the stronger primary CTA color.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/mocks/leadership-screenshot-handoff-v2.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning detail remains a post-answer resolved-card state.
- The first-read path remains completed card -> selected answer -> explanation slip -> next-card continuation.
- UI quality must read as a finished app screen, not an internal tool, construction artifact, or system debug state.
- User-visible UI must avoid raw metadata, runtime, harness, source, payload, repo, route, fixture, mock, or TODO language.

## Implementation hypothesis changed

- The detail top bar is now transparent and lightweight instead of a gray rounded panel.
- The resolved card uses a softer result border and shadow instead of a heavy success-green outline.
- The detail result badge is now a short user-facing `答对` / `回看` / `需订正` pill instead of `自动判对`.
- Answer comparison cells use lower-alpha fills and borders.
- The explanation slip uses a white surface with a subtler border.
- The continuation CTA uses `accentStrong` for a cleaner primary action.
- `docs/design/app-screenshots/current-real-app/detail.png` was regenerated from the real iOS simulator.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/src/learning/LearningSurface.tsx`, App/Learning tests, Maestro flows, accepted Learning visual artifacts, and current real screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as evidence context, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: polishes the Learning detail hierarchy, result pill, answer cells, explanation slip, and CTA.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed real iOS simulator detail screenshot.
- `docs/agent-runs/artifacts/2026-06-30-learning-detail-visual-polish-simulator.png`: source simulator capture.
- `docs/agent-runs/2026-06-30-learning-detail-visual-polish.md`: records this run.

## Commands run

- `npm test -- LearningSurface.test.tsx App.test.tsx --runInBand` in `apps/mobile` -> pass, 2 suites and 47 tests.
- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint` in `apps/mobile` -> pass.
- `npm run metadata-leak-scan` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> pass.
- `npm test -- --runInBand` in `apps/mobile` -> pass, 26 suites and 159 tests.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `python3 scripts/validate_harness.py` -> pass.
- `git diff --check` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-detail-visual-polish-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-detail-visual-polish-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> pass, both 1206 x 2622.

## Validation results

- Focused Learning/App Jest: pass.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile metadata leak scan: pass.
- Design metadata leak scan: pass.
- Maestro selector validator: pass.
- Harness validator: pass.
- Learning detail screenshot flow: pass.
- Strict iOS Maestro smoke: pass.
- Real detail screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 with no development overlay.

## Design review checklist

- Q1 Law of One: Learning detail keeps one resolved-result state accent while reducing excessive success-green area and competing gray panels.
- Q2 Focal object: the completed card remains the first-read object; the path is lighter top status -> completed card -> selected/correct answer cells -> explanation slip -> next-card CTA.
- Q3 Silhouette: the resolved-card explanation rhythm is preserved and now reads less like an internal results form.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, or design-reference copy was introduced.
- Q5 Layout containment: the refreshed real 1206 x 2622 simulator screenshot confirms the detail card, answer cells, explanation slip, CTA, and tab capsule remain inside the phone viewport.
- Q6 Surface-specific: this is Learning detail polish only. Space, Statistics, Mine, membership gates, and scoring semantics are unchanged.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection, focused tests, full mobile tests, typecheck, lint, metadata scans, selector validation, harness validation, Learning detail screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Learning detail screenshot now has a cleaner hierarchy and less internal-tool styling.
- Design source: `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/storyboards/learning-space-motion-prototype-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: resolved card remains `learning-result-detail-screen`; selected/correct answer regions remain `learning-detail-selected-answer` and `learning-detail-correct-answer`; continuation remains `learning-next-button`; visual polish is contained to the detail surface.
- Unimplemented gap: Space card-list/detail, Statistics, Mine, and route-level visual consistency remain outside this PR.

## Card make external workspace impact

- N/A.

## Risks and open questions

- This is a targeted Learning detail polish. The broader screenshot set still needs the remaining non-Learning pages reviewed and upgraded.
