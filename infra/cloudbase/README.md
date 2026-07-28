# Tencent CloudBase Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/card-system.json`, `spec/space-operations.json`, `spec/product-core.json`.

`product_truth`: remote learning must still enforce phone-code login before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: CloudBase is the current free/low-cost China-friendly staging runtime. It is not the final production architecture. Mobile authentication and canonical bootstrap use `/v2`; the repository-local backend and React Native client also implement `POST /v2/learning/events`, `GET /v2/learning/session`, `POST /v2/progress/check-in`, `POST /v2/space/actions`, durable mobile queues, exact replay, transactional ledgers, and projections. Card payload and membership mutations still rely on `/v1` only as a development migration bridge; the former v1 daily, learning, and physical-space snapshot APIs are disabled. None of these repository-local changes proves deployment. Isolate CloudBase NoSQL/function details behind a service adapter and preserve a future migration path to TypeScript CloudBase Run + PostgreSQL on the formal work server.

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
GET  /v2/learning/session?track=cet4|cet6
POST /v2/learning/events
POST /v2/progress/check-in
POST /v2/space/actions

GET  /v1/learning/card-source?track=cet4|cet6
GET  /v1/membership/entitlement
POST /v1/membership/start-trial
POST /v1/membership/purchase
POST /v1/membership/dismiss-recovery

DISABLED (410) POST /v1/progress/daily-sync
DISABLED (410) POST /v1/learning/state-sync
DISABLED (410) GET  /v1/space/state-sync
DISABLED (410) POST /v1/space/state-sync
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
change. Retained daily/learning documents are read-only migration inputs; both
former snapshot-write routes return `410` for every account. Explicit check-in
uses strict `POST /v2/progress/check-in`, carries only `day_key`, and cannot
overwrite event-derived learning counts or canonical space counts.

## Physical-Space Actions Backend Slice

The current physical-space mutation boundary is:

```text
POST /v2/space/actions
```

Its immutable action IDs, exact request and acknowledgement schemas,
dimension-specific favorite/sleep merge, content authority, account-scoped
canonical projection, read-only legacy migration, and globally disabled v1
snapshot methods are defined in
`infra/cloudbase/space-actions-v2-runtime-contract.md`. The repository-local
function stores canonical state in `softbook_space_states` and immutable
idempotency records in `softbook_space_actions`. The mobile app durably queues
credential-free actions before optimistic presentation, replays with current
session/content context, and reconciles through bootstrap. This implementation
is locally verified and is not deployed by the repository change.

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
  per-card learning projections, exact `ts-fsrs@5.4.1` scheduler state, and a
  matching selected-cursor clear in one CloudBase transaction. Exact replay
  returns the original sequence without another projection or cursor write.
- Learning session v1 selects at most one server-authoritative card through
  `GET /v2/learning/session`, using eligible persisted cursor, due review, then
  canonical new-card order. It stores opaque revisioned cursors in
  `softbook_learning_sessions`, with a learning-projection watermark and
  transactional resumed-cursor confirmation so concurrent events force a
  complete reselection; see
  `infra/cloudbase/learning-session-v1-runtime-contract.md`.
- Physical-space actions v2 validate the active card source and content version,
  merge favorite and sleep on independent clocks, and commit immutable action
  records plus account canonical state atomically. A maximum 20-action request
  uses at most 42 CloudBase transaction operations.
- The CloudBase adapter hard-caps an atomic event request at 9 and accepts at
  most one unseen selection-bound event in a request. The tested first-event
  all-track migration and the maximum replay batch of 8 exact duplicates plus
  one current-selection event each use at most 29 of the platform's 100 allowed
  transaction operations. Its
  transactions use deterministic document operations only. Bounded legacy
  learning and space queries run before the transaction: learning uses an
  account revision fence for first-event migration, while legacy space
  documents are read-only after the global v1 space cutover.
- Card source, membership state, independent `softbook_daily_check_ins`, event-derived daily progress, learning state, space action ledger, and space state persist to CloudBase NoSQL when `SOFTBOOK_STORE_MODE=cloudbase`; retained legacy daily, learning, and space documents are migration reads only. Local tests still default to the in-memory adapter.
- Card source reads `softbook_card_sources` by track. Development mode seeds the CET4/CET6 records when a track document is missing; production bootstrap never seeds development content and fails closed. The legacy card-source response envelope remains the same one parsed by the mobile app.
- The router uses classic event-style `exports.main` so it can be bound to CloudBase HTTP access service paths such as `/softbook-api`.

The tracked `cloudbaserc.json` deliberately contains no environment variable
values. Runtime variables are managed through a temporary mode-`0600` config
created by the guarded manager, so a code deploy cannot replace strong secrets
with tracked defaults.

## Guarded Dev Deployment

All operations are pinned to `test-d2gzcyxr9f7e80972`, `softbook-api`, and the
known dev HTTP base URL. `configure`, `deploy`, and `rollback` are dry-run by
default. Their reports and redacted logs are written only to ignored
`exports/cloudbase-deployments/`. Cloud writes additionally require Node
`22.13.0`, a clean local `main`, and `HEAD` exactly equal to `origin/main`.

Read-only remote preflight:

```bash
node infra/cloudbase/manage-softbook-api.mjs preflight
```

Preflight checks the environment, function metadata, runtime variable names and
strength without recording values, the real FlexDB table catalog, identity
document counts, immutable function versions, traffic routes, and both dev card
sources. A zero count does not prove that a collection exists. Add
`--require-main` when checking whether the current checkout is deployable.

For a new dev environment or after the required catalog changes, review and
explicitly apply the collection provisioning plan before configuration:

```bash
node infra/cloudbase/provision-softbook-nosql.mjs
node infra/cloudbase/provision-softbook-nosql.mjs --apply
```

The apply form uses the public CloudBase `DescribeTables` / `CreateTable` API,
creates only missing allowlisted collections, and verifies the complete
required catalog after all writes. It is idempotent and does not add
placeholder documents.

Secure runtime configuration:

```bash
node infra/cloudbase/manage-softbook-api.mjs configure
node infra/cloudbase/manage-softbook-api.mjs configure --apply
```

The apply form requires a clean local `main` exactly equal to `origin/main`.
It preserves unknown existing variables, sets explicit development runtime
values, and creates distinct 32+ character auth token/index secrets with a
minimum character-diversity check only while no v2 identity-bound documents
exist. It never records those values. Once identity data exists, missing or
weak auth secrets fail closed instead of changing account identity or silently
revoking sessions. The CloudBase CLI update is explicitly non-interactive and
uses its overwrite mode so a zero-exit prompt cannot silently skip the update;
the manager still verifies the complete remote configuration after every write.

Build and validate the exact deployment artifact without writing CloudBase:

```bash
infra/cloudbase/deploy-softbook-api.sh
```

After the tooling PR is merged and the local clean `main` is fast-forwarded,
apply the deployment:

```bash
infra/cloudbase/deploy-softbook-api.sh --apply
```

The apply flow performs a clean dependency install, runs the full backend test
suite, downloads and hashes the current remote package, publishes a pre-deploy
immutable version, and updates code without replacing the HTTP route. Function
configuration fixes `installDependency: false`, so CloudBase must execute the
bundled lockfile-resolved dependencies instead of silently running `npm
install`. The manager downloads and compares the complete deployed package,
runs a write-enabled isolated CET4 smoke and a CET6 smoke, then publishes a
verified version. Each publication must resolve to one newly created immutable
version ID, which is recorded in the mode-`0600` deployment report. Any failure
after the code update attempts an automatic package restore and verifies the
complete restored package. Before either live smoke, the manager requires an
empty dev identity/account baseline and creates an ignored mode-`0600` smoke
lifecycle manifest. Success and failure both delete only the exact persisted
document IDs and verify that every collection returned to its baseline. A
cleanup failure fails the deployment and leaves the manifest resumable at
`exports/cloudbase-deployments/<deploy-run>/smoke-lifecycle.json`.

Manual rollback accepts either a deployment run directory or its `backup`
subdirectory:

```bash
node infra/cloudbase/manage-softbook-api.mjs rollback \
  --backup exports/cloudbase-deployments/<deploy-run>
node infra/cloudbase/manage-softbook-api.mjs rollback \
  --backup exports/cloudbase-deployments/<deploy-run> \
  --apply
```

The default HTTP access path remains `/softbook-api`, so the mobile runtime
`SOFTBOOK_CET_REMOTE_BASE_URL` should point to that access root. The handler
normalizes versioned paths with or without that prefix. A successful dev deploy
does not prove production readiness, formal content approval, or GitHub
required checks.

Expected CloudBase shape: function detail should show `Handler: index.main` and `Type: Event`. The public REST route is provided by the HTTP access service, not by CloudBase Web Function mode.

Managed development environment variables:

```text
SOFTBOOK_STORE_MODE=cloudbase
SOFTBOOK_RUNTIME_MODE=development
SOFTBOOK_SMS_DEV_CODE=2468
SOFTBOOK_AUTH_TOKEN_SECRET=<managed strong dev secret>
SOFTBOOK_AUTH_INDEX_SECRET=<managed stable strong dev secret>
SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT=9
SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS=90
SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS=300
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
infra/cloudbase/smoke-ios-runtime.sh
```

The wrapper allocates a one-off valid dev phone and owns its cleanup lifecycle.
Calling `smoke-softbook-api.mjs` directly against the allowlisted CloudBase dev
environment is rejected when authentication or writes are not backed by that
lifecycle. Isolated runs also assert that initial entitlement starts at
`trial_available`, start-trial returns `trial`, and purchase returns `premium`.
Override those checks only for a deliberate fixture with
`SOFTBOOK_CET_EXPECT_INITIAL_STAGE`, `SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE`,
or `SOFTBOOK_CET_EXPECT_PURCHASE_STAGE`.

If a process is killed after its cleanup plan has been persisted, resume only
that exact plan:

```bash
node infra/cloudbase/smoke-record-lifecycle.mjs cleanup \
  --manifest exports/cloudbase-smoke/<run>/manifest.json
node infra/cloudbase/smoke-record-lifecycle.mjs cleanup \
  --manifest exports/cloudbase-smoke/<run>/manifest.json \
  --apply
```

The first command is a dry run. Cleanup aborts without deleting when it sees an
unowned record, count drift, a non-dev target, or a document outside the
lifecycle window.

## iOS Runtime Smoke

`product_truth`: the iOS app must keep authenticated learning, shared membership
entitlement, explicit check-in, event-derived learning progress, and
physical-space sync working together when the remote runtime profile is
enabled.

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

For an iOS launch, the wrapper first resolves one available Simulator to an
exact UDID. An explicit `SOFTBOOK_CET_IOS_DEVICE` wins over the human-readable
selector; otherwise one booted device is used, or
`SOFTBOOK_CET_IOS_SIMULATOR` must resolve without ambiguity. A shutdown target
is booted and awaited before local tests or build work begins. The wrapper then
reuses an existing Metro server or starts one and lets the React Native CLI
build and install the debug app with `--udid` and unfiltered build diagnostics.
Launch flags, the manual acceptance phone, and the bundle identifier are also
validated before local device work. Only after those inputs, target resolution,
local runtime-profile tests, the debug build, and installed app lookup have
passed does it run the remote write smoke. After that it relaunches
`com.softbook.cet` with `xcrun simctl launch` and the required `SIMCTL_CHILD_*`
environment variables. This matters because
`AppDelegate.swift` reads the app process environment, not the shell environment
around the helper script. Defaults can be overridden with
`SOFTBOOK_CET_IOS_DEVICE`, `SOFTBOOK_CET_IOS_SIMULATOR`,
`SOFTBOOK_CET_IOS_BUNDLE_ID`, and `SOFTBOOK_CET_METRO_PORT`. When the wrapper
starts Metro itself, it keeps running after the manual acceptance checklist is
printed; press `Ctrl+C` after acceptance to stop that Metro session. Set
`SOFTBOOK_CET_STOP_METRO_ON_EXIT=1` when you want the wrapper to stop its own
Metro process as soon as the launch sequence finishes. A failed build or an
interrupted run always stops a Metro process started by the wrapper. An already
running Metro server is reused and left alone. For the allowlisted CloudBase dev
environment, the wrapper remains attached even when Metro was reused so
`Ctrl+C` can close the acceptance window and verify exact smoke-record cleanup.

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
- Completing a card updates event-derived statistics, explicit check-in remains
  independent, and learning / space state has no queued retry errors.

Manual and automated acceptance run notes live in
`ios-runtime-acceptance-log.md`.

Automated Maestro acceptance after remote launch:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
infra/cloudbase/smoke-ios-maestro-runtime.sh
```

`smoke-ios-maestro-runtime.sh` resolves one exact Simulator UDID, starts or
reuses Metro, uninstalls the iOS debug app from that device to clear state,
delegates the backend contract / runtime-profile / iOS remote launch sequence to
`smoke-ios-runtime.sh`, and then runs
`apps/mobile/e2e/maestro/ios-remote-smoke.yaml` against the same device with
`maestro test --udid`. The Maestro flow file, Java runtime, and CLI are checked
before target resolution or remote writes begin.
The parent Maestro wrapper owns one lifecycle across both the contract smoke and
the UI flow; the delegated iOS wrapper cannot clean the records early. Its exit
trap verifies cleanup after either a passed or failed Maestro run.
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
