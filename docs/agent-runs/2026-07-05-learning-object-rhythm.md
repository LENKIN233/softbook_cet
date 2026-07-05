# Agent Run Record: Learning object rhythm

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-8`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping the Learning current card into a more object-like one-screen operation surface. This pass keeps the accepted multiple-choice silhouette, preserves existing behavior and selectors, refreshes the real iPhone simulator Learning screenshot, and stabilizes the Learning screenshot flow login step.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is a guided system-sequenced single-card flow, not a module picker, quiz dashboard, or metadata panel.
- The current card is a CET knowledge object with a visible but light spatial address.
- Multiple choice must preserve the prompt plus 2x2 option-grid silhouette.
- `peek`, `hint`, and `favorite` remain secondary tools attached to the current card object.
- Auto-scored interactions do not show flip self-assess controls.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, queue, cache, payload, or TODO language.

## Implementation hypothesis changed

- `LearningSurface` now treats the current card header as an object marker instead of a small quiz header dot.
- The address strip is quieter and neutral, with one small accent dot, so the spatial cue remains visible without becoming a module selector.
- The prompt is framed as the current-card reading plane, while the 2x2 multiple-choice area and submit dock remain the primary operation plane.
- The selected-answer submit dock now reads as the bottom action base of the same card object.
- Existing behavior and selectors are preserved: `learning-current-card`, `learning-card-address-shelf`, `learning-card-location-strip`, `learning-option-*`, `learning-submit-action-dock`, `learning-submit-button`, `learning-peek-button`, `learning-hint-button`, and `learning-favorite-button`.
- `ios-learning-home-screenshot.yaml` now dismisses the code-entry keyboard through the existing `auth-gate-keyboard-dismiss-target`, matching other iOS flows and allowing the real screenshot flow to reach Learning consistently.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Learning design/motion/mapping artifacts, `apps/mobile/src/learning/LearningSurface.tsx`, Learning/App tests, Learning screenshot Maestro flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: reshapes the Learning current card header, address strip, prompt plane, option spacing, and selected-answer submit dock while preserving behavior.
- `apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml`: adds the existing auth keyboard-dismiss target after SMS code input for stable real screenshot capture.
- `docs/agent-runs/artifacts/2026-07-05-learning-object-rhythm-simulator.png`: real iPhone 17 Pro simulator Learning screenshot evidence.
- `docs/design/app-screenshots/current-real-app/learning.png`: refreshed current real app Learning screenshot.
- `docs/agent-runs/2026-07-05-learning-object-rhythm.md`: this run record.

## Commands run

- `npm --prefix apps/mobile test -- --runInBand --watchAll=false LearningSurface.test.tsx` -> passed, 4 tests; pretest metadata leak scan passed.
- `npx --prefix apps/mobile prettier --write apps/mobile/src/learning/LearningSurface.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false LearningSurface.test.tsx App.test.tsx` -> passed, 51 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> initially failed before the screenshot flow dismissed the code-entry keyboard; passed after adding the existing `auth-gate-keyboard-dismiss-target`.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/learning.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-learning-object-rhythm-simulator.png` -> passed.
- `file docs/design/app-screenshots/current-real-app/learning.png docs/agent-runs/artifacts/2026-07-05-learning-object-rhythm-simulator.png` -> passed, both 1206 x 2622 PNG.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
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
- Learning screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-learning-object-rhythm-simulator.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`

## Design review checklist

- Q1 Law of One: Learning uses the active current-card library accent as the single strong accent. Accent is strongest on the current-card object marker, selected option, progress fill, and submit action; the address and prompt planes use neutral surfaces.
- Q2 Focal object: First-read path is current card object -> light address cue -> prompt plane -> 2x2 choice operation -> selected-answer submit base -> floating navigation.
- Q3 Silhouette: Multiple choice remains the canonical prompt plus 2x2 option-grid silhouette from `spec/visual-language.json#interaction_silhouettes`; flip, lock, elimination, and swipe behavior and selectors are preserved.
- Q4 Forbidden patterns: Refreshed screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, game reward chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the current card object, address strip, prompt plane, 2x2 options, submit dock, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains a system-sequenced one-card flow. Multiple choice does not use self-assess colors or prompts, and flip still uses exactly `有把握` / `再回看`.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App/Learning tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Learning screenshot flow, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Learning current-card home now reads more like an app-level current object and less like a generic quiz form.
- The 2x2 choice task stays first-action clear.
- The spatial address is still visible but quieter.
- The selected-answer submit dock remains attached to the current card object.

## Design source and implementation mapping

- Design source: `docs/design/decisions/learning-card-rhythm-decision-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/learning-card-rhythm-v1.md`, and `docs/design/mapping/learning-space-implementation-map-v1.md`.
- Implementation mapping: current object plane -> `learning-current-card` header and prompt plane; action plane -> `InteractionBody` multiple-choice 2x2 grid and `learning-submit-action-dock`; tool plane -> existing `learning-peek-button`, `learning-hint-button`, and `learning-favorite-button`; address aperture -> `learning-card-location-strip` and existing `learning-address-aperture`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-learning-object-rhythm-simulator.png` -> `docs/design/app-screenshots/current-real-app/learning.png`.
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/interaction-motion/learning-core-interactions-v1.md`; no new interaction family or motion implementation was added.
- Physical-space source: N/A; this PR does not change Space behavior.
- Learning microcopy basis: accepted `Guided Addressed Card Rhythm` in `docs/design/decisions/learning-card-rhythm-decision-v1.md` and `docs/design/interaction-motion/learning-card-rhythm-v1.md`.
- Unimplemented gap: This pass covers light-mode phone Learning current-card state. Dark mode, tablet containment, richer support-layer transition, and non-ideal Learning states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- This pass changes visual hierarchy only; it does not add new motion or interaction semantics.
- The prompt plane is now framed to improve object feel. Future passes should verify other interaction types in real screenshots, not only the multiple-choice current-card screenshot.

## Follow-up

- Continue quality passes on Learning support-layer states, detail/result state, non-ideal Learning states, and cross-surface consistency with Space and Statistics.
