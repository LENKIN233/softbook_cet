# Tencent CloudBase Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/card-system.json`, `spec/space-operations.json`, `spec/product-core.json`.

`product_truth`: remote learning must still enforce phone-code login before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: CloudBase is the current free/low-cost China-friendly staging runtime. It is not the final production architecture. Keep the public mobile contract as standard REST under `/v1/*`, isolate CloudBase NoSQL/function details behind a service adapter, and preserve a future migration path to Docker + PostgreSQL on the formal work server.

## Current Environment

- Cloud provider: Tencent CloudBase
- Environment ID: `test-d2gzcyxr9f7e80972`
- Alias: `test`
- Region: `ap-shanghai`
- Package: `体验版`
- Status at setup: `NORMAL`
- Billing cycle observed at setup: `2026-04-30` to `2026-05-31`
- Credits observed at setup: `3000` total, `0` used

## Local CLI

CloudBase CLI is installed globally through npm:

```bash
npm install -g @cloudbase/cli
tcb login --flow device
tcb env use test-d2gzcyxr9f7e80972
```

Status checks:

```bash
infra/cloudbase/check-dev.sh
```

## Intended First Backend Slice

Deploy one CloudBase function through an HTTP access service that exposes the existing mobile remote contract:

```text
POST /v1/auth/request-code
POST /v1/auth/verify-code
GET  /v1/learning/card-source?track=cet4|cet6
GET  /v1/membership/entitlement
POST /v1/membership/start-trial
POST /v1/membership/purchase
POST /v1/membership/dismiss-recovery
POST /v1/progress/daily-sync
POST /v1/learning/state-sync
POST /v1/space/state-sync
```

For the development environment, SMS should use a whitelist/fixed-code adapter first. Real SMS provider integration should remain an adapter and must not change the mobile REST contract.

## Minimal HTTP Function

The first function is implemented at `infra/cloudbase/functions/softbook-api`.

It intentionally keeps the external mobile contract as `/v1/*` REST:

- Auth uses a development fixed-code adapter. Default code: `2468`.
- Verified auth returns a signed bearer token that all non-auth endpoints require.
- Membership state, daily progress, learning state, and space state persist to CloudBase NoSQL when `SOFTBOOK_STORE_MODE=cloudbase`; local tests still default to the in-memory adapter.
- Card source returns valid CET4/CET6 card records in the same envelope parsed by the mobile app.
- The router uses classic event-style `exports.main` so it can be bound to CloudBase HTTP access service paths such as `/softbook-api`.

Deploy from this folder:

```bash
cd infra/cloudbase
node provision-softbook-nosql.mjs
./deploy-softbook-api.sh
```

The default HTTP access path is `/softbook-api`, so the mobile runtime `SOFTBOOK_CET_REMOTE_BASE_URL` should point to that access root. The handler normalizes either `/v1/*` or `/softbook-api/v1/*`.

Expected CloudBase shape: function detail should show `Handler: index.main` and `Type: Event`. The public REST route is provided by the HTTP access service, not by CloudBase Web Function mode.

Recommended development environment variables:

```bash
export SOFTBOOK_STORE_MODE=cloudbase
export SOFTBOOK_SMS_DEV_CODE=2468
export SOFTBOOK_AUTH_TOKEN_SECRET="<dev-only-random-secret>"
export SOFTBOOK_API_KEY="<optional-shared-dev-api-key>"
```

Local function tests:

```bash
cd infra/cloudbase/functions/softbook-api
npm test
```

Known SDK risk: `npm audit --omit=dev` currently reports transitive vulnerabilities from `@cloudbase/node-sdk`. Version `3.0.0` reduced part of the audit surface locally but failed real CloudBase DB reads in this environment, so the deployed dev function stays on the latest verified working `3.18.1`. Reassess the SDK or replace the persistence adapter before treating this as a production backend.

## Runtime Contract Smoke

The mobile/backend REST contract is documented in `infra/cloudbase/mobile-runtime-contract.md`.

Run the deployed CloudBase endpoint against the same payload shape used by the React Native repositories:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
SOFTBOOK_CET_TEST_CODE="2468" \
SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1 \
SOFTBOOK_CET_SMOKE_WRITE=1 \
SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 \
node infra/cloudbase/smoke-softbook-api.mjs
```

`SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1` generates a one-off valid dev phone for
the contract run. Omit it only when you intentionally want the smoke to operate
on `SOFTBOOK_CET_TEST_PHONE`. Isolated runs also assert that initial entitlement
starts at `trial_available`, start-trial returns `trial`, and purchase returns
`premium`. Override those checks only for a deliberate fixture with
`SOFTBOOK_CET_EXPECT_INITIAL_STAGE`, `SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE`,
or `SOFTBOOK_CET_EXPECT_PURCHASE_STAGE`.

## iOS Runtime Smoke

`product_truth`: the iOS app must keep authenticated learning, shared membership
entitlement, daily progress sync, learning-state sync, and physical-space sync
working together when the remote runtime profile is enabled.

`implementation_hypothesis`: `smoke-ios-runtime.sh` is a staging verification
wrapper for the CloudBase dev environment and the React Native iOS debug app. It
does not change `SOFTBOOK_APP_RUNTIME_CONFIG`, does not store credentials, and
does not prove the final production backend.

By default the wrapper sets `SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1`, so contract
write checks use a generated one-off phone number. This keeps membership
mutations from pushing the shared manual-acceptance phone into `premium`. Set
`SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=0` only when you intentionally want contract
checks to reuse `SOFTBOOK_CET_TEST_PHONE`.

Run the combined backend contract and JS runtime-profile check:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
infra/cloudbase/smoke-ios-runtime.sh
```

Add `SOFTBOOK_CET_IOS_LAUNCH=1` to start the iOS debug app against the same
remote profile after the contract check passes:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
SOFTBOOK_CET_IOS_LAUNCH=1 \
infra/cloudbase/smoke-ios-runtime.sh
```

The launch step first lets the React Native CLI build and install the debug app,
then relaunches `com.softbook.cet` with `xcrun simctl launch` and the required
`SIMCTL_CHILD_*` environment variables. This matters because `AppDelegate.swift`
reads the app process environment, not the shell environment around the helper
script. Defaults can be overridden with `SOFTBOOK_CET_IOS_DEVICE`,
`SOFTBOOK_CET_IOS_SIMULATOR`, and `SOFTBOOK_CET_IOS_BUNDLE_ID`.

When `SOFTBOOK_CET_IOS_LAUNCH=1`, the wrapper prints a one-off manual
acceptance phone in the `19xxxxxxxxx` format. Use that printed phone in the app;
the verification code remains the development fixed code `2468`. Set
`SOFTBOOK_CET_MANUAL_TEST_PHONE` to the printed value when a previous manual
acceptance run needs to be reproduced. `SOFTBOOK_CET_TEST_CODE` may still
override the code for non-default dev environments, but this flow must not use
real SMS.

Manual acceptance after launch:

- Auth screen says it is using remote SMS verification.
- Login with the printed one-off phone and dev fixed code reaches the learning
  bootstrap.
- Learning loads the remote track while preserving the single-card flow.
- First protected space entry starts trial and unlocks the physical-space map.
- Completing a card updates statistics and leaves daily progress / learning
  state / space state without queued retry errors.

Local mock flow:

```bash
node infra/cloudbase/mock-softbook-api.mjs
```

In another shell:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="http://127.0.0.1:48731" \
SOFTBOOK_CET_TEST_CODE="123456" \
SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1 \
SOFTBOOK_CET_SMOKE_WRITE=1 \
SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 \
node infra/cloudbase/smoke-softbook-api.mjs
```
