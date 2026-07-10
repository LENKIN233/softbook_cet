# Agent Run Record: Space Overview box desk compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-8`
- PR: N/A at record creation
- Summary: Continued the mobile quality reset by reshaping the real Space Overview screen from a reference-line-like box panel into a single box-desk object. The screen keeps the `library -> group -> box -> card` hierarchy, current box focus, sleep zone, and return-to-Learning continuity in one visible app surface.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a top-level physical hierarchy, not a card list, statistics board, or generic management page.
- Every card belongs to `library -> group -> box -> card`; the user must be able to see current position and inspect box contents.
- Favorite is a card tag, not a physical container. Sleep is a physical zone under the owning box that affects the Learning flow.
- Space Overview must preserve return-to-Learning continuity and avoid becoming a module picker.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` overview now uses a compact address rail rather than three standalone path blocks.
- The open box tray now fills the available one-screen area and reads as a box-desk object rather than a small wireframe tray.
- When there are sibling groups, Space Overview renders a quiet side shelf. When the selected library has only one group, it renders a low-weight accent spine instead of a tall truncated label.
- The contained cards now sit as readable card objects inside the tray instead of absolute-positioned reference cards.
- The sleep zone remains under the same box, while return-to-Learning is moved into a separate continuity strip at the same object level instead of being squeezed into the box footer.
- `ios-space-overview-screenshot.yaml` now dismisses the auth keyboard before submitting the SMS code, matching the Space Browse screenshot flow and avoiding a keyboard-covered submit state.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted Space shelf-desk artifacts, current real app screenshots, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Space Overview Maestro flow.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro debug artifacts were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: compresses Space Overview into a single box-desk object with compact address rail, side shelf/accent spine, contained cards, sleep zone, and a separate return continuity strip.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: updates the overview structure assertion so the return action is verified as a root-level continuity strip rather than inside the box deck.
- `apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml`: dismisses the auth keyboard before submit.
- `docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png`: real iPhone 17 Pro simulator Space Overview screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current real app Space Overview screenshot.
- `docs/agent-runs/2026-07-04-space-overview-box-desk-compression.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 2 suites and 54 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` before keyboard-dismiss fix -> failed because the numeric keyboard covered the auth submit flow.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` after keyboard-dismiss fix -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png docs/design/app-screenshots/current-real-app/space.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space.png` -> passed, 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_overview_box_desk_compression_pr_body.md --changed-file apps/mobile/src/space/SpaceSurface.tsx --changed-file apps/mobile/__tests__/SpaceSurface.test.tsx --changed-file apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml --changed-file docs/agent-runs/2026-07-04-space-overview-box-desk-compression.md --changed-file docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png --changed-file docs/design/app-screenshots/current-real-app/space.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_overview_box_desk_compression_pr_body.md` -> passed.

## Validation results

- Focused Space/App Jest: pass, 2 suites and 54 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Space Overview screenshot flow: pass after aligning auth keyboard dismissal with the Space Browse screenshot flow.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space.png`

## Design review checklist

- Q1 Law of One: Space Overview uses the current library/box accent as the only strong accent. Address dots, side spine, active card edge, and return action share one accent family; other state surfaces are neutral or low-weight.
- Q2 Focal object: First-read path is address rail -> current box hero -> box-desk tray -> contained cards -> sleep zone -> return continuity strip -> floating chrome.
- Q3 Silhouette: Space preserves the physical hierarchy silhouette from `space-model-v1`: parent address, current box focus, contained card objects, sleep zone, and return-to-Learning continuity. It does not become a flat list or dashboard.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, module-selection copy, or complex dashboard language.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot at 1206 x 2622 confirms route header, address rail, box-desk tray, card objects, sleep zone, return strip, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This is Space Overview only. It preserves library / group / box / card hierarchy and does not change Learning sequencing, Statistics tabular treatment, or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Space Overview screenshot flow, iOS smoke flow, Maestro selector validation, PR design gate, and agent review gate.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Space Overview now reads as a one-screen app object rather than a wireframe-like stack of reference panels.
- The user can still open the box list, perceive the current card position, see contained cards, inspect sleep state, and return to Learning.
- Stable user-flow selectors are preserved: `space-address-shelf`, `space-open-card-list`, `space-open-box-lid`, `space-sleep-alcove`, and `space-return-learning`.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: address rail -> `space-address-shelf`; current box object -> `space-current-box-tray`; contained cards -> `space-open-box-deck`; sleep zone -> `space-sleep-alcove`; Learning continuity -> `space-return-learning`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-space-overview-box-desk-compression-simulator.png` -> `docs/design/app-screenshots/current-real-app/space.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-shelf-desk-v1.md`.
- Unimplemented gap: This pass covers signed-in light-mode Space Overview after trial unlock. Dark mode, tablet containment, gated/free-after-trial Space Overview, and transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and existing Space operations are preserved.
- Future passes should cover gated/free-after-trial Space variants, dark-mode readability, tablet containment, and motion continuity between Learning and Space.
