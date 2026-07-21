# Tencent CloudBase Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/card-system.json`, `spec/space-operations.json`, `spec/product-core.json`.

`product_truth`: remote learning must still enforce phone-code login before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: CloudBase is the current free/low-cost China-friendly staging runtime. It is not the final production architecture. Mobile authentication and canonical bootstrap use `/v2`; the repository-local backend and React Native client also implement `POST /v2/learning/events`, a durable mobile outbox, exact replay, transactional event ledger, and projections. Card payload and non-learning mobile mutations still rely on `/v1` only as a development migration bridge. None of these repository-local changes proves deployment. Isolate CloudBase NoSQL/function details behind a service adapter and preserve a future migration path to TypeScript CloudBase Run + PostgreSQL on the formal work server.

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
POST /v2/auth/request-code
POST /v2/auth/verify-code
POST /v2/auth/refresh
POST /v2/auth/logout
POST /v2/account/deletion
GET  /v2/bootstrap?track=cet4|cet6&day_key=YYYY-MM-DD
POST /v2/learning/events

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

## Learning Events Backend Slice

The next serial runtime boundary is:

```text
POST /v2/learning/events
```

Its immutable event, per-event idempotency, device-cursor conflict, atomic
projection, acknowledgement, and migration semantics are defined in
`infra/cloudbase/learning-events-v2-runtime-contract.md`. The repository-local
function implements this endpoint with memory and CloudBase transaction tests.
The React Native app now durably produces and exactly replays these events in
repository-local tests. Neither backend nor mobile release is deployed by this
change, and legacy daily/learning snapshot routes remain a backend
development-only bridge for unmigrated accounts until global removal lands.
The active React Native completion path no longer calls the v1 learning route.
After an account accepts its first v2 event, later v1 learning-state writes for
that account return `409 legacy_learning_write_disabled`; v1 daily progress is
restricted to monotonic check-in compatibility and cannot overwrite v2
learning counts or canonical space counts.

## Minimal HTTP Function

The first function is implemented at `infra/cloudbase/functions/softbook-api`.

It keeps card payload and mutation routes as development-only `/v1/*` REST
while `/v2` owns authentication and the canonical bootstrap read:

- Auth uses a development fixed-code adapter. Default code: `2468`.
- Verified v2 auth returns a short-lived signed bearer token backed by a
  revocable server session. Development v1 product routes accept that active
  session; production rejects every v1 route.
- Auth v2 adds persisted one-time SMS challenges, per-phone and per-IP rate
  limits, 15-minute access tokens, rotating 30-day refresh tokens, session
  revocation, and queued account deletion. See
  `infra/cloudbase/auth-v2-runtime-contract.md`.
- Bootstrap v2 reads server-side membership, progress, learning, physical
  space, and content-version state without accepting a phone number. See
  `infra/cloudbase/bootstrap-v2-runtime-contract.md`.
- Learning events v2 derives account identity from the active session and
  commits immutable events, cursor bindings, server sequences, daily progress,
  and per-card learning projections in one CloudBase transaction. Exact replay
  returns the original sequence without another projection write.
- The CloudBase adapter hard-caps an atomic event request at 9; the tested
  worst-case all-track migration uses 91 of the platform's 100 allowed
  transaction operations. Its
  transactions use deterministic document operations only; bounded legacy
  learning and space queries run before the transaction, with an account
  revision fence protecting first-event migration from concurrent v1 writes.
- Card source, membership state, daily progress, learning state, and space state persist to CloudBase NoSQL when `SOFTBOOK_STORE_MODE=cloudbase`; local tests still default to the in-memory adapter.
- Card source reads `softbook_card_sources` by track. Development mode seeds the CET4/CET6 records when a track document is missing; production bootstrap never seeds development content and fails closed. The legacy card-source response envelope remains the same one parsed by the mobile app.
- The router uses classic event-style `exports.main` so it can be bound to CloudBase HTTP access service paths such as `/softbook-api`.

Deploy from this folder:

```bash
cd infra/cloudbase
node provision-softbook-nosql.mjs
./deploy-softbook-api.sh
```

The default HTTP access path is `/softbook-api`, so the mobile runtime `SOFTBOOK_CET_REMOTE_BASE_URL` should point to that access root. The handler normalizes versioned paths with or without that prefix.

Expected CloudBase shape: function detail should show `Handler: index.main` and `Type: Event`. The public REST route is provided by the HTTP access service, not by CloudBase Web Function mode.

Recommended development environment variables:

```bash
export SOFTBOOK_STORE_MODE=cloudbase
export SOFTBOOK_SMS_DEV_CODE=2468
export SOFTBOOK_AUTH_TOKEN_SECRET="<dev-only-random-secret>"
export SOFTBOOK_AUTH_INDEX_SECRET="<stable-dev-index-secret>"
export SOFTBOOK_API_KEY="<optional-shared-dev-api-key>"
export SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT=9
export SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS=90
export SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS=300
```

Local function tests:

```bash
cd infra/cloudbase/functions/softbook-api
npm test
```

## Card Source Import

Use the importer when replacing the development CET4/CET6 card source in
CloudBase NoSQL. The importer runs the same card-source validator used by the
HTTP function before writing, so content changes cannot bypass the runtime
contract accidentally.

```bash
node infra/cloudbase/import-card-source.mjs --file path/to/card-source.json --track cet4
node infra/cloudbase/import-card-source.mjs --file path/to/card-source.json --track cet4 --apply
```

The first command is a dry-run and performs no CloudBase write. The `--apply`
form first reads and validates the existing current source, archives a replaced
version in `softbook_card_source_versions`, registers the new version as
`active`, and upserts `softbook_card_sources.<track>` in the current
`CLOUDBASE_ENV_ID`, defaulting to `test-d2gzcyxr9f7e80972` when the variable is
not set. The JSON payload must contain `source`, `track`, and `card_records`.
Validation computes and persists a deterministic `content_version`; a candidate
without final approval persists `release: null`. This development importer
rejects any non-null release descriptor. Only a separate pipeline that verifies
formal approval evidence may add a matching `content-release.v1` descriptor.

Audit the current CloudBase documents without writing:

```bash
node infra/cloudbase/audit-card-sources.mjs
node infra/cloudbase/audit-card-sources.mjs --track cet4
```

The audit command reads `softbook_card_sources` with `QUERY`, reuses the same
runtime validator, and checks `spec/box-catalog.json` prefix/path alignment, so
it is safe to run after manual imports or deploys.

Dependency audit status: the current lockfile returns zero known findings from
`npm audit --omit=dev`. This is a point-in-time dependency result, not production
readiness. The function remains pinned by its lockfile to the currently verified
CloudBase SDK and must still move to the production TypeScript/CloudBase Run
architecture before this development adapter can be treated as a production
backend.

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

The launch step first reuses an existing Metro server or starts one, then lets
the React Native CLI build and install the debug app. After that it relaunches
`com.softbook.cet` with `xcrun simctl launch` and the required `SIMCTL_CHILD_*`
environment variables. This matters because
`AppDelegate.swift` reads the app process environment, not the shell environment
around the helper script. Defaults can be overridden with
`SOFTBOOK_CET_IOS_DEVICE`, `SOFTBOOK_CET_IOS_SIMULATOR`,
`SOFTBOOK_CET_IOS_BUNDLE_ID`, and `SOFTBOOK_CET_METRO_PORT`. When the wrapper
starts Metro itself, it keeps running after the manual acceptance checklist is
printed; press `Ctrl+C` after acceptance to stop that Metro session. Set
`SOFTBOOK_CET_STOP_METRO_ON_EXIT=1` when you want the wrapper to stop its own
Metro process as soon as the launch sequence finishes. An already running Metro
server is reused and left alone.

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
- The automated space leg browses the library / group / box hierarchy, inspects
  a box card, applies a favorite tag, moves that card into sleep, then wakes it
  before returning to the learning flow.
- Completing a card updates statistics and leaves daily progress / learning
  state / space state without queued retry errors.

Manual and automated acceptance run notes live in
`ios-runtime-acceptance-log.md`.

Automated Maestro acceptance after remote launch:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
infra/cloudbase/smoke-ios-maestro-runtime.sh
```

`smoke-ios-maestro-runtime.sh` starts or reuses Metro, uninstalls the iOS debug
app to clear state, delegates the backend contract / runtime-profile / iOS
remote launch sequence to `smoke-ios-runtime.sh`, and then runs
`apps/mobile/e2e/maestro/ios-remote-smoke.yaml` against the already-launched app.
The remote Maestro flow intentionally omits `clearState` and `launchApp`, because
the app must keep the `SIMCTL_CHILD_*` runtime environment injected by
`smoke-ios-runtime.sh`.

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
