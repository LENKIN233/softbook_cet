# 2026-07-06 Auth Account Object

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

- Login is required before Learning, and the primary login method is phone SMS code.
- Account, progress, physical Space state, and membership entitlement belong to the same account sync contract.
- Mine supports the learning flow; it must not become a settings center or an explanatory account page.
- User-visible auth, recovery, and error copy must avoid metadata, endpoint, runtime, raw exception, and implementation-language leakage.

## Implementation Hypothesis

- Signed-out Auth and Mine should read as one account action object: current object -> retained state -> attached phone/SMS dock.
- Reducing repeated `登录后继续 / 回到当前卡 / 权益归账号` copy makes the surface feel like an app action flow rather than a requirements explanation page.
- Error recovery should live inside the active phone/SMS dock, not as a third stacked card.
- Existing route behavior, authentication state machine, test IDs, remote/local repository behavior, and Maestro selector contracts should remain unchanged.

## 变更摘要

- `apps/mobile/App.tsx`
  - Rewrites AuthGate copy around `从这张题继续`, `确认后进入空间`, `确认后查看进展`, and `确认手机号`.
  - Recasts retained-state copy as current position/account ownership rather than repeated login instructions.
  - Simplifies phone request and code-sent dock copy to `手机号`, `手机号可用`, `下一步输入短码`, and `确认后回到...`.
  - Moves request-code and verify-code error recovery into the active dock via the existing `auth-error-dock` testID.
  - Keeps local/remote auth behavior, route selection, account chip, keyboard dismissal, SMS inputs, and button testIDs unchanged.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates Auth/Mine assertions to the new account-object copy.
  - Keeps regression coverage for one-screen no-scroll panels, error recovery, disabled/enabled buttons, and metadata leakage.
- `docs/design/app-screenshots/current-real-app/*.png`
- `docs/design/app-screenshots/current-real-app/dark/*.png`
  - Refreshed real iPhone 17 Pro simulator screenshots for Auth and signed-out Mine normal, ready, code-sent, request-error, and verify-error states; light also refreshes Space/Statistics auth gates.

## 真实截图

- Light refreshed:
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/auth-error.png`
  - `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
  - `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
  - `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
- Dark refreshed:
  - `docs/design/app-screenshots/current-real-app/dark/auth.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`
- All refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.
- Visual inspection confirmed the primary Auth and Mine states stay one-screen, use the same object grammar, and no longer read as stacked explanatory panels.

## 验证

- `npm run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` from `apps/mobile` -> passed; rebuilt and launched the real app on iPhone 17 Pro simulator.
- Light screenshot flows passed and refreshed screenshots:
  - `ios-auth-screenshot`
  - `ios-auth-phone-ready-screenshot`
  - `ios-auth-code-sent-screenshot`
  - `ios-auth-space-gate-screenshot`
  - `ios-auth-statistics-gate-screenshot`
  - `ios-mine-signed-out-screenshot`
  - `ios-mine-phone-ready-screenshot`
  - `ios-mine-code-sent-screenshot`
- Light remote-failure screenshot flows passed using temporary local HTTP stubs:
  - `ios-auth-error-screenshot`
  - `ios-auth-verify-error-screenshot`
  - `ios-mine-auth-error-screenshot`
  - `ios-mine-verify-error-screenshot`
- Dark screenshot flows passed and refreshed the corresponding Auth/Mine screenshots.
- `sips -g pixelWidth -g pixelHeight ...` on all 22 refreshed screenshots -> passed, every screenshot is 1206 x 2622.
- `npx prettier --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed after refreshing screenshots; login, Learning, Space, Statistics, and Mine path remained intact.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `AuthGate` embedded in `MineSurface`; protected-route account gate -> `AuthGate`; attached phone/SMS dock -> `PhoneSmsPanel`; recovery state -> `auth-error-dock` inside the active request/code dock.
- Interaction/motion source: N/A. This run adds no new motion or core interaction family.
- Physical-space source: N/A. This run does not alter Space hierarchy or physical operations.
- Learning microcopy basis: N/A for card learning content. Auth-gate copy is account-continuity copy governed by `account-sync-contract` and the accepted mobile core surface reset mapping.

## Design Review Checklist

- Q1 Law of One / current library: Auth and Mine use the neutral account accent and do not introduce competing library colors. Learning/Space/Statistics protected-route gates keep route context without adding a second strong library accent.
- Q2 focal object / first-read path: The focal object is the account/auth action object. First read is route/account object -> retained current/account state -> attached phone/SMS dock -> floating chrome.
- Q3 interaction silhouette: Auth/Mine are account objects under the mobile core reset grammar, not a core Learning interaction silhouette. The shape intentionally differs from flip/multiple-choice/lock/elimination/swipe because it is an account gate.
- Q4 forbidden design patterns: The refreshed screenshots and metadata scan show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product-design terms.
- Q5 containment or non-applicable reason: Real iPhone 17 Pro light/dark screenshots confirm Auth, Mine signed-out, ready, code-sent, request-error, and verify-error states fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced; Statistics remains tabular and unchanged beyond protected-route auth copy; flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app Auth/Mine screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to user-visible Auth/Mine account gate hierarchy and copy. It removes repeated explanatory text and folds errors into the active dock while preserving auth behavior, selectors, no-scroll panels, account sync semantics, Learning, Space, Statistics, and membership flows.

## 用户可见影响

- Yes. Auth and signed-out Mine now feel like a single app action object rather than a stacked login explanation page.
- Yes. Error recovery is visually attached to the field/button that failed.
- No authentication protocol, membership entitlement, Learning scoring, Space favorite/sleep behavior, card content, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Smaller-device containment, tablet screenshots, dynamic type, and further authenticated Mine polish remain follow-up evidence.
