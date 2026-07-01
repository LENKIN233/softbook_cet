# Agent Run Record: Detail result object flow

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/detail-result-object-flow`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by reshaping Learning Detail into the resolved state of the current card. This pass keeps the completed card, selected answer, attached answer slip, location feedback, and continuation CTA in one screen and refreshes the real iOS simulator Detail screenshot.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a system-sequenced single-card flow. Detail is a resolved state of the current card, not a separate report page, article page, or statistics view.
- The mobile grammar is current object -> attached layer -> quiet location feedback -> continuation action -> floating chrome.
- The result detail must preserve the current-card silhouette and keep the answer slip attached to the completed card.
- Flip self-assess remains exactly two states: `有把握` and `再回看`. This run does not alter flip scoring or self-assess colors.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now starts with the resolved current-card object, including the original prompt and the user's selected answer, before showing the answer slip.
- The selected/correct answer rows and explanation now sit inside an attached answer slip with outcome-colored emphasis instead of a standalone report block.
- The location feedback is separated from explanation content so it reads as continuity in the current learning flow.
- The old vertical title wrapper from the previous row layout caused the simulator card summary to collapse during the first screenshot check; this pass removes that layout residue with `alignSelf: 'stretch'`.
- The current real app Detail screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile implementation mapping, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/learning/localCardRecords.ts`, `apps/mobile/src/learning/model.ts`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS detail/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: reshapes `LearningResultDetailSurface` into a resolved current-card object with an attached answer slip, location shelf, and continuous CTA.
- `docs/agent-runs/artifacts/2026-07-01-detail-result-object-flow-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: current real app Detail screenshot.
- `docs/agent-runs/2026-07-01-detail-result-object-flow.md`: this run record.

## Commands run

- `npx prettier --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-detail-result-object-flow-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-detail-result-object-flow-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-detail-result-object-flow-simulator.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused Learning/App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Detail screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-detail-result-object-flow-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: Detail uses the active card/library frame lightly and reserves success/warning color for the result state and answer slip. No competing palette or separate report chrome is introduced.
- Q2 Focal object: The focal object is the resolved current card. First-read path is route title -> current-card identity -> outcome -> prompt -> selected answer -> attached answer slip -> location shelf -> continue CTA -> floating chrome.
- Q3 Silhouette: Detail remains a resolved state of the Learning card silhouette. The old report-like explanation stack is replaced with a card object plus attached answer slip.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the prompt, answer cells, explanation, location shelf, CTA, and floating navigation all fit without horizontal overflow, text collision, or clipped primary action.
- Q6 Surface-specific: This is Detail-only. It preserves Learning sequencing, card result semantics, answer test IDs, and the two-state flip self-assess model.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Detail screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Detail now presents the result as a resolved current-card object with an attached answer slip rather than a separate report page.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; this pass maps Detail to the accepted `resolve -> settle -> continue` rhythm without adding a new interaction family or motion.
- Learning microcopy basis: design-backed product correction. `卡面`, `解析贴在刚完成的卡后面`, and `已回到当前学习位置` support the resolved-card / attached-slip language.
- Implementation mapping: resolved object -> `learning-result-detail-screen`; selected answer -> `learning-detail-selected-answer`; correct answer -> `learning-detail-correct-answer`; continuation action -> `learning-next-button`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Unimplemented gap: This pass verifies light-mode phone output for the multiple-choice result-detail path. Dark mode, tablet screenshot evidence, review-phase detail screenshot, and all other interaction-specific result-detail screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the multiple-choice detail path on light-mode iPhone 17 Pro. Other interaction result-detail states are still covered by shared component tests and smoke paths, but they do not yet have individual screenshot evidence.

## Follow-up

- Continue real-app quality passes on Auth/login composition, dark mode, tablet containment, and interaction-specific Detail screenshot coverage.
