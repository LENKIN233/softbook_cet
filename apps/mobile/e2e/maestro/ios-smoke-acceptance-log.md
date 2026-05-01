# iOS Maestro Smoke Acceptance Log

## 2026-05-01 09:23 CST

`product_truth`: the iOS app must keep phone/SMS-code login before
learning, preserve the top-level `learning / space / statistics / mine`
navigation shape, keep learning as a single-card flow, expose physical-space
position, and allow lightweight statistics check-in after real learning
progress.

`implementation_hypothesis`: this log records a local iOS debug-app Maestro
run against the default safe local runtime. It proves the UI automation path
for the local shell and does not prove the CloudBase remote runtime, production
SMS delivery, payment behavior, or production release signing.

### Environment

- Branch at run time: `infra/ios-maestro-smoke-record`
- Base commit: `9c4348d1dc7dee4ce256935aa10f6e8dad2afc8a`
- App bundle: `com.softbook.cet`
- Simulator: `iPhone 17`, iOS 26.4,
  `28D99EF0-BD40-4EB9-A266-4D7C82C29435`
- Node: `v24.15.0`
- npm: `11.12.1`
- Maestro: `2.5.1`
- Metro: started with `npm start` on `localhost:8081`, then stopped after the
  smoke run
- Test phone: `13800138000`
- Dev fixed code: `2468`

### Command

Terminal A:

```bash
cd apps/mobile
npm start
```

Terminal B:

```bash
cd apps/mobile
JAVA_HOME=/opt/homebrew/opt/openjdk \
PATH=/opt/homebrew/opt/openjdk/bin:$PATH \
MAESTRO_CLI_NO_ANALYTICS=1 \
MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
npm run e2e:ios:maestro
```

Observed command result:

- `npm run e2e:ios:maestro`: passed with exit code `0`.
- Flow name: `ios-auth-learning-space-statistics-smoke`.

### Observed UI Path

- Cleared app state and launched `com.softbook.cet`.
- Entered phone `13800138000` and dev code `2468`.
- Completed the auth gate and asserted `learning-current-card`.
- Navigated with stable route test IDs:
  - `route-tab-learning`
  - `route-tab-space`
  - `route-tab-statistics`
- Asserted `space-current-position` after entering the space tab.
- Returned to learning and completed one local card cycle across the core
  interaction families covered by the flow:
  - flip confidence
  - multiple choice
  - lock selection
  - elimination
  - swipe state
- Asserted `learning-complete-details`.
- Entered statistics, asserted `statistics-metric-completed`, tapped
  `statistics-checkin-button`, and asserted `今日已签到`.

### Conclusion

The iOS UI automation path now has a passing local evidence run after replacing
coordinate-based tab taps with route test IDs. This closes the host-input gap
identified in the earlier iOS runtime acceptance note for the local default
runtime path.

The next meaningful proof gap is not broader UI scope. It is running the same
Maestro path against an installed iOS app launched with the CloudBase remote
runtime profile, then recording whether the app-level path reaches remote auth,
membership, learning card source, progress sync, learning-state sync, and
space-state sync without falling back to manual service calls.
