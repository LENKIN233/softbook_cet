# Agent Run Record: Learning detail work area

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-38`
- PR: N/A at record creation
- Summary: Continued the mobile user-visible quality reset by expanding the Learning result detail into a one-screen resolved-card work area. The answer slip and continuation now stay inside the current card object instead of leaving a short report-like panel with unused lower space.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/card-system.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is the primary system-sequenced single-card flow.
- Detail is not a separate report page; it is the resolved state of the current card object.
- Answer comparison and exam-oriented explanation must attach to the card and remain study-facing.
- Continue-next-card is the primary continuation after result settlement.
- Flip self-assess remains exactly two states: `有把握` and `再回看`.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- `LearningResultDetailSurface` now lets the resolved card object fill the available phone work area.
- The answer slip grows inside the resolved card and distributes the answer header, answer comparison, and explanation as one attached result layer.
- The explanation slip stays centered inside the answer layer rather than turning into a long report block.
- The continue button remains attached at the bottom of the resolved card object.
- Existing result text, answer semantics, next-card behavior, back-to-card behavior, metadata filtering, and selectors are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Learning rhythm artifacts, mobile reset decision/mapping, current real app screenshots, `apps/mobile/src/learning/LearningSurface.tsx`, focused Learning/App tests, Learning detail screenshot flow, and iOS smoke flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: expands the result detail resolved card and answer slip into a full one-screen work area.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: locks result-detail resolved card and answer-slip layout behavior.
- `apps/mobile/__tests__/App.test.tsx`: locks the same layout behavior through the integrated learning result path.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app light Learning detail screenshot.
- `docs/design/app-screenshots/current-real-app/dark/detail.png`: refreshed current real app dark Learning detail screenshot.
- `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app.png`: archived real iPhone 17 Pro simulator light Learning detail evidence.
- `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app-dark.png`: archived real iPhone 17 Pro simulator dark Learning detail evidence.
- `docs/agent-runs/2026-07-06-learning-detail-work-area.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write src/learning/LearningSurface.tsx __tests__/LearningSurface.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/LearningSurface.test.tsx --testNamePattern="result detail reads as a resolved card without raw metadata"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/detail.png` -> passed.
- `npm --prefix apps/mobile exec prettier -- --write __tests__/App.test.tsx __tests__/LearningSurface.test.tsx src/learning/LearningSurface.tsx` -> passed.
- `cp docs/design/app-screenshots/current-real-app/detail.png docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app.png` -> passed.
- `cp docs/design/app-screenshots/current-real-app/dark/detail.png docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app-dark.png` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can complete the local single-card deck and restart it"` -> passed; pretest visible metadata leak scan passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/detail.png docs/design/app-screenshots/current-real-app/dark/detail.png docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app.png docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app-dark.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook-cet-pr-body-learning-detail-work-area.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook-cet-pr-body-learning-detail-work-area.md --changed-file ...` -> passed.

## Validation results

- Focused Learning result-detail Jest: pass.
- Focused App integrated result-detail path: pass.
- Light Learning detail screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Learning detail screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, all current and archived detail screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Agent review gate: pass.
- PR design gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app-dark.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`
  - `docs/design/app-screenshots/current-real-app/dark/detail.png`

## Design review checklist

- Q1 Law of One: Learning detail keeps the active card/library coral as the only strong subject accent. Success mint appears only as answer-state feedback inside the attached slip, not as a competing route theme.
- Q2 Focal object: First-read path is route title -> resolved current-card object -> card prompt -> attached answer slip -> explanation -> continue button.
- Q3 Silhouette: The screen preserves the Learning current-card silhouette in resolved form. Detail is still the same addressed card with an attached answer layer, not a separate report/article page.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, streak, XP, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm the header, resolved card, answer slip, explanation, continue button, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Learning detail-specific. It preserves system-sequenced result settlement, answer comparison, exam-oriented explanation, and next-card continuation. Space physical hierarchy and Statistics tabular behavior are not changed.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused tests, full mobile gates, CloudBase tests, harness validation, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Learning detail now reads as a full one-screen resolved card rather than a short result panel with unused lower space.
- The answer comparison, exam tip, and continuation are still attached to the card object.
- No Learning copy, card content, answer scoring, self-assess labels, Space behavior, Statistics behavior, auth, membership, or sync behavior changed.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/decisions/learning-card-rhythm-decision-v1.md`, `docs/design/interaction-motion/learning-card-rhythm-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mocks/learning-card-rhythm-v1.md`, and `docs/design/mocks/learning-card-rhythm-v1.html`.
- Implementation mapping: resolved card object -> `learning-detail-resolved-card`; attached answer slip -> `learning-detail-answer-slip`; selected/correct answer cells -> `learning-detail-selected-answer` and `learning-detail-correct-answer`; continuation -> `learning-next-button`; code surface -> `apps/mobile/src/learning/LearningSurface.tsx`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app.png` -> `docs/design/app-screenshots/current-real-app/detail.png`
  - `docs/agent-runs/artifacts/2026-07-06-learning-detail-work-area/detail-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/detail.png`
- Interaction/motion source: `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/interaction-motion/learning-core-interactions-v1.md`; no new interaction family or motion timing was added.
- Physical-space source: N/A; this PR does not alter Space.
- Learning microcopy basis: no visible-copy change. The pass changes layout containment only.
- Unimplemented gap: This pass covers phone Learning detail in light and dark for the multiple-choice result state. Small-phone, tablet, dynamic type, incorrect/review detail states, and long-analysis edge cases remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The result detail now uses more of the available vertical space. Long-analysis and incorrect/review variants should be validated separately so they do not become cramped on smaller phones.
- Tablet detail composition remains a follow-up because this pass validates the iPhone 17 Pro phone frame only.

## Follow-up

- Continue visible-quality coverage on incorrect/review result detail states, small-phone and tablet containment, Mine account object refinement, and non-ideal auth/membership states.
