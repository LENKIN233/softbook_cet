# Agent Run Record: Learning detail answer slip

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-10`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping the Learning result-detail screen from a report-like answer page into the same current-card resolved state. This pass carries session progress, the compact spatial address, answer rows, explanation, continuity, and the primary next-card action in one phone viewport with real iPhone simulator screenshot evidence.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a guided, system-sequenced single-card flow.
- Detail must be the current card's resolved state, not a detached report or dashboard.
- The answer slip belongs under the same card object and should preserve choice, correct answer, explanation, and continuity.
- Learning should remain one-screen on phone without scroll-dependent primary action access.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, queue, cache, payload, or TODO language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now receives `currentIndex` and `sessionCardCount` so the resolved state carries the same progress context as the active Learning card.
- The result detail header reuses the current-card object shelf and progress cluster instead of reading as a standalone answer page.
- The spatial address is compact and neutral: current location, result placement, and a small card-face return affordance.
- The prompt, answer rows, explanation, continuity rail, and next-card CTA are kept inside one card object.
- The primary CTA is visible above the floating tab bar in the real iPhone simulator screenshot.
- Existing behavior and selectors are preserved: `learning-result-detail-screen`, `learning-detail-selected-answer`, `learning-detail-correct-answer`, `learning-result-back-button`, and `learning-next-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, Learning interaction artifacts, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/App.tsx`, Learning/App tests, Detail screenshot Maestro flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: reshapes `LearningResultDetailSurface` into a current-card resolved state, adds progress context props, compacts the spatial/result strip, and keeps the answer slip and explanation one-screen.
- `apps/mobile/App.tsx`: passes current session progress context into `LearningResultDetailSurface`.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: updates result-detail assertions for the resolved-card state and progress context.
- `apps/mobile/__tests__/App.test.tsx`: updates the end-to-end component assertion for the revised result-detail user copy.
- `docs/agent-runs/artifacts/2026-07-05-learning-detail-answer-slip-simulator.png`: real iPhone 17 Pro simulator Detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Detail screenshot.
- `docs/agent-runs/2026-07-05-learning-detail-answer-slip.md`: this run record.

## Commands run

- `npm exec prettier -- --write App.tsx src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` -> passed, 51 tests; pretest metadata leak scan passed; expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot /tmp/softbook-detail-current-4.png` -> passed.
- `cp /tmp/softbook-detail-current-4.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `cp /tmp/softbook-detail-current-4.png docs/agent-runs/artifacts/2026-07-05-learning-detail-answer-slip-simulator.png` -> passed.
- `file docs/design/app-screenshots/current-real-app/detail.png docs/agent-runs/artifacts/2026-07-05-learning-detail-answer-slip-simulator.png` -> passed, both 1206 x 2622 PNG.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused Learning/App Jest: pass, 51 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Detail screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-learning-detail-answer-slip-simulator.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`

## Design review checklist

- Q1 Law of One: Detail uses the active current-card library accent as the single strong accent. It is strongest on the card object marker, progress fill, answer outcome, and next-card CTA; supporting planes stay neutral.
- Q2 Focal object: First-read path is current card object -> progress/address -> resolved prompt -> answer slip -> explanation -> continuity rail -> next-card CTA -> floating navigation.
- Q3 Silhouette: The result detail is the accepted current-card resolved state. It does not create a new answer-report page or a statistics dashboard, and it preserves the multiple-choice answer-row silhouette.
- Q4 Forbidden patterns: Refreshed screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, game reward chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the resolved card, answer rows, explanation, continuity rail, primary CTA, and floating tab bar fit at 1206 x 2622 without clipped primary action, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains a system-sequenced one-card flow. The result detail does not alter flip self-assess; flip still uses exactly `有把握` / `再回看`.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed after code inspection, real screenshot inspection, focused and full App/Learning tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Detail screenshot flow, and iOS smoke flow.
- Blocking findings: none known after verification.

## User-visible UI impact

- Yes. The Learning Detail screen now reads as the current card after answer submission, not as a separate explanation/report page.
- The screen carries the same progress and address context as the active Learning card.
- The primary `继续下一张` action is visible in one screen above the floating tab bar.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`; resolved object -> `LearningResultDetailSurface`; answer slip -> `learning-detail-selected-answer` and `learning-detail-correct-answer`; continuity -> location rail; primary continuation -> `learning-next-button`; floating chrome -> existing app shell.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/interaction-motion/learning-core-interactions-v1.md`; no new interaction family or motion implementation was added.
- Physical-space source: N/A; this PR does not change Space UI or Space behavior.
- Learning microcopy basis: accepted current-card resolved-state language from `mobile-core-surface-reset-v1` plus existing card analysis content. No card payload or candidate content changed.
- Unimplemented gap: This pass covers light-mode phone multiple-choice Detail. Dark mode, tablet containment, flip/lock/elimination/swipe detail screenshots, and richer result transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The result-detail layout is verified on the multiple-choice path because that is the current screenshot flow. Follow-up passes should capture other interaction result-detail states.
- This pass changes layout and user-visible copy only; it does not change scoring, session state, sync, card content, or auth behavior.

## Follow-up

- Continue quality passes on Statistics quiet ledger, Space browse depth, and non-ideal Learning states after this PR is gated and merged.
