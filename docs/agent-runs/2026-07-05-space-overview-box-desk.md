# Agent Run Record: Space overview box desk pass

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-4`
- PR: https://github.com/LENKIN233/softbook_cet/pull/340
- Summary: Continued the mobile quality reset by reshaping the Space overview first screen around the accepted Box Desk direction. The overview now reads as address rail -> current box desk -> contained card objects -> sleep alcove -> return-to-Learning continuity instead of a large generic card/list panel.

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
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`

## Product Truth

- Space is a top-level physical-space product capability, not a generic list, statistics panel, or favorites manager.
- The Space overview must preserve `library -> group -> box -> card` ownership and keep the current box as the first-read object.
- Favorite remains a tag on a card object, and sleep remains a physical zone under the owning box.
- Learning remains the primary study path; Space explains the current card position and gives a narrow return path.

## Implementation Hypothesis

- `SpaceSurface` overview can move closer to the accepted Box Desk direction without changing the data model, navigation contract, or browse-state operations.
- Replacing the generic "box/list" presentation with a current box desk, contained card objects, and an attached sleep alcove improves product and interaction clarity while preserving the existing selectors and Maestro flows.

## Workspace Boundary

- Active truth/source read: task-relevant specs listed above, accepted Space design artifacts, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro Space overview flow, and current real app screenshots.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files Changed

- `apps/mobile/src/space/SpaceSurface.tsx`: changes Space overview copy and layout from generic `盒内卡片` panel to `当前盒桌`, compacts the inspect action, renders contained cards as box-desk objects, and adds low-weight interaction labels inside overview cards.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: updates first-read Space overview assertions for `当前盒桌` and `盒内对象`.
- `apps/mobile/__tests__/App.test.tsx`: updates protected-space and membership-unlock assertions for the new Space overview product wording.
- `docs/agent-runs/artifacts/2026-07-05-space-overview-box-desk/space-overview-real-app.png`: real iPhone simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/space.png`: refreshed current Space overview screenshot.
- `docs/agent-runs/2026-07-05-space-overview-box-desk.md`: this run record.

## Validation

- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false SpaceSurface.test.tsx App.test.tsx` -> passed, 54 tests. Existing mocked MutationQueue 503 warnings were observed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Existing mocked MutationQueue warnings were observed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH="/opt/homebrew/opt/openjdk/bin:$PATH" maestro test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH="/opt/homebrew/opt/openjdk/bin:$PATH" maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-space-overview-box-desk/space-overview-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-space-overview-box-desk/space-overview-real-app.png docs/design/app-screenshots/current-real-app/space.png` -> passed, both `1206 x 2622`.

## Design Review Checklist

- Q1 Law of One: pass. Space keeps one dominant current-library accent for the address rail, current box desk, contained card objects, sleep alcove, and return action.
- Q2 Focal object: pass. First-read path is route shell -> address rail -> current box desk -> contained card objects -> sleep alcove -> return-to-Learning strip.
- Q3 Silhouette: pass. Space uses the physical hierarchy silhouette from the accepted Box Desk direction rather than a dashboard, ordinary list, or operation-only dock.
- Q4 Forbidden patterns: pass. No gradient text, gamification reward chrome, module-picker primary path, removed self-assess tokens, raw metadata, or visible implementation terms were introduced.
- Q5 Phone containment: pass. The real iPhone simulator screenshot keeps Space overview content, return action, and navigation chrome in one visible phone screen.
- Q6 Surface-specific: pass. Space preserves `library -> group -> box -> card`, favorite/sleep semantics, and Learning continuity. It does not alter Learning sequencing, flip self-assess, Statistics, Mine, auth, membership, purchase, or sync contracts.

## Agent Review

- Status: Passed locally after code inspection, real screenshot inspection, focused App/Space tests, typecheck, selector validation, Space overview Maestro flow, and screenshot dimension verification.
- Residual risk: Dark mode, tablet containment, empty/error/gated Space states, and Space browse visual refinement remain follow-up work. This pass intentionally changes only the light phone Space overview first screen and its matching assertions.

## User-Visible UI Impact

- Yes. This run changes Space overview copy and visual structure.
- Design source: `docs/design/directions/space-surface-visual-directions-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: address shelf -> `space-address-shelf`; current box desk -> `space-current-box-tray`; contained objects -> `space-open-box-deck` / `space-open-box-lid`; sleep zone -> `space-sleep-alcove`; return continuity -> `space-return-learning`; screenshot evidence -> current real app Space screenshot.
- Interaction/motion artifact: `docs/design/storyboards/learning-space-motion-prototype-v1.md`; no new animation or interaction family was added.
- Physical-space source: `docs/design/directions/space-surface-visual-directions-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/mocks/space-surface-shelf-desk-v1.html`. No new spatial model was introduced.
- Learning microcopy basis: no Learning UI copy changed. Space visible copy remains hierarchy and continuity copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone Space overview is covered. Dark mode, tablet containment, Space browse polish, and loading/empty/error/gated screenshot variants remain follow-up work.

## Card Make External Workspace Impact

- None. No card candidate content, approvals, or `/Users/lenkin/programing/card make` artifacts were produced or modified.
