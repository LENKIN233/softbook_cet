# iOS Runtime Acceptance Log

## 2026-05-01 02:00 CST

`product_truth`: iOS remote runtime must preserve authenticated entry before
learning, phone/SMS-code login, trial and membership access, physical-space
unlock, daily progress sync, learning-state sync, and space-state sync.

`implementation_hypothesis`: this log records a CloudBase dev runtime and iOS
debug-app acceptance run. It does not prove the final production backend and
does not change app defaults, real SMS, or payment behavior.

### Environment

- Branch at start: `main`
- Base commit: `46ff73d72fa2a18e57a5bb8712d7fa9fd655f5c7`
- Simulator: `iPhone 17`, booted iOS 26.4 runtime
- Remote base URL:
  `https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api`
- Manual phone printed by `smoke-ios-runtime.sh`: `19719339738`
- Dev fixed code: `2468`

### Script And App Launch

Command:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
SOFTBOOK_CET_IOS_LAUNCH=1 \
infra/cloudbase/smoke-ios-runtime.sh
```

Observed result:

- CloudBase REST contract passed with an isolated generated contract phone.
- JS runtime profile parsing tests passed.
- iOS debug build, install, and relaunch succeeded.
- Metro stayed running for the manual acceptance session.
- The iOS app opened to the learning/auth screen rather than the React Native
  red screen.
- The auth panel showed the remote SMS-contract copy:
  `当前会走远端短信验证码合同。`

### Manual UI Path

Observed result:

- Entered manual phone `19719339738` into the iOS app.
- Tapped `请求验证码`.
- The app displayed `已向 197****9738 发送验证码。`, proving the UI reached the
  remote request-code path.

Blocked result:

- The host automation could click and scroll the Simulator through Swift
  `CGEvent`, but could not inject digits into the React Native `number-pad`
  verification-code field.
- `osascript` was denied Accessibility control for this session.
- Because of that host input limitation, the app UI was not driven past the
  verification-code field in this run.

This is an acceptance-environment blocker, not a product-contract change.

### Same-Phone Remote Contract Continuation

To avoid leaving the runtime path unverified at the service layer, the same
manual phone was continued through the remote contract with `fetch`:

- `POST /v1/auth/verify-code`: passed; returned an auth token for
  `19719339738`.
- `GET /v1/membership/entitlement`: passed; initial stage was
  `trial_available`.
- `GET /v1/learning/card-source?track=cet4`: passed; returned 5 cards from
  `cloudbase-dev-card-source`.
- `POST /v1/membership/start-trial`: passed; stage became `trial`.
- `POST /v1/progress/daily-sync`: passed.
- `POST /v1/learning/state-sync`: passed.
- `POST /v1/space/state-sync`: passed.

### Conclusion

The current remote runtime proof chain has advanced from script-only contract
checks to a real iOS debug app opening against the remote runtime and reaching
the remote SMS request-code path. The same manual phone also passed remote
verify-code, trial, card-source, progress, learning-state, and space-state
contracts through direct service calls.

The remaining gap is full in-app completion after verification-code input on
this host. The next useful increment is to add a stable iOS UI automation path
that can input RN `number-pad` fields, for example a small XCUITest or Maestro
flow, then rerun the same checklist entirely inside the app.
