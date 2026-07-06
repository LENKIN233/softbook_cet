# Agent Run Record: Statistics light record

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-30`
- Summary: Continued the visible mobile quality reset by reducing repeated status language on the Statistics surface. The checked-in Statistics screen now reads as a light daily record rather than a dashboard panel: top status uses the completed-card count, the progress dock says the rhythm is collected, and the check-in row uses account-saving language without repeating the same completion state.

## Referenced Specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `spec/interactions.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product Truth

- Statistics supports the CET single-card flow by lightly recording daily progress and continuity. It must not become the product center, a trend dashboard, a streak/achievement surface, or a source of interruption.
- Statistics numbers must remain tabular and low-weight.
- This run does not change learning progression, check-in state transitions, daily sync semantics, auth, membership, Space operations, or card payloads.

## Implementation Hypothesis

- The previous checked-in Statistics copy repeated the same state as `今天收好`, `记录完成`, `学习进度已收好`, `今日已签到`, and `已记录`. That made the surface read like a status dashboard instead of a light daily record.
- Replacing repeated status phrases with a completed-card count, `节奏已收好`, and account-save copy should preserve the same state while making the screen calmer and more app-like.

## Changes

- `apps/mobile/src/statistics/StatisticsSurface.tsx`
  - Checked-in title becomes `今天已收好`.
  - Top status pill now shows the completed-card count, e.g. `2 张`.
  - Progress label becomes `节奏已收好`.
  - Check-in row title becomes `今日记录`.
  - Check-in summary becomes `今天已签到，记录跟着账号保存。`
  - Checked-in summary removes the duplicate `已记录` phrase while preserving sync ledger display.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates Statistics assertions for the lighter checked-in copy and adds negative checks for old repeated status copy.
- `docs/design/app-screenshots/current-real-app/statistics.png`
  - Refreshed real iPhone 17 Pro simulator light screenshot.
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`
  - Refreshed real iPhone 17 Pro simulator dark screenshot.
- `docs/agent-runs/artifacts/2026-07-06-statistics-light-record/`
  - Stores light and dark real simulator screenshot evidence.

## Evidence

- `docs/agent-runs/artifacts/2026-07-06-statistics-light-record/statistics-light.png`
- `docs/agent-runs/artifacts/2026-07-06-statistics-light-record/statistics-dark.png`
- `docs/design/app-screenshots/current-real-app/statistics.png`
- `docs/design/app-screenshots/current-real-app/dark/statistics.png`

All four screenshots are real iPhone 17 Pro simulator captures at `1206 x 2622`.

## Validation

- `npm exec prettier -- --write src/statistics/StatisticsSurface.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can check in from statistics"` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites / 163 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in light appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml` in dark appearance -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` over Statistics light/dark artifacts and current-real-app copies -> passed, all `1206 x 2622`.
- `git diff --check` -> passed.

## Design Source And Mapping

- Design artifact: `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/canon.md`, and `docs/design/decisions/mobile-core-surface-reset-v1.md`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md#statistics-mapping` maps Statistics to a daily object and tabular low-weight ledger rows.
- Interaction/motion source: N/A. This run does not add a new interaction family or motion model; it preserves existing check-in, Learning return, and review-start handlers.
- Unimplemented gap: This pass covers checked-in Statistics light/dark on iPhone 17 Pro plus the broad iOS smoke. Smaller-phone, tablet, dynamic type, pre-progress, ready-to-check-in, pending-review, remote sync error, and offline queued-sync screenshots remain follow-up evidence.

## Design Review Checklist

- Q1 Law of One: Statistics uses one green daily-progress accent and does not introduce a second dominant accent.
- Q2 Focal object: First-read path is route chrome -> daily record object -> progress dock -> Learning return/check-in actions -> low-weight ledger.
- Q3 Silhouette: Statistics is a daily-record surface, not a core learning interaction silhouette. It preserves the accepted daily object plus tabular ledger shape and avoids trend-dashboard structure.
- Q4 Metadata leak: Visible copy was inspected in real light/dark screenshots. No debug, harness, runtime profile, repo path, endpoint, fixture, or agent-process wording is introduced.
- Q5 Layout containment: Real iPhone 17 Pro light/dark screenshots confirm no horizontal overflow, clipped CTA, text overlap, or tabbar collision.
- Q6 Surface-specific: Statistics still uses tabular numerals in metric rows and progress ratio. Learning module selection and flip self-assess behavior are unchanged.
- AP-22: Design review checklist is answered here and must be mirrored in the PR body.
- VL-AP-07: Real app screenshot inspection confirms no visible internal implementation or design-process language was introduced.
- AP-23: This run does not modify flip self-assess. The authoritative two-state implementation remains `有把握` / `再回看`.

## Agent Review

- Passed. Scope is limited to Statistics visible copy hierarchy, test assertions, real screenshots, and run record.
- No product definition, sync contract, check-in state transition, learning progression, auth, membership, card content, or Space behavior was changed.
- Residual risk is limited to untested Statistics variants: small phone, tablet, large text, pre-progress, ready-to-check-in, pending-review, sync error, and offline queued-sync visuals.
