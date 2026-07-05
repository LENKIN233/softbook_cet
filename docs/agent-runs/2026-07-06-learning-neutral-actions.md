# Agent Run Record: Learning neutral actions

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-01`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by separating Learning library identity color from normal action and selection states. Vocabulary rose remains visible as the current-card identity, while selected options, submit, continue, and resolved detail actions now use neutral app action surfaces. Correct / review / incorrect feedback remains on success / warning / danger tokens.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.html`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains the primary system-sequenced single-card flow.
- The current card is one addressed CET knowledge object with visible but light spatial address context.
- The current library identity remains visible through one strong accent.
- Library hues must not be used to encode correctness; feedback hues and library identity must stay separate.
- Correct answers are confirmation, wrong answers are correction, and neither should become emotional noise.
- Flip self-assess still has exactly two states: `有把握` and `再回看`.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- `LearningSurface` now consumes shared optional `primaryActionSurface`, `primaryActionText`, and `primaryActionMuted` palette tokens.
- Normal action and selected-operation states use neutral action surfaces rather than the active library hue.
- The active library hue remains on the current card accent rail, progress, address dot, and small identity marks.
- Multiple-choice selected state, lock selected state, elimination selected state, swipe selected state, submit dock, flip button, result summary continue button, and result detail continue button now avoid library hue.
- The result detail answer slip no longer takes a vocabulary rose background/border; result semantic tone remains success/warning/danger.
- Tests now assert that the Learning result detail continue button does not contain the card's library accent while the resolved card still exposes the library identity elsewhere.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Learning rhythm artifacts, mobile reset mapping, `apps/mobile/src/learning/LearningSurface.tsx`, Learning/App tests, Learning screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: separates library identity from neutral action / selection surfaces for Learning and result detail.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: updates the result detail style assertion to require neutral primary action and preserve library identity elsewhere.
- `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app.png`: real iPhone 17 Pro simulator light Learning evidence.
- `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app.png`: real iPhone 17 Pro simulator light Detail evidence.
- `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app-dark.png`: real iPhone 17 Pro simulator dark Learning evidence.
- `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app-dark.png`: real iPhone 17 Pro simulator dark Detail evidence.
- `docs/design/app-screenshots/current-real-app/learning.png`: refreshed current real app Learning screenshot.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Detail screenshot.
- `docs/design/app-screenshots/current-real-app/dark/learning.png`: refreshed current real app dark Learning screenshot.
- `docs/agent-runs/2026-07-06-learning-neutral-actions.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/learning/LearningSurface.tsx apps/mobile/__tests__/LearningSurface.test.tsx` -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx __tests__/App.test.tsx` -> passed; 51 tests, visible metadata leak scan passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed; 26 suites and 163 tests, with expected mocked sync warning logs.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed; 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app-dark.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app-dark.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` for four artifact screenshots and three current-real-app screenshots -> passed, all 1206 x 2622.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.

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
- Light Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Light Detail screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Learning screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Detail screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/learning-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/detail-real-app-dark.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`
  - `docs/design/app-screenshots/current-real-app/dark/learning.png`

## Design review checklist

- Q1 Law of One: current library vocabulary rose remains a single identity accent on the current card rail, address dot, and progress. Normal selected options, submit, continue, and result detail actions now use neutral app materials rather than a second semantic use of rose.
- Q2 Focal object: first-read path remains current card address -> current prompt -> interaction silhouette -> selected answer / submit -> resolved answer slip -> continue. The neutral action treatment keeps the current card as the focal object rather than turning the library color into feedback.
- Q3 Silhouette: Learning still preserves the canonical interaction silhouettes for flip, multiple-choice, lock, elimination, and swipe. This pass changes color semantics only, not operation shape or sequencing.
- Q4 Forbidden patterns: refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: real iPhone 17 Pro light and dark simulator screenshots confirm Learning and Detail fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced, no module picker is introduced, flip self-assess remains exactly two states, and Statistics tabular behavior is unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused and full mobile tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, four screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Normal Learning selection and submit/continue actions no longer read as rose warning/error states when the current card belongs to the vocabulary library.
- Detail's positive result state now lets mint answer feedback carry the meaning, while the continuation action uses shared neutral app chrome.
- The current card still remains visually identifiable as vocabulary through smaller, stable identity marks.

## Design source and implementation mapping

- Design source: `docs/design/decisions/learning-card-rhythm-decision-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.html`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Implementation mapping: current object -> `learning-current-card`; address shelf -> `learning-card-address-shelf`; interaction silhouette -> `InteractionBody`; submit / continue action -> `learning-submit-button` and `learning-next-button`; resolved answer slip -> `LearningResultDetailSurface`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-learning-neutral-actions/*-real-app*.png` -> refreshed files in `docs/design/app-screenshots/current-real-app/`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md`; no new motion was added.
- Physical-space source: N/A; Space behavior and physical-space model are unchanged.
- Learning microcopy basis: no visible-copy change. This PR changes visual state semantics and tests, not Learning card content or user-facing copy.
- Unimplemented gap: this pass covers phone Learning and Detail for the vocabulary multiple-choice case in light/dark. Other library colors, small-phone/tablet containment, dynamic type, loading/empty/error states, and complete-flow screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Library identity still appears in progress and current-card marks. That is intentional, but future non-vocabulary screenshots should confirm each library hue remains recognizable without becoming feedback.
- Flip reveal, swipe top card label, and address identity still use library accent in small regions. Future passes may tune these if they visually overpower the card for specific libraries.

## Follow-up

- Continue quality passes on auth screens, Learning non-ideal states, small-phone/tablet containment, and richer current-card transition evidence.
