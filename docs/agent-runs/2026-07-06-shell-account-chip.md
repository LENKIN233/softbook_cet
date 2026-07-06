# 2026-07-06 Shell Account Chip

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
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

- Top-level mobile navigation remains `学习 / 空间 / 统计 / 我的`.
- Learning is the primary flow. Statistics and Mine support the flow without becoming the product center.
- Users should not be interrupted by excess statistics or system-state labels.
- Mine is the account object surface for login, membership, and personal learning state.
- Account state must stay user-facing and must not expose tokens, runtime status, endpoints, raw remote errors, or unmasked account details in shell chrome.

## Implementation Hypothesis

- The shell's right-side phone/tablet header control should be a quiet account chip, not a repeated `已登录 / 未登录 / 验证中` status badge.
- Logged-in shell chrome should read `账户 / 已确认`; code-sent shell chrome should read `验证 / 待输入`; signed-out shell chrome should read `登录 / 保留卡`.
- The account chip should be tappable and route to Mine, making it a real app affordance rather than static status text.
- The route title/subtitle, floating tabbar, auth behavior, verification flow, and existing route test IDs remain unchanged.

## 变更摘要

- `apps/mobile/App.tsx`
  - Replaces `getShellAuthStatusText` with `getShellAccountChipCopy`.
  - Changes phone shell header status text into `shell-account-chip`, a compact two-line account chip with a neutral dot.
  - Adds `onOpenAccount` behavior so tapping the shell account chip routes to Mine.
  - Applies the same account-chip grammar to tablet `ShellHeader` through `shell-account-chip-tablet`.
  - Removes old `phoneTopPill`, `phoneTopPillText`, `headerPill`, and `headerAuthText` styling.
- `apps/mobile/__tests__/App.test.tsx`
  - Updates shell expectations from old status text to `账户 / 已确认` and `验证 / 待输入`.
  - Adds regression coverage that `shell-account-chip` routes from Learning to the Mine account object.
- `docs/design/app-screenshots/current-real-app/*.png`
- `docs/design/app-screenshots/current-real-app/dark/*.png`
  - Refreshed every existing current real app screenshot asset affected by the shared shell header.

## 真实截图

- Light refreshed: `auth.png`, `auth-phone-ready.png`, `auth-code-sent.png`, `auth-error.png`, `auth-verify-error.png`, `auth-space.png`, `auth-statistics.png`, `learning.png`, `detail.png`, `space.png`, `space-browse.png`, `statistics.png`, `mine.png`, `mine-signed-out.png`, `mine-phone-ready.png`, `mine-code-sent.png`, `mine-auth-error.png`, `mine-verify-error.png`.
- Dark refreshed: `dark/auth.png`, `dark/auth-phone-ready.png`, `dark/auth-code-sent.png`, `dark/auth-error.png`, `dark/auth-verify-error.png`, `dark/learning.png`, `dark/detail.png`, `dark/space.png`, `dark/space-browse.png`, `dark/statistics.png`, `dark/mine.png`, `dark/mine-signed-out.png`, `dark/mine-phone-ready.png`, `dark/mine-code-sent.png`, `dark/mine-auth-error.png`, `dark/mine-verify-error.png`.
- All refreshed screenshots are 1206 x 2622 real iPhone 17 Pro simulator captures.

## 验证

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="can unlock the learning flow after fake sms verification|does not expose internal metadata copy on primary surfaces|mine page keeps profile status and route actions in one screen after login"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- Light screenshot flows passed: `ios-auth-screenshot.yaml`, `ios-auth-phone-ready-screenshot.yaml`, `ios-auth-code-sent-screenshot.yaml`, `ios-auth-space-gate-screenshot.yaml`, `ios-auth-statistics-gate-screenshot.yaml`, `ios-learning-home-screenshot.yaml`, `ios-learning-detail-screenshot.yaml`, `ios-space-overview-screenshot.yaml`, `ios-space-browse-screenshot.yaml`, `ios-statistics-screenshot.yaml`, `ios-mine-screenshot.yaml`, `ios-mine-signed-out-screenshot.yaml`, `ios-mine-phone-ready-screenshot.yaml`, `ios-mine-code-sent-screenshot.yaml`.
- Dark screenshot flows passed for the existing dark asset set: `ios-auth-screenshot.yaml`, `ios-auth-phone-ready-screenshot.yaml`, `ios-auth-code-sent-screenshot.yaml`, `ios-learning-home-screenshot.yaml`, `ios-learning-detail-screenshot.yaml`, `ios-space-overview-screenshot.yaml`, `ios-space-browse-screenshot.yaml`, `ios-statistics-screenshot.yaml`, `ios-mine-screenshot.yaml`, `ios-mine-signed-out-screenshot.yaml`, `ios-mine-phone-ready-screenshot.yaml`, `ios-mine-code-sent-screenshot.yaml`.
- Local request-code 503 stub on `127.0.0.1:48731` plus `ios-auth-error-screenshot.yaml` and `ios-mine-auth-error-screenshot.yaml` -> passed in light and dark.
- Local verify-code 401 stub on `127.0.0.1:48732` plus `ios-auth-verify-error-screenshot.yaml` and `ios-mine-verify-error-screenshot.yaml` -> passed in light and dark.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/*.png docs/design/app-screenshots/current-real-app/dark/*.png` -> passed, every existing current real app screenshot is 1206 x 2622.
- Visual inspection of refreshed light/dark Learning, Auth, Mine, auth-error, and Mine code-sent screenshots -> passed; no clipped account chip, tabbar collision, unsafe-area collision, horizontal overflow, or dark contrast regression found.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml` after a temp `clearState` launch flow -> passed.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Floating top context -> `PhoneTopBar` / `ShellHeader`; shell account affordance -> `shell-account-chip` / `shell-account-chip-tablet`; account object destination -> Mine route / `mine-profile-card`.
- Interaction/motion source: N/A. This run adds no new motion or learning interaction family; it reuses existing route selection behavior for a shell account affordance.
- Physical-space source: N/A. This run does not alter Space semantics.
- Learning microcopy basis: N/A. This run does not alter Learning task copy or card content; shell chrome copy is design-backed product correction.

## Design Review Checklist

- Q1 Law of One: The shell account chip stays neutral and does not introduce a competing strong accent. Current-library accent remains bound to the active surface.
- Q2 Focal object: The first-read path remains surface object first: current card in Learning, current box in Space, daily object in Statistics, account object in Mine. The account chip is chrome-level secondary affordance.
- Q3 Silhouette: The app keeps the accepted object -> attached state -> floating chrome silhouette. The right-side shell element now reads as an account affordance instead of a static system status badge.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, fixture, seed, TODO, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal implementation copy.
- Q5 Layout containment: Real iPhone 17 Pro light/dark screenshots across all existing current-real-app assets confirm the account chip, route title, primary object, bottom tabbar, auth docks, and error docks fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 Surface-specific: Learning remains system-sequenced single-card flow; Statistics remains tabular and subordinate; Mine remains the account object surface; flip self-assess remains exactly two states.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by refreshed current-real-app screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to shared shell account chrome and evidence refresh. It improves cross-surface app affordance while preserving route navigation, auth behavior, core learning, Space semantics, Statistics behavior, membership, card content, and sync paths.

## 用户可见影响

- Yes. The shell header now shows an account chip instead of repeated login status text.
- Yes. Tapping the account chip routes to Mine, so the chrome has a real app action.
- No auth repository, SMS behavior, card content, Learning scoring, Space favorite/sleep behavior, Statistics check-in behavior, membership contract, or sync contract changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app is finished.
- Smaller-phone containment, tablet real screenshots, dynamic type, keyboard-open auth screenshots, and transition motion remain follow-up evidence.
