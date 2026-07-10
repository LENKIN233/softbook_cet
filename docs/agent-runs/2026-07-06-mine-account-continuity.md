# 2026-07-06 Mine Account Continuity

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Learning is the primary CET study flow. Mine supports account continuity and membership state; it must not become a settings center, report page, or explanatory product page.
- Account, progress, Space state, and membership entitlement are attached to the same account sync contract.
- Membership trial/purchase actions must remain explicit and visible, but they should not compete with the user's primary continuation path.
- User-visible copy must not expose metadata, harness, runtime, endpoint, raw exception, implementation, or agent language.

## Implementation Hypothesis

- Authenticated Mine should read as one account object: account identity -> current learning state -> one primary continuation -> secondary route shortcuts -> quiet membership action.
- Reducing explanatory labels and compacting the route/membership docks will make the page feel like a real app surface rather than a stacked settings dashboard.
- The existing auth, membership, sync, route navigation, and Maestro selector contracts can remain unchanged while improving the visible hierarchy.

## 变更摘要

- `apps/mobile/App.tsx`
  - Rewrites authenticated Mine labels from explanatory route/status copy to compact account-continuity copy: `账户已接上`, `当前卡`, `继续位置`, `继续学习`, `空间`, and `今日`.
  - Makes the primary Learning action use the established high-contrast primary action token instead of a faint accent tint.
  - Compresses authenticated Mine vertical rhythm, route actions, metric strip, glyph sizes, and membership trial dock so the whole object remains one-screen.
  - Rewrites the membership trial dock from `试用跟随账号` and long rule copy to `试用随学习开始` / `开始后开放空间和回看。`
- `apps/mobile/__tests__/App.test.tsx`
  - Updates authenticated Mine regression coverage to assert the new one-screen account-continuity copy, retained route actions, metric values, membership dock, and absence of the older stacked explanatory copy.
- `docs/design/app-screenshots/current-real-app/mine.png`
- `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - Refreshed real iPhone 17 Pro simulator screenshots for authenticated Mine in light and dark mode.

## 真实截图

- Light: `docs/design/app-screenshots/current-real-app/mine.png`
- Dark: `docs/design/app-screenshots/current-real-app/dark/mine.png`
- Both screenshots are real iPhone 17 Pro simulator captures produced after rebuilding and installing the current app.
- Visual inspection confirmed no clipped text, no overlapping controls, no horizontal overflow, no metadata leakage, and no scroll-dependent content in the authenticated Mine card.

## 验证

- `npx prettier --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="mine page keeps profile status and route actions in one screen after login|can dismiss remote recovery reminder from mine|refreshes remote entitlement when opening mine"` from `apps/mobile` -> passed, including metadata leak pretest.
- `npm run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` from `apps/mobile` -> passed; rebuilt and launched the real app on iPhone 17 Pro simulator.
- Light screenshot flow passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`
  - `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/mine.png`
- Dark screenshot flow passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`
  - `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/mine.png`
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/mine.png docs/design/app-screenshots/current-real-app/dark/mine.png` -> passed, both screenshots are 1206 x 2622.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed; login, Learning, Space trial/favorite/sleep, Statistics, and Mine route actions remained intact.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `MineSurface`; account rows -> identity band and metric strip; membership action -> `MembershipHostCard`; primary continuation -> `MineActionCard` with `mine-go-learning`; secondary route shortcuts -> `mine-go-space` and `mine-go-statistics`.
- Interaction/motion source: N/A. This run adds no new motion or core interaction family.
- Physical-space source: N/A. This run does not alter Space hierarchy or physical operations.
- Learning microcopy basis: N/A for card content. This run changes account-continuity and route copy governed by `account-sync-contract`, `membership`, and the accepted mobile core surface reset mapping.

## Design Review Checklist

- Q1 Law of One / current library: Mine remains a neutral account surface. The only strong action accent is the primary continuation object; the membership dock stays lower weight.
- Q2 focal object / first-read path: The focal object is the authenticated account card. First read is account identity -> current learning state -> primary continue action -> secondary route/membership actions -> floating chrome.
- Q3 interaction silhouette: Authenticated Mine follows the account-object silhouette defined by the mobile core reset mapping, not a Learning answer silhouette. It intentionally differs from flip/multiple-choice/lock/elimination/swipe because it is an account-continuity surface.
- Q4 forbidden design patterns: The refreshed screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm authenticated Mine fits without clipped text, overlap, horizontal overflow, safe-area collision, or content hidden behind the floating nav.
- Q6 surface-specific checks: Mine is not flip/stats/learning. Statistics and Learning remain route targets and unchanged; flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Mine screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to authenticated Mine hierarchy, copy, and screenshot evidence. It preserves account sync, membership actions, route behavior, selector contracts, Learning, Space, Statistics, and metadata-leak protections while replacing the previous stacked dashboard feel with a one-screen account-continuity object.

## 用户可见影响

- Yes. Authenticated Mine now reads as one app account-continuity surface rather than a stacked settings/report page.
- Yes. The primary next action is clearly `继续学习`; Space, Statistics, and membership stay available without competing for the first read.
- No authentication protocol, membership entitlement rules, Learning scoring, Space favorite/sleep behavior, card content, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Smaller-device containment, tablet screenshots, dynamic type, and continued cross-surface polish remain follow-up evidence.
