# Agent Run Record: Learning dot signals

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-3`
- PR: https://github.com/LENKIN233/softbook_cet/pull/339
- Summary: Continued the mobile quality reset by removing the remaining reference-line treatment from Learning and Detail. The current-card header, result-detail header, selected option, answer slip, and continuity area now use lower-weight dots, fills, and attached rows instead of vertical rails and report-like borders.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning is the primary single-card flow. The current card must remain the focal object and the main task must fit the phone viewport.
- Detail is a resolved state of the same current card, not a separate answer report page.
- Feedback and answer detail attach to the object; they should not introduce reference rails or page-chrome lines that compete with the learning task.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `LearningSurface` replaces the tall `cardObjectAccent` vertical marker with a compact dot signal across current-card and detail headers.
- Multiple-choice selected state no longer renders an extra left-side selected rail; selection is carried by the option badge, border, and fill.
- Detail removes accent-colored outer/report borders and answer dividers, leaving the resolved card, answer slip, explanation, continuity row, and primary next action as one attached resolved state.
- Existing stable selectors are preserved: `learning-current-card`, `learning-card-address-shelf`, `learning-option-*`, `learning-submit-button`, `learning-open-result-detail-button`, `learning-result-detail-screen`, `learning-detail-selected-answer`, `learning-detail-correct-answer`, and `learning-next-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current real app Learning/Detail screenshots, `apps/mobile/src/learning/LearningSurface.tsx`, Learning tests, and Learning Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`: replaces vertical markers with dots, removes selected option rail, lowers detail/report borders, and flattens the continuity row.
- `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png`: real iPhone 17 Pro simulator Learning screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png`: real iPhone 17 Pro simulator Detail screenshot evidence.
- `docs/design/app-screenshots/current-real-app/learning.png`: refreshed current real app Learning screenshot.
- `docs/design/app-screenshots/current-real-app/detail.png`: refreshed current real app Detail screenshot.
- `docs/agent-runs/2026-07-05-learning-dot-signals.md`: this run record.

## Commands run

- `git status --short --branch` -> started on `codex/fix/mobile-quality-followup-20260705-3`, tracking `origin/main`, with only pre-existing untracked `exports/`.
- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/src/learning/LearningSurface.tsx` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile start -- --port 8081` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-learning-home-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-learning-detail-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png docs/design/app-screenshots/current-real-app/learning.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png docs/design/app-screenshots/current-real-app/detail.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png docs/design/app-screenshots/current-real-app/learning.png docs/design/app-screenshots/current-real-app/detail.png` -> passed, all 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full Maestro selector validation: pass.
- Whitespace diff check: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Learning home selector validation: pass.
- Learning detail selector validation: pass.
- Learning home screenshot flow: pass on iPhone 17 Pro simulator.
- Learning detail screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png`
  - `docs/design/app-screenshots/current-real-app/learning.png`
  - `docs/design/app-screenshots/current-real-app/detail.png`
- PR design gate and agent review gate are pending for PR delivery.

## Design review checklist

- Q1 Law of One: Learning keeps the current library as the single strong accent. Accent use is now dot/fill/CTA-based instead of rail-based.
- Q2 Focal object: First-read path is route title -> current card object -> attached interaction or resolved answer slip -> primary next action -> floating chrome.
- Q3 Silhouette: Learning remains a one-screen current-card flow. Detail remains the resolved state of that current card instead of a separate answer report.
- Q4 Forbidden patterns: The refreshed real screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, or report-first chrome.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm Learning and Detail fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced and one-card focused. Flip self-assess remains exactly two states; this run does not alter Space hierarchy, Statistics tabular behavior, auth, purchase, membership entitlement, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed local code inspection, real screenshot inspection, typecheck, lint, metadata scans, selector validation, full mobile Jest, CloudBase function tests, harness validation, Learning screenshot flows, and iOS smoke. PR-body gates pending.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning current-card and Detail resolved-state screenshots no longer expose vertical reference-line affordances.
- Stable selectors and behavior are preserved for answer selection, submit, opening detail, and continuing to the next card.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, and `spec/visual-language.json`.
- Interaction/motion source: `docs/design/storyboards/learning-space-motion-prototype-v1.md`; no new interaction family or motion implementation was added.
- Learning microcopy basis: no visible-copy change. This run only changes visual marker, border, and rail treatment for existing product/spec-backed Learning copy.
- Implementation mapping: current-card object -> `learning-current-card`; address shelf -> `learning-card-address-shelf`; action plane -> `InteractionBody`; resolved answer slip -> `learning-result-detail-screen` and detail answer selectors; continuation -> `learning-next-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/learning-real-app.png` -> `docs/design/app-screenshots/current-real-app/learning.png`; `docs/agent-runs/artifacts/2026-07-05-learning-dot-signals/detail-real-app.png` -> `docs/design/app-screenshots/current-real-app/detail.png`.
- Physical-space source: N/A; this is Learning-only and does not change Space.
- Unimplemented gap: dark Learning, tablet containment, flip front/back variants, dense lock/elimination/swipe screenshots, and completion screen remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and handlers are preserved.
- Follow-up screenshot work should cover the other core interactions to ensure the dot-signal grammar works beyond multiple choice.

## Follow-up

- Run full local gates, create/update PR, wait for required remote checks, merge if gates pass, and fast-forward `/Users/lenkin/programing/softbook_cet_design_quarantine`.
