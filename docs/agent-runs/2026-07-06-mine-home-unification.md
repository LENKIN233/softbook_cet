# Agent Run Record: Mine home unification

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-29`
- Summary: Continued the user-visible mobile quality reset by reshaping the logged-in Mine surface from a route/control-card stack into one account continuity object. Mine now leads with the current-card continuation, shows location and daily rhythm as attached state, compresses counters into one quiet status strip, and keeps membership as a non-invasive account dock.

## Referenced Specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/interactions.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product Truth

- Softbook CET is a CET4/6 preparation product centered on a system-sequenced single-card learning flow.
- Mine supports account, membership, and purchase recovery; it must not become the product center, a settings hub, a statistics dashboard, or a paywall-first surface.
- Account sync keeps learning records, Space position, and membership entitlement under phone SMS auth. This run does not alter auth, sync, purchase, membership entitlement, card payloads, or learning progression.

## Implementation Hypothesis

- A mainstream app account surface should expose one focal object first, then attached state and secondary route actions. The previous Mine screen still read as a stacked control panel because phone/account rows, four metrics, two route cards, and membership benefits competed at the same level.
- Compressing identity and metrics into attached state, renaming the primary action to return the user to Learning, and downgrading membership benefits into a compact account dock should make Mine feel like part of the app flow rather than an admin dashboard.

## Changes

- `apps/mobile/App.tsx`
  - Changes logged-in Mine headline to `今天从当前卡继续`.
  - Keeps the phone number once in the header summary, then uses the attached state band for `当前位置 / 当前卡保留` and `今日节奏`.
  - Replaces four independent metric chips with one low-weight segmented status strip.
  - Renames route actions to `回到学习`, `空间位置`, and `今日节奏` while preserving the existing test IDs and navigation handlers.
  - Compresses trial membership copy from benefit chips into `试用跟随账号`, with trial and purchase actions retained.
  - Removes the unused `SummaryMetricCard` component and its styles after Mine no longer uses it.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates Mine assertions for the new account-continuity wording and compact membership dock.
- `docs/design/app-screenshots/current-real-app/mine.png`
  - Refreshed real iPhone 17 Pro simulator light screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - Refreshed real iPhone 17 Pro simulator dark screenshot.
- `docs/agent-runs/artifacts/2026-07-06-mine-home-unification/`
  - Stores the light and dark real simulator screenshot evidence.

## Evidence

- `docs/agent-runs/artifacts/2026-07-06-mine-home-unification/mine-light.png`
- `docs/agent-runs/artifacts/2026-07-06-mine-home-unification/mine-dark.png`
- `docs/design/app-screenshots/current-real-app/mine.png`
- `docs/design/app-screenshots/current-real-app/dark/mine.png`

All four screenshots are real iPhone 17 Pro simulator captures at `1206 x 2622`.

## Validation

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="mine page keeps profile status"` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites / 163 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` in light appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` in dark appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` over Mine light/dark artifacts and current-real-app copies -> passed, all `1206 x 2622`.
- `git diff --check` -> passed.

## Design Source And Mapping

- Design artifact: `docs/design/mocks/mobile-core-surface-reset-v1.html` and `docs/design/canon.md` define the object-first mobile surface grammar.
- Design decision: `docs/design/decisions/mobile-core-surface-reset-v1.md` states that Statistics and Mine support the flow without becoming the product center.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md#mine-mapping` maps Mine to an account object, account rows, and non-invasive membership action.
- Interaction/motion source: N/A. This run does not add a new interaction family, motion model, or spatial operation; it preserves existing route taps, membership actions, and Learning/Space/Statistics navigation handlers.
- Unimplemented gap: This pass covers logged-in Mine light/dark on iPhone 17 Pro plus the broad iOS smoke. Smaller-phone, tablet, dynamic type, recovery prompt, premium/trial active states, and remote membership error screenshots remain follow-up evidence.

## Design Review Checklist

- Q1 Law of One: Mine uses the account/Mine accent as the single active signal. Learning, Space, and Statistics are secondary route actions and do not introduce competing library accents.
- Q2 Focal object: First-read path is route chrome -> Mine account object -> current-card continuity state -> primary Learning return -> secondary route/account membership actions.
- Q3 Silhouette: Mine is an account-support surface, not one of the core learning interaction silhouettes. The shape now follows object -> attached state -> compact action dock instead of a route dashboard.
- Q4 Metadata leak: Visible copy was inspected in real light/dark screenshots. No debug, harness, runtime profile, repo path, endpoint, fixture, or agent-process wording is introduced.
- Q5 Layout containment: Real iPhone 17 Pro light/dark screenshots confirm no horizontal overflow, clipped CTA, text overlap, or tabbar collision.
- Q6 Surface-specific: Mine remains account/member support and sends the user back to Learning. It does not expose module selection as the primary path, does not change flip self-assess, and does not change Statistics tabular-number behavior.
- AP-22: Design review checklist is answered here and must be mirrored in the PR body.
- VL-AP-07: Real app screenshot inspection confirms no visible internal implementation or design-process language was introduced.
- AP-23: This run does not modify flip self-assess. The authoritative two-state implementation remains `有把握` / `再回看`.

## Agent Review

- Passed. Scope is limited to Mine logged-in UI structure, tests, and screenshot evidence.
- No product definition, auth contract, sync contract, membership entitlement contract, card content, Space operation, or Learning progression behavior was changed.
- Residual risk is limited to untested Mine variants: small phone, tablet, large text, recovery prompt, premium/trial active states, and remote membership error visuals.
