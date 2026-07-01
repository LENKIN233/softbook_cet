# Agent Run Record: auth code-sent status

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/auth-code-entry-focus`
- PR: N/A
- Summary: Unified the shared app chrome copy for the SMS code-sent stage so the real app reads as an in-progress verification flow instead of falling back to signed-out copy.

## Referenced specs

- `spec/account-sync-contract.json`
- `spec/product-core.json`
- `spec/runtime-boundaries.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product truth used

- `spec/account-sync-contract.json`: phone + SMS code is the primary login method; unauthenticated users cannot start learning.
- `spec/product-core.json`: authentication, learning state, physical space state, and membership continuity are shared across app surfaces.
- `spec/runtime-boundaries.json`: the runtime must enforce authenticated entry before learning starts.
- The accepted mobile core surface reset keeps Learning, Space, Statistics, and Mine in one shared app shell with a quiet top-level status object.

## Implementation hypothesis changed

- Before: the code-sent stage used correct local gate copy but the shared app chrome could still read as `未登录` or `等待登录`.
- After: `code_sent` maps to `验证中` in shell status and `验证码已发 / 输入验证码` in the shared auth badge.

## Workspace boundary and read scope

- Active truth/source read: `spec/account-sync-contract.json`, `spec/product-core.json`, `spec/runtime-boundaries.json`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml`, `docs/design/app-screenshots/current-real-app/auth-code-sent.png`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/App.tsx`: centralizes auth-stage display copy and maps `code_sent` to an in-progress verification state in shared chrome.
- `apps/mobile/__tests__/App.test.tsx`: covers the code-sent state on Mine and default auth gate flows so the shell no longer renders stale signed-out copy.
- `docs/agent-runs/artifacts/2026-07-01-auth-code-sent-status-simulator.png`: real iPhone 17 Pro simulator screenshot after the change.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real-app design screenshot.
- `docs/agent-runs/2026-07-01-auth-code-sent-status.md`: this run record.

## Commands run

- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-code-sent-status-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-code-sent-status-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-auth-code-sent-status-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed, both 1206 x 2622.
- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan && npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check && python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_code_sent_status_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/agent-runs/2026-07-01-auth-code-sent-status.md --changed-file docs/agent-runs/artifacts/2026-07-01-auth-code-sent-status-simulator.png --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_code_sent_status_pr_body.md` -> passed.

## Validation results

- Focused Jest coverage proves code-sent copy now includes `验证中` and no longer includes stale `未登录` / `等待登录` copy in the covered flows.
- TypeScript compile passed.
- Real simulator screenshot confirms the top pill renders `验证中` while the auth object remains a one-screen in-app flow.
- Full local gates passed: lint, metadata leak scan, design metadata leak scan, typecheck, full mobile Jest, backend contract tests, selector validation, diff check, harness validation, and iOS smoke.
- PR body gates passed: design gate and agent review gate.
- CI: pending.

## Design review checklist

- Visual hierarchy: passed. The status pill now matches the active verification stage without adding a new card or page.
- Product grammar: passed. The change preserves object -> attached state -> floating chrome.
- Interaction continuity: passed. The SMS code request state reads as an in-progress auth flow across shared chrome and local gate.
- Metadata safety: passed. Mobile visible-text scanner and design artifact scanner both passed.
- AP-22 conditional: not applicable; no new physical-space affordance was introduced.
- VL-AP-07 conditional: applicable. Real simulator screenshot was captured from the app and copied into the current real-app screenshot set.

## Agent review status

- Reviewer: Codex
- Status: passed local review and PR body gate; pending CI.
- Blocking findings: none so far.

## User-visible UI impact

- The SMS code-sent app state now reads as `验证中` at the top of the app instead of `未登录`, making the auth flow feel like a real in-app state transition.

## Card make external workspace impact

- None. This task did not read or write `/Users/lenkin/programing/card make`.

## Risks and open questions

- This only changes shared auth-stage copy. It does not alter remote SMS behavior, membership gates, trial rules, or card content.

## Follow-up

- Continue scanning user-visible states where shell copy and local object state diverge.
