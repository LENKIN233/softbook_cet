# 2026-07-06 Mine Account Route Dock

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product Truth

Mine supports the learning flow; it is not the product center and must not become a settings hub or marketing page. Account, learning state, Space continuity, and membership entitlement belong to one account object.

## Implementation Hypothesis

This pass keeps the same data and actions but restructures the signed-in Mine surface into two attached zones: an account passport stack and a route/entitlement dock. The title becomes current-state copy (`继续今天这一轮`) instead of route-marketing copy. Sizes and spacing are implementation hypotheses; the account-object grammar and login/membership/sync continuity are product truth.

## 变更摘要

- `apps/mobile/App.tsx`
  - Groups signed-in Mine into `mine-passport-stack` and `mine-route-dock`.
  - Gives the account card a stable one-screen object height and attaches route actions plus membership access inside the same card.
  - Replaces `继续用完整路线备考` with `继续今天这一轮`.
  - Clarifies the purchase auxiliary action from `开通` to `开会员`.
- `apps/mobile/__tests__/App.test.tsx`
  - Locks the signed-in Mine account card height, passport stack, and route dock.
  - Prevents the old route-marketing title from returning.
  - Locks the clarified membership auxiliary action copy.
- `docs/design/app-screenshots/current-real-app/mine.png`
- `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - Updated with real iOS simulator screenshots.

## 真实截图

- Light: `docs/agent-runs/artifacts/2026-07-06-mine-account-route-dock/mine-account-route-dock-light-real-app.png`
- Dark: `docs/agent-runs/artifacts/2026-07-06-mine-account-route-dock/mine-account-route-dock-dark-real-app.png`

## 验证

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern=App.test.tsx --testNamePattern="mine|membership|metadata leakage"`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testPathPattern=App.test.tsx --testNamePattern="mine page keeps profile status|metadata leakage"`
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-account-route-dock/mine-account-route-dock-light-real-app.png`
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-account-route-dock/mine-account-route-dock-dark-real-app.png`
- `git diff --check`
- `python3 scripts/validate_maestro_selectors.py`
- `npm --prefix apps/mobile run design-metadata-leak-scan`
- `npm --prefix apps/mobile run lint -- --quiet`
- `npm --prefix apps/mobile run typecheck`
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false`
- `npm --prefix infra/cloudbase/functions/softbook-api test`
- `python3 scripts/validate_harness.py`
- `python3 scripts/validate_harness.py --skip-remote-guard`
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml`

Result: all passed.

## Design Source And Mapping

- Design artifact: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/visual-reference.html`, and `spec/visual-language.json`
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` maps Mine as account object, account rows, and membership action. Implementation surface is `apps/mobile/App.tsx`.
- Screenshot mapping: light screenshot updates `docs/design/app-screenshots/current-real-app/mine.png`; dark screenshot updates `docs/design/app-screenshots/current-real-app/dark/mine.png`.

## Design Review Checklist

Universal Q1-Q4: Q1 Law of One / current library evidence: Mine is an account surface and stays neutral, using one restrained account accent without competing library colors. Q2 The focal object is the account card; first-read path is account identity -> today state -> route dock -> membership entitlement -> floating chrome. Q3 The silhouette matches the mobile-core reset Mine account-object mapping, not a settings list, marketing page, dashboard, or detached card stack. Q4 forbidden_design_patterns evidence: real light/dark screenshots show no metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, module-selection copy, or complex dashboard language.

Conditional Q5-Q6: Q5 phone containment evidence: real iPhone 17 Pro light/dark screenshots at 1206 x 2622 confirm the account card, route actions, membership dock, and floating tabbar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision. Q6 Mine is not stats/learning/flip; the change does not alter Statistics tabular treatment, Learning sequencing, module selection, or flip self-assess.

AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence in `docs/design/app-screenshots/current-real-app/mine.png` and `docs/design/app-screenshots/current-real-app/dark/mine.png`.

AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review, with no four-level or red self-assess state introduced.

VL-AP-07: Satisfied by this checklist and by real light/dark app screenshots.

## Agent Review

Reviewer: Codex

Review status: passed

Blocking findings: none

Review summary: The change is scoped to signed-in Mine account object quality. It preserves auth, route navigation, membership mutation behavior, sync state, and Maestro selectors while making the visible account surface more coherent and less like stacked feature cards.

## 未实现 Gap

- This PR does not claim the full app is finished.
- It does not redesign signed-out Mine auth states, remote error variants, Learning, Space, or Statistics.
- Tablet containment and dynamic type remain follow-up evidence.
