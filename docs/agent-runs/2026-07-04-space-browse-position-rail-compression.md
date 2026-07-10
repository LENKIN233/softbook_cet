# Agent Run Record: Space Browse position rail compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-7`
- PR: N/A at record creation
- Summary: Continued the mobile quality reset by reshaping Space Browse from separate location-switch and card-operation panels into a current-box object with an integrated position rail and attached card action row. The screen still preserves library / group / box / card hierarchy while reading as one physical Space surface.

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
- `docs/design/mocks/space-surface-visual-refinement-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Space is a top-level physical hierarchy, not a flat card list or generic tools page.
- Every card belongs to `library -> group -> box -> card`; the UI must preserve this ownership.
- Favorite is a tag attached to a card, not a physical box. Sleep is a physical zone under the owning box that affects Learning flow.
- Space Browse must let users inspect box contents and sibling hierarchy without exposing raw metadata such as `box_ref` or content workspace details.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `SpaceSurface` card-list mode now nests the position controls inside the current-box object as `位置轨` instead of rendering a separate `切换位置` card.
- The position rail keeps the existing `space-library-*`, `space-group-*`, and `space-box-*` selectors and manual selection behavior.
- Favorite and sleep controls remain attached to the visible card but are visually demoted into a light card action row rather than two separate tool cards.
- `ios-space-browse-screenshot.yaml` now dismisses the auth keyboard before submitting the SMS code, matching the main smoke flow.
- Existing behavior and stable selectors are preserved: `space-address-shelf`, `space-browse-rail`, `space-contained-card-strip`, `space-library-3`, `space-group-2`, `space-box-1`, `space-favorite-1`, `space-sleep-1`, and `space-return-learning`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, physical-space artifacts, current real app screenshots, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Space Browse and smoke Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro debug artifacts were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/src/space/SpaceSurface.tsx`: integrates the position rail into the current-box object and demotes card state operations into an attached action row.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: updates the Space Browse visual-language assertion from `切换位置` to `位置轨` while preserving selector and metadata-leak checks.
- `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`: aligns auth keyboard dismissal with the main smoke flow.
- `docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png`: real iPhone 17 Pro simulator Space Browse screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space-browse.png`: refreshed current real app Space Browse screenshot.
- `docs/agent-runs/2026-07-04-space-browse-position-rail-compression.md`: this run record.

## Commands run

- `npx prettier --write src/space/SpaceSurface.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` in `apps/mobile` -> passed, 2 suites and 54 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` -> passed.
- `npm start -- --host 127.0.0.1` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` before keyboard-dismiss fix -> failed at auth gate because the keyboard remained open.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` after adding keyboard dismissal -> passed.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/space-browse.png` -> passed, 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_space_browse_position_rail_compression_pr_body.md --changed-file apps/mobile/src/space/SpaceSurface.tsx --changed-file apps/mobile/__tests__/SpaceSurface.test.tsx --changed-file apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml --changed-file docs/agent-runs/2026-07-04-space-browse-position-rail-compression.md --changed-file docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png --changed-file docs/design/app-screenshots/current-real-app/space-browse.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_space_browse_position_rail_compression_pr_body.md` -> passed.

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
- Space Browse screenshot flow: pass after aligning auth keyboard dismissal with the main smoke flow.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png`
  - `docs/design/app-screenshots/current-real-app/space-browse.png`

## Design review checklist

- Q1 Law of One: Space Browse uses the selected current box/library accent as the only strong accent. Sibling library/group/box chips are low-weight context.
- Q2 Focal object: First-read path is current box object -> integrated position rail -> contained card -> attached favorite/sleep and Learning continuity actions -> floating chrome.
- Q3 Silhouette: Space preserves the physical hierarchy silhouette from `space-model-v1`: library/group/box context, current box focus, contained card, favorite tag, sleep zone, and return-to-Learning continuity. It does not become a flat list or dashboard.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot at 1206 x 2622 confirms route header, current box object, position rail, contained card, attached actions, pager, return action, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This is a Space surface; it preserves library / group / box / card hierarchy and does not change Learning sequencing, Statistics tabular treatment, or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Space Browse screenshot flow, iOS smoke flow, and Maestro selector validation.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Space Browse now reads as one current-box inspection object instead of a form-like location switcher plus tool panel.
- The user can still browse sibling library/group/box hierarchy, inspect the contained card, favorite it, place it in sleep, page within the box, return to Learning, and go back to overview.
- Existing space browse behavior and stable selectors are preserved.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mocks/space-surface-visual-refinement-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: current box object -> `SpaceSurface` card-list branch / `space-current-box-tray`; address and sibling context -> integrated `space-address-shelf` / `space-browse-rail`; contained card -> `space-contained-card-strip`; favorite tag -> `space-favorite-*`; sleep zone -> `space-sleep-*`; Learning continuity -> `space-return-learning`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-space-browse-position-rail-compression-simulator.png` -> `docs/design/app-screenshots/current-real-app/space-browse.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-visual-refinement-v1.html`.
- Space microcopy basis: design-backed product correction. Visible copy changes `切换位置` to `位置轨` to reduce form-like language while preserving Space hierarchy semantics.
- Unimplemented gap: This pass covers signed-in light-mode Space Browse after trial unlock. Dark mode, tablet containment, gated/free-after-trial Space Browse, and deeper multi-card deck motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors, state transitions, and Space operations are preserved.
- Future passes should cover gated/free-after-trial browse variants and tablet/dark-mode containment.

## Follow-up

- Continue quality passes on incorrect/review Detail tones, gated Space Browse variants, dark mode, tablet containment, and transition motion continuity.
