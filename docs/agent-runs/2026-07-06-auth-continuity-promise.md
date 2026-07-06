# 2026-07-06 Auth Continuity Promise

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- New unauthenticated users cannot enter Learning as guests.
- Phone + SMS code is the primary login method.
- Learning state, physical Space state, and membership entitlement must be tied to the same authenticated account.
- Mine supports account continuity and membership recovery; it is not a settings hub or marketing page.
- Auth gates must remain attached to the protected Learning, Space, Statistics, or Mine object instead of becoming a detached generic login page.

## Implementation Hypothesis

- The real app auth screenshots still read like status or audit panels because the shared gate rendered three continuity chips such as retained card, retained position, and saved record.
- Replacing that ledger with one compact continuity promise makes the first-read path clearer: protected object -> lightweight continuity promise -> phone/SMS action.
- Top shell account copy should use account-action language (`账号 / 登录`, `验证码 / 继续`) instead of retained-card status copy.
- Existing auth handlers, remote/local repository behavior, OTP layout, error recovery, keyboard accessory, and Maestro selectors remain stable.

## 变更摘要

- `apps/mobile/App.tsx`
  - Replaces AuthGate continuity ledgers with one `auth-continuity-promise` strip and a neutral target chip.
  - Removes user-visible ledger copy including `原位保留`, `登录后保存`, `库组盒`, `登录后同步`, `账号承接`, and `保留卡`.
  - Updates shell account chip copy to account-action semantics.
  - Keeps phone request, OTP entry, request-code error, verify-code error, and login success behavior unchanged.
  - Removes dead ledger/continuity rail styles so the removed pattern is not available for reuse.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates auth/Mine route assertions for the new continuity-promise structure.
  - Adds regression coverage that the old ledger rows are absent from signed-out Mine.
  - Updates remote auth error assertions for the new recovery copy.
- Real screenshots refreshed for Auth and Mine auth states in light/dark, plus Space/Statistics protected auth gates in light.

## 真实截图

- Artifact directory: `docs/agent-runs/artifacts/2026-07-06-auth-continuity-promise/`
- Current app screenshot set refreshed:
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
  - dark Auth/Mine variants under `docs/design/app-screenshots/current-real-app/dark/`
- All refreshed screenshots are real iPhone 17 Pro simulator captures at 1206 x 2622.
- Visual inspection confirmed the old three-chip retained-state ledger is gone, the shell no longer says `保留卡`, and request/code/error states remain inside one screen without keyboard residue or bottom-tab collision.

## 验证

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="renders correctly|keeps protected route auth gates attached|keeps signed-out mine as an account object|keeps mine code-sent state attached|shows remote request-code failure inside the auth gate|shows remote verify-code failure inside the auth gate"` from `apps/mobile` -> passed; metadata leak pretest passed.
- `rg -n "账号承接|当前卡 · 四选一|原位保留|登录后保存|库组盒|登录后同步|今日进展 · 待同步|authRetainedLedger|auth-retained-ledger|保留卡|把当前位置接到账号|确认这个账号|验证中" apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx apps/mobile/e2e/maestro` -> passed with only intentional negative test assertions.
- Light Maestro screenshot flows passed for auth, phone-ready, code-sent, request-code error, verify-code error, Space auth gate, Statistics auth gate, Mine signed-out, Mine phone-ready, Mine code-sent, Mine request-code error, and Mine verify-code error.
- Dark Maestro screenshot flows passed for Auth/Mine signed-out, phone-ready, code-sent, request-code error, and verify-code error.
- Remote request-code and verify-code error screenshots used temporary local HTTP stubs on `127.0.0.1:48731` and `127.0.0.1:48732`; ports were cleared after capture.
- `sips -g pixelWidth -g pixelHeight ...` across refreshed artifacts and current screenshots -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- Local simulator smoke passed: `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml`.
- Remote simulator smoke after clear-state launch passed:
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-cet-clearstate-launch.yaml`
  - `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml`

## Design Source And Mapping

- Design source: `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping:
  - account object / auth gate -> `AuthGate`;
  - continuity promise -> `auth-continuity-promise`;
  - target chip -> `auth-continuity-promise-pill`;
  - phone request dock -> `auth-request-inline-dock`, `auth-phone-input`, `auth-request-code-button`;
  - OTP dock -> `auth-code-inline-dock`, `auth-code-input`, `auth-submit-button`;
  - error recovery -> `auth-error-dock`, `auth-error-title`, `auth-error-detail`, `auth-error-retry-pill`;
  - shell account action -> `shell-account-chip`.
- Interaction/motion source: No new interaction family or motion implementation was added. Existing request-code, change-code, submit-code, keyboard dismissal, and route navigation handlers are reused.

## Design Review Checklist

- Q1 Law of One / current library: Auth gates use one quiet account/current-route accent. No second subject color or competing CTA color is introduced; warning amber appears only in error recovery.
- Q2 focal object / first-read path: The focal object is the protected current object or Mine account object. First read is route shell -> auth title -> continuity promise -> phone/SMS action -> recovery state if needed.
- Q3 interaction silhouette: The screen remains a protected object with attached auth action. It no longer resembles a status ledger, management panel, settings hub, dashboard, or standalone login landing page.
- Q4 forbidden design patterns: Final screenshots and metadata scan show no visible agent, harness, spec, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, module-selection copy, or ledger/status-panel language.
- Q5 containment: Real iPhone 17 Pro light/dark screenshots confirm auth title, continuity promise, phone field, OTP cells, error recovery, and floating tabbar fit without clipped text, overlap, horizontal overflow, keyboard residue, or safe-area collision.
- Q6 surface-specific checks: Learning remains system-sequenced and single-card gated; Statistics auth remains a protected daily-progress object; flip self-assess is not changed.
- AP-22: This checklist is answered with real simulator screenshot evidence before PR delivery.
- AP-23: N/A. This run does not alter flip self-assess.
- VL-AP-07: Satisfied by this checklist and refreshed current-real-app screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to visible auth/Mine continuity quality. It removes ledger-like retained-state UI while preserving authentication behavior, remote/local auth recovery, and route-gate semantics.

## 用户可见影响

- Yes. Auth and signed-out Mine no longer present three-column retained-state ledgers.
- Yes. The shell account chip now reads as an account action rather than a retained-card status.
- Yes. Auth request/code/error states remain one-screen real app surfaces with refreshed light/dark screenshot evidence.
- No. Auth repository behavior, phone/SMS semantics, membership rules, Learning progression, Space operations, and Statistics logic were not changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app quality reset is finished.
- Remaining follow-up evidence should continue across smaller-device containment, tablet screenshots, dynamic type, signed-in account edge states, and non-auth Statistics/Mine refinements.
