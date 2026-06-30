# Agent Run Record: Learning detail guide-line cleanup

## Task summary

- Date: 2026-06-30
- Branch: `codex/remove-detail-guide-lines`
- PR: pending
- Summary: Removed the visible paper-guide construction lines from the Learning result-detail real app screenshot. The previous detail card inherited `paperSpine`, `paperLineOne`, and `paperLineTwo`, which read as reference lines rather than finished app chrome.

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
- The page should read as a finished app screen, not a design mock, construction layer, or reference-grid artifact.
- User-visible UI must not expose implementation, harness, debug, raw metadata, or artifact language.

## Implementation hypothesis changed

- The detail resolved-card no longer renders inherited paper guide lines.
- The explanation slip accent is weakened so it reads as subtle state material instead of a visible reference mark.
- The current real app detail screenshot was regenerated from the iOS simulator.

## Workspace boundary and read scope

- Active truth/source read: `apps/mobile/src/learning/LearningSurface.tsx`, Learning/App tests, Maestro detail flow, current real screenshot, and task-relevant design artifacts listed above.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as evidence context, not product truth.
- External workspace read: none. No card content was produced, approved, or modified.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: removes detail-card paper guide lines and weakens the explanation slip accent.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed real iOS simulator detail screenshot without guide lines.
- `docs/agent-runs/artifacts/2026-06-30-learning-detail-guide-line-cleanup-simulator.png`: source simulator capture.
- `docs/agent-runs/2026-06-30-learning-detail-guide-line-cleanup.md`: records this run.

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
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-learning-detail-guide-line-cleanup-simulator.png` -> pass; copied to `docs/design/app-screenshots/current-real-app/detail.png`.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-06-30-learning-detail-guide-line-cleanup-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> pass, both 1206 x 2622.

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
- Real detail screenshot: pass, captured from iPhone 17 Pro simulator at 1206 x 2622 with guide lines removed and no development overlay.

## Design review checklist

- Q1 Law of One: Learning detail still uses the resolved-result state accent; removing guide lines reduces competing visual marks.
- Q2 Focal object: the completed card remains the first-read object, now without construction lines cutting through the prompt.
- Q3 Silhouette: the resolved-card explanation rhythm is preserved: completed card -> selected/correct answer cells -> explanation slip -> next-card continuation.
- Q4 Forbidden patterns: no visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, or design-reference text was introduced.
- Q5 Layout containment: the real 1206 x 2622 simulator screenshot confirms the detail card, answer cells, explanation slip, CTA, and tab capsule remain inside the phone viewport.
- Q6 Surface-specific: this is Learning detail cleanup only. Space, Statistics, Mine, membership gates, and scoring semantics are unchanged.
- AP-22: The six-question design review checklist above was answered before delivery.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection, focused tests, full mobile tests, typecheck, lint, metadata scans, selector validation, harness validation, and real simulator screenshot capture.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Learning detail screenshot no longer shows reference-like guide lines.
- Design source: `docs/design/mocks/leadership-screenshot-handoff-v2.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/storyboards/learning-space-motion-prototype-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`; no same-PR design artifact is used as implementation authority.
- Implementation mapping: resolved card remains `learning-result-detail-screen`; selected/correct answer regions remain `learning-detail-selected-answer` and `learning-detail-correct-answer`; the cleanup only removes decorative guide-line rendering from the detail card.
- Unimplemented gap: Space card-list/detail, Statistics, Mine, and broader route-level visual consistency remain outside this PR.

## Card make external workspace impact

- N/A.

## Risks and open questions

- This is a targeted cleanup. The broader screenshot set still needs the remaining non-Learning pages reviewed and upgraded.
