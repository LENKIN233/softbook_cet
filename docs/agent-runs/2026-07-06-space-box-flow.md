# Agent Run Record: Space box flow refinement

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-31`
- Summary: Continued the visible mobile quality reset by tightening Space overview and box-browse into a clearer one-screen box flow. The Space overview now reads as an open current box rather than an object inventory, and the box-browse state uses a compact breadcrumb, current-card object, attached favorite/sleep actions, and direct return paths.

## Referenced Specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product Truth

- Space is a top-level physical hierarchy for CET cards: `library -> group -> box -> card`.
- Cards remain contained objects. Favorite is a tag on a card object. Sleep is a physical zone under the owning container that affects the learning flow.
- This run does not change card payloads, card approval, auth, membership, sync contracts, learning progression, or Space operations.

## Implementation Hypothesis

- The previous Space implementation preserved the correct product semantics, but the visible hierarchy still read like a data viewer because address, count, current box, card list, favorite, sleep, pager, and return actions competed at the same weight.
- Compressing the address into a breadcrumb, reducing duplicate counts, making the box state a single badge, and using user-facing copy such as `同盒卡片`, `当前位置`, and `回盒桌` should make the current box and current card feel like one app flow.

## Changes

- `apps/mobile/src/space/SpaceSurface.tsx`
  - Renames overview copy from inventory/viewer language to `打开卡盒`, `同盒卡片`, and `同盒休眠`.
  - Removes the duplicate two-line overview inspect button meta.
  - Replaces the browse address three-block layout with one compact breadcrumb line.
  - Replaces browse count badge copy with state copy such as `浏览中` / `已标记`.
  - Keeps favorite and sleep as attached card operations while changing support copy to `贴上标记`, `暂时不练`, and `仍留在盒内`.
  - Renames the secondary browse return action from `概览` to `回盒桌`.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`
  - Updates Space surface assertions for the compact breadcrumb and calmer box language.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates app-level Space assertions, including the favorite-state badge change to `已标记`.
- `docs/design/app-screenshots/current-real-app/space.png`
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/space.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`
  - Refreshed from real iPhone 17 Pro simulator output.
- `docs/agent-runs/artifacts/2026-07-06-space-box-flow/`
  - Stores light and dark real simulator screenshot evidence.

## Evidence

- `docs/agent-runs/artifacts/2026-07-06-space-box-flow/space-light.png`
- `docs/agent-runs/artifacts/2026-07-06-space-box-flow/space-browse-light.png`
- `docs/agent-runs/artifacts/2026-07-06-space-box-flow/space-dark.png`
- `docs/agent-runs/artifacts/2026-07-06-space-box-flow/space-browse-dark.png`
- `docs/design/app-screenshots/current-real-app/space.png`
- `docs/design/app-screenshots/current-real-app/space-browse.png`
- `docs/design/app-screenshots/current-real-app/dark/space.png`
- `docs/design/app-screenshots/current-real-app/dark/space-browse.png`

All eight screenshots are real iPhone 17 Pro simulator captures at `1206 x 2622`.

## Validation

- `npm exec prettier -- --write src/space/SpaceSurface.tsx __tests__/SpaceSurface.test.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runTestsByPath __tests__/SpaceSurface.test.tsx --runInBand` in `apps/mobile` -> passed, 7 tests.
- `npm test -- --runTestsByPath __tests__/App.test.tsx --runInBand -t "can browse the current Space box after login|keeps completed progress when first gated space entry starts trial|allows purchase to unlock Space without trial|keeps remote trial pending until the trial gate action|shows trial gate from the first gated Space entry"` in `apps/mobile` -> passed, 2 matching tests.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites / 163 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` in light appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` in light appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml` in dark appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml` in dark appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` over Space light/dark artifacts and current-real-app copies -> passed, all `1206 x 2622`.
- `git diff --check` -> passed.

## Design Source And Mapping

- Design artifacts: `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/design/physical-space/space-state-baseline-v1.md`, and `docs/design/canon.md`.
- Implementation mapping: `docs/design/mapping/learning-space-implementation-map-v1.md#minimum-visual-contract-for-space` maps parent context, current object, contained card strip, favorite tag, sleep alcove, and Learning continuity to `SpaceSurface`.
- Interaction/motion source: N/A. This run does not add a new Space operation, gesture, animation, or transition model.
- Unimplemented gap: This pass covers populated Space overview and populated box-browse in light/dark iPhone 17 Pro. Smaller phone, tablet, dynamic type, loading, empty, remote-error, permission/paywall, sync-merge, and animated card-inspect transitions remain follow-up visual evidence.

## Design Review Checklist

- Q1 Law of One: Space uses one current-library accent for the address clue, current object marker, active card edge, and primary return path.
- Q2 Focal object: First-read path is route chrome -> current box tray -> compact location breadcrumb -> current card object -> attached favorite/sleep actions -> Learning or box-desk return.
- Q3 Silhouette: Space remains a physical hierarchy. It is not a flat list, favorite/sleep two-box shortcut, statistics board, or arbitrary organizer.
- Q4 Metadata leak: Visible copy was inspected in real light/dark screenshots. No debug, harness, runtime profile, repo path, endpoint, fixture, raw id, or agent-process wording is introduced.
- Q5 Layout containment: Real iPhone 17 Pro light/dark screenshots confirm the address breadcrumb, current-card object, state actions, pager, continuity buttons, and tabbar fit without overlap or horizontal overflow.
- Q6 Surface-specific: Favorite remains a tag on a card object; sleep remains a same-box physical state affecting the learning flow. Learning flip self-assess and Statistics tabular-number behavior are unchanged.
- AP-22: Design review checklist is answered here and must be mirrored in the PR body.
- VL-AP-07: Real app screenshot inspection confirms no visible internal implementation or design-process language was introduced.
- AP-23: This run does not modify flip self-assess. The authoritative two-state implementation remains `有把握` / `再回看`.

## Agent Review

- Passed. Scope is limited to Space visible hierarchy, tests, real screenshot evidence, and run record.
- No product definition, Space operation, sync/auth/membership contract, learning progression, card content, or card approval boundary was changed.
- Residual risk is limited to unverified Space variants: small phone, tablet, large text, loading, empty, remote-error, gated, sync-merge, and motion transition visuals.
