# Tencent CloudBase Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/card-system.json`, `spec/space-operations.json`, `spec/product-core.json`.

`product_truth`: remote learning must still enforce phone-code login before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: CloudBase is the current free/low-cost China-friendly staging runtime. It is not the final production architecture. Mobile authentication, canonical bootstrap, card payload, membership, learning events/session, daily check-in and Space actions use authenticated `/v2` routes with durable mobile queues, exact replay, transactional ledgers and projections. Their retained `/v1` card-source and membership aliases are development-only; the former v1 daily, learning and physical-space snapshot APIs are disabled. None of these repository-local changes proves deployment. Isolate CloudBase NoSQL/function details behind a service adapter and preserve a future migration path to TypeScript CloudBase Run + PostgreSQL on the formal work server.

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
GET  /v2/learning/card-source?track=cet4|cet6
GET  /v2/membership/entitlement
POST /v2/membership/purchase
POST /v2/membership/dismiss-recovery
GET  /v2/learning/session?track=cet4|cet6
POST /v2/learning/round/continue  # controlled_pilot only
POST /v2/learning/events
POST /v2/progress/check-in
POST /v2/space/actions

GET  /v1/learning/card-source?track=cet4|cet6  # development migration alias only
GET  /v1/membership/entitlement                  # development migration alias only
POST /v1/membership/start-trial                  # development migration alias only
POST /v1/membership/purchase                     # development migration alias only
POST /v1/membership/dismiss-recovery             # development migration alias only

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
- Receiver delivery deploys the separate non-HTTP
  `softbook-account-deletion-worker` from the same tested artifact with a
  one-minute timer and no API auth/SMS/signing custom variables. It uses claim-bound leases, erases every current account or
  phone-owned runtime record plus retained phone-keyed migration state, preserves shared IP rate limits and global
  content, and removes the login-blocking task last. This is repository-local
  implementation, not a completed receiver deletion drill.
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
- Controlled-pilot Learning Session pauses at each unacknowledged positive
  five-event boundary, returns one deterministic round receipt, and resumes
  only after exact idempotent `POST /v2/learning/round/continue`
  acknowledgement stored in `softbook_pilot_round_continuations`. Formal
  production does not expose or apply this pilot-only gate.
- Physical-space actions v2 validate the active card source and content version,
  merge favorite and sleep on independent clocks, and commit immutable action
  records plus account canonical state atomically. A maximum 20-action request
  uses at most 64 CloudBase transaction operations.
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
- Authenticated `/v2/learning/card-source` reads `softbook_card_sources` by track and is the mobile contract in every runtime. Development mode may seed CET4/CET6 records when a track document is missing; non-development modes never seed development content and fail closed without a matching release. The `/v1` alias is retained only for development migration compatibility.
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
without current model authorization persists `release: null`. This development importer
rejects any non-null release descriptor. Only a separate pipeline that verifies
model-owned authorization evidence may add a matching `content-release.v1` descriptor.

Audit the current CloudBase documents without writing:

```bash
node infra/cloudbase/audit-card-sources.mjs
node infra/cloudbase/audit-card-sources.mjs --track cet4
```

An exact model-authorized controlled-pilot candidate can be exercised locally through
the authenticated v2 card-source, five-card server round and signed manifest
without claiming deployment or audio authorization:

```bash
node infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs \
  --candidate-payload <candidate.json> \
  --pilot-review <review.json> \
  --approval <approval.json> \
  --audit <audit.json> \
  --checked-at <ISO-8601 timestamp>
```

The report is repository validation only and always `gate_eligible=false`.

The audit command reads `softbook_card_sources` with `QUERY`, reuses the same
runtime validator, and checks `spec/box-catalog.json` prefix/path alignment, so
it is safe to run after out-of-band imports or deploys.

## Formal track release bundles

CET4-only formal closed-beta readiness is owned by
`spec/cet4-closed-beta-readiness.json` and recorded in
`docs/release/cet4-closed-beta-readiness.v1.json`. Validate the tracked baseline
with `node scripts/validate_cet4_closed_beta_readiness.mjs`; it is expected to
remain `not_ready` until one exact retained-parent candidate, every dependency
and every gate are complete. The repository loader already accepts tracked,
rehashed and reachable-commit-bound receiver deployment, SMS, Learning/
scheduler and release-recovery evidence under the exact
`target_release=cet4-closed-beta` cohort. Space, CET4 content, entitlement,
device/distribution and other unregistered semantics remain fail closed. This
state is separate from and cannot promote
`docs/release/launch-readiness.v1.json`.

Receiver delivery uses the fail-closed contracts in
`release-bundle-v1-runtime-contract.md` and the implementation in
`release-delivery-v1.mjs`. A `delivery-profile.v1` must name a receiver-owned
environment and cannot contain secrets. A `release-bundle.v1` must bind the
complete track payload, two-run whole-track model authorization, audit hash,
and exact model-owned audio QC coverage before publisher orchestration can start. CET4 remains exactly
1,180 cards / 108 boxes / 301 audio entries. The formal product adds CET6 as a
separate exact 1,234-card / 110-box / 328-audio bundle. A `closed_beta` profile
enables only CET4; a `production` profile enables CET4 and CET6 in canonical
order, while each bundle and active pointer remains track-scoped.

The personal development environment is explicitly rejected by the delivery
profile validator. The repository-local receiver adapter uploads and
re-downloads private assets for byte/hash verification, stages evidence-bound
content, verifies it, and changes the current release pointer last. The
blank-environment drill remains pending and must not be inferred from green
unit tests.

Read-only bundle verification:

```bash
node infra/cloudbase/verify-release-bundle.mjs \
  --profile path/to/delivery-profile.json \
  --bundle path/to/release-bundle.json
```

Unified receiver delivery is dry-run by default:

```bash
node infra/cloudbase/deliver-release.mjs preflight --profile path/to/delivery-profile.json
node infra/cloudbase/deliver-release.mjs provision --profile path/to/delivery-profile.json
node infra/cloudbase/deliver-release.mjs deploy --profile path/to/delivery-profile.json
node infra/cloudbase/deliver-release.mjs publish \
  --profile path/to/delivery-profile.json \
  --bundle path/to/release-bundle.json
node infra/cloudbase/deliver-release.mjs verify \
  --profile path/to/delivery-profile.json \
  --bundle path/to/release-bundle.json \
  --operator service:<receiver-operator>
node infra/cloudbase/deliver-release.mjs rollback \
  --profile path/to/delivery-profile.json \
  --release cet4-beta-previous
```

Every command reports `receiver-delivery-report.v2`. Its
`backend_deployment_id` deterministically binds the exact clean `main` commit,
receiver profile/environment and fixed API/worker topology. Deploy injects this
non-secret ID into `softbook-api`; deploy and verify both reread the remote
function configuration and fail on ID, handler, runtime, timeout or fixed-code
drift. The reread also binds the non-secret signing key ID, runtime/store modes
and SMS provider. Public reports expose only those values plus variable names,
never secret values. Every report
has canonical execution start/completion timestamps; apply and verify require
`--operator service:<machine-principal>` (or `model:`, `agent:`, `oidc:`) for
auditable raw execution identity.

Formal `production-deployment` evidence must bind tracked strict JSON for the
applied deploy report, passed verify report, delivery profile and release
bundle. The launch validator recomputes their exact commit/profile/environment,
backend deployment, API/worker, active CET4 release, 1,180-card/301-audio,
zero-imported-user-data and retained-parent relationships. A first release with
no retained parent cannot satisfy this gate; publish and retain an earlier
verified release before selecting the final release candidate. Pilot, dry-run
and simulation reports remain ineligible.

Build a formal CET4 bundle only after the exact full-track model authorization,
linked full-track model review, scoped audit, 301-asset model-owned QC and
private audio bytes exist. The command verifies a
temporary bundle and removes it by default:

```bash
node scripts/build_formal_release_bundle.mjs \
  --profile path/to/delivery-profile.json \
  --content-payload path/to/cet4-formal-payload.json \
  --authorization path/to/full-track-authorization.json \
  --model-review path/to/full-track-model-review.json \
  --audit path/to/card-quality-audit.json \
  --audio-qc-dir path/to/audio-qc \
  --asset-root path/to/payload-assets \
  --output-dir path/to/cet4-bundle-b \
  --bundle-id cet4-bundle-b \
  --release-id cet4-release-b \
  --parent-release-id cet4-release-a \
  --created-at <ISO-8601> \
  --release-at <ISO-8601>
```

Add `--apply --operator service:<receiver-operator>` only from Node 22.13.0 on
clean `main` exactly equal to `origin/main` to retain the fully core-verified
output. Report v2 binds the exact commit, profile/bundle/model-authorization/
model-review/audit/audio-manifest/QC-index hashes and execution window without
exposing the machine-local output path. The builder does not create
authorization/QC, deploy, publish, or create readiness evidence.

The raw report remains gate-ineligible. Formal media launch evidence also
remains unregistered and fail-closed until the repository defines a trusted
media-run receipt with type-specific provenance semantics; structural model
acceptance records cannot manufacture playback, device, provider, or other
external facts.

Add `--apply --operator service:<receiver-operator>` only to `provision`,
`deploy`, `publish`, or `rollback` after machine preflight passes. Apply requires
Node 22.13.0 and clean exact `main`.
Receiver/CI secrets are never stored in `delivery-profile.v1`:

```text
SOFTBOOK_AUTH_TOKEN_SECRET
SOFTBOOK_AUTH_INDEX_SECRET
SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM
SOFTBOOK_SMS_PROVIDER=webhook
SOFTBOOK_SMS_WEBHOOK_URL
SOFTBOOK_SMS_WEBHOOK_SECRET
```

## CET4 controlled-pilot delivery

The 120-card pre-beta pilot uses `controlled-pilot-profile.v1` and
`controlled-pilot-bundle.v1`; it cannot be passed to the formal closed-beta
command above. Its dedicated command is also dry-run by default:

```bash
node infra/cloudbase/deliver-controlled-pilot.mjs preflight \
  --profile path/to/controlled-pilot-profile.json
node infra/cloudbase/deliver-controlled-pilot.mjs provision \
  --profile path/to/controlled-pilot-profile.json
node infra/cloudbase/deliver-controlled-pilot.mjs deploy \
  --profile path/to/controlled-pilot-profile.json
node infra/cloudbase/deliver-controlled-pilot.mjs publish \
  --profile path/to/controlled-pilot-profile.json \
  --bundle path/to/controlled-pilot-bundle.json
node infra/cloudbase/deliver-controlled-pilot.mjs verify \
  --profile path/to/controlled-pilot-profile.json \
  --bundle path/to/controlled-pilot-bundle.json \
  --operator service:<receiver-operator>
```

Add `--apply --operator service:<receiver-operator>` only to `provision`,
`deploy`, or `publish`. Apply has the same Node 22.13.0, clean exact-`main`,
independent receiver, collection, and secret
requirements as formal delivery, but injects
`SOFTBOOK_RUNTIME_MODE=controlled_pilot`. All reports and releases remain
`gate_eligible=false`. The command does not create content approval, audio QC,
receiver credentials, launch evidence, or a rollback authority.

Or select the direct Tencent Cloud SMS adapter:

```text
SOFTBOOK_SMS_PROVIDER=tencentcloud
SOFTBOOK_SMS_TENCENT_SECRET_ID
SOFTBOOK_SMS_TENCENT_SECRET_KEY
SOFTBOOK_SMS_TENCENT_REGION=ap-guangzhou
SOFTBOOK_SMS_TENCENT_SDK_APP_ID
SOFTBOOK_SMS_TENCENT_SIGN_NAME
SOFTBOOK_SMS_TENCENT_TEMPLATE_ID
SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS=code,expiry_minutes
```

`SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS` must match the approved template's
placeholder order and may be `code` or `code,expiry_minutes`. The deploy command
injects the public `signing_key_id` from the profile, sets production mode, and
does not carry `SOFTBOOK_SMS_DEV_CODE`. Webhook mode sends
`softbook-sms-delivery.v1` over HTTPS with a bearer secret. Tencent Cloud mode
uses SMS v20210111, converts the verified mainland mobile number to E.164, and
accepts only one matching `Ok` send status. A successful local or CI test does
not prove that either provider sent a real message; the receiver still needs a
lifecycle-managed SMS smoke after its sign and template are approved.

### Audited closed-beta entitlement

Closed-beta premium access is granted without a payment route through the
dry-run-first operator contract in `beta-entitlement-v1-runtime-contract.md`.
Create a local, untracked `beta-entitlement-command.v1` file and review the
phone-free plan before apply:

```bash
node infra/cloudbase/manage-beta-entitlement.mjs \
  --profile path/to/delivery-profile.json \
  --command path/to/beta-entitlement-command.json

node infra/cloudbase/manage-beta-entitlement.mjs \
  --profile path/to/delivery-profile.json \
  --command path/to/beta-entitlement-command.json \
  --apply
```

The same command shape is used for `grant` and `revoke`; both bind the exact
closed-beta `campaign_id`, and apply requires an identified `model:`, `agent:`,
`service:` or `oidc:` `actor_id`. Apply also requires Node 22.13.0 plus clean exact
`main`. The active grant and its audit history are stored together in
`softbook_beta_entitlements`; the base membership document is not modified.
The privacy-safe `beta-entitlement-report.v2` binds commit/profile/campaign,
command hash, operator, execution, receiver/write safety, unchanged base digest
and verified beta state without exposing the phone or command bytes. Command
reports remain `gate_eligible=false` until a registered formal drill wrapper
revalidates the exact grant/replay/revoke sequence. Command files contain phone
numbers and must not be committed or included in a release bundle.

Formal `beta-entitlement-drill` evidence uses one tracked profile and four
tracked applied report v2 files in exact order: grant, idempotent grant replay,
revoke and idempotent revoke replay. The wrapper revalidates one candidate
campaign/account/grant/operator/commit and one unchanged base-membership digest;
it never ingests the phone-bearing command files.

### Receiver Space sync drill

Use `run-space-sync-drill.mjs` to plan, then exercise two distinct same-account
sessions against the receiver closed-beta API:

```bash
node infra/cloudbase/run-space-sync-drill.mjs \
  --profile path/to/delivery-profile.json

SOFTBOOK_CET_SPACE_DRILL_TOKEN_A=... \
SOFTBOOK_CET_SPACE_DRILL_TOKEN_B=... \
node infra/cloudbase/run-space-sync-drill.mjs \
  --profile path/to/delivery-profile.json \
  --apply \
  --operator service:receiver-operator
```

Apply proves cross-client favorite/sleep convergence, exact duplicate
idempotency, conflicting replay no-commit behavior, independent dimensions and
initial-state cleanup on one exact CET4 content version. The report hashes the
card identity and never emits tokens or phone data. It remains
`gate_eligible=false` until registered `space-sync-test` semantics revalidate a
real receiver report.

Formal `space-sync-test` evidence wraps one tracked receiver profile and one
tracked applied report v1, then revalidates candidate commit/profile/environment,
expected backend ID, content version, exact revision sequence, cross-client
observations, duplicate/conflict no-commit behavior, dimension independence and
cleanup. Closed-beta readiness separately requires `production-deployment`;
this wrapper cannot substitute its locally expected backend identity for remote
deployment inspection.

Controlled-pilot continued access uses a separate receiver-only overlay and
never reuses the formal closed-beta grant. Create an untracked
`pilot-entitlement-command.v1`, verify its phone-free dry-run plan, then apply
the exact same command only from clean `main`:

```bash
node infra/cloudbase/manage-pilot-entitlement.mjs \
  --profile path/to/controlled-pilot-profile.json \
  --command path/to/pilot-entitlement-command.json

node infra/cloudbase/manage-pilot-entitlement.mjs \
  --profile path/to/controlled-pilot-profile.json \
  --command path/to/pilot-entitlement-command.json \
  --apply
```

The command must bind the exact profile pilot ID. Its active overlay and audit
history share one `softbook_pilot_entitlements` document; Bootstrap exposes an
independent `pilot_entitlement_revision`, clients continue to receive the
existing `premium` stage, and no client grant or revoke route exists. Apply uses
the receiver IAM-authenticated non-HTTP function invocation: that function
also requires a command-bound HMAC from the receiver-only
`SOFTBOOK_PILOT_OPERATOR_SECRET`, reads base membership plus beta and pilot overlays, rederives the claimed
stages, and commits the audit and active overlay in one database transaction.
The CLI then independently rereads the audit event before reporting success.

### Real-provider SMS smoke

The repository provides a database-free, two-phase provider smoke. Dry-run
validates the selected production adapter without sending:

```bash
SOFTBOOK_SMS_SMOKE_PHONE=<receiver-owned-test-phone> \
SOFTBOOK_SMS_SMOKE_TARGET_ID=<receiver-environment-id> \
SOFTBOOK_SMS_RECEIVER_ADAPTER_ID=service:sms-receiver-adapter \
SOFTBOOK_SMS_RECEIVER_KEY_ID=<receiver-key-id> \
SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY="$SMS_RECEIVER_PUBLIC_KEY" \
node infra/cloudbase/smoke-sms-provider.mjs prepare \
  --state docs/agent-runs/artifacts/sms-provider-smoke.json \
  --format json
```

Run the same command with `--apply` only from clean `main` exactly matching
`origin/main`. The raw phone and generated code then exist only in the ignored,
mode-0600 state file. Prepare also pins the receiver adapter, key ID, and
Ed25519 public-key fingerprint; the receiver private key is forbidden in the
sender process. A separate receiver automation reads the real inbox or
receiver webhook, then invokes `sms-receiver-adapter.mjs` with its received code,
receipt, run/target identity and Ed25519 private key to write a signed mode-0600
artifact. These values are supplied by the receiver job; no person copies or
enters the code. The sender state is not accepted as delivery proof:

```bash
SOFTBOOK_SMS_RECEIVER_ADAPTER_ID=service:sms-receiver-adapter \
SOFTBOOK_SMS_RECEIVER_RUN_ID=<prepare-run-id> \
SOFTBOOK_SMS_RECEIVER_TARGET=<receiver-environment-id> \
SOFTBOOK_SMS_RECEIVER_SOURCE=receiver_webhook \
SOFTBOOK_SMS_RECEIVER_RECEIVED_AT=<receiver-observed-ISO-time> \
SOFTBOOK_SMS_RECEIVER_CODE=<receiver-observed-code> \
SOFTBOOK_SMS_RECEIVER_RECEIPT_ID=<receiver-receipt-id> \
SOFTBOOK_SMS_RECEIVER_KEY_ID=<receiver-key-id> \
SOFTBOOK_SMS_RECEIVER_PRIVATE_KEY="$RECEIVER_JOB_PRIVATE_KEY" \
node infra/cloudbase/sms-receiver-adapter.mjs \
  --output docs/agent-runs/artifacts/sms-receiver-evidence.json --format json

SOFTBOOK_SMS_RECEIVER_ADAPTER_ID=service:sms-receiver-adapter \
SOFTBOOK_SMS_RECEIVER_KEY_ID=<receiver-key-id> \
SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY="$SMS_RECEIVER_PUBLIC_KEY" \
SOFTBOOK_SMS_SMOKE_VERIFIER=service:sms-smoke-verifier \
SOFTBOOK_SMS_SMOKE_VERIFIER_RUN_ID=<independent-machine-run-id> \
node infra/cloudbase/smoke-sms-provider.mjs confirm \
  --state docs/agent-runs/artifacts/sms-provider-smoke.json \
  --receiver-evidence docs/agent-runs/artifacts/sms-receiver-evidence.json \
  --report docs/release/evidence/raw/sms-provider-smoke.json \
  --apply --format json
```

The receiver private key must not be present in the confirmation process.
Successful confirmation verifies the signature and atomically removes both
private artifacts before publishing the PII-free raw `sms-provider-smoke.v2` report below
`docs/release/evidence/raw/`. The target ID must be the receiver environment ID
used by the release candidate. A wrong code is limited to three local attempts;
expiry or the third mismatch deletes private state and produces no evidence.
Use `discard --state ... --apply` to remove an interrupted state.

The raw report is not itself a gate record. Formal evidence must wrap it in a
`launch-gate-evidence.v1` artifact for `sms-provider-smoke`, set
`measurements.report_role` to the raw report role, and bind the same run ID,
repository commit, receiver environment, send/confirmation window, receiver
adapter/key fingerprint, machine verifier/run, receiver receipt fingerprint, release candidate, independent
attestation, file size, and SHA-256.
The launch validator re-hashes both files and validates these bindings; a direct
raw report, generic summary, local test, or mismatched wrapper remains
ineligible.

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
`trial_available`, the first eligible Learning Session returns `trial` with an
exact server clock, and purchase returns `premium`.
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
mutations from pushing a shared test identity into `premium`. Set
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
exact UDID. An explicit `SOFTBOOK_CET_IOS_DEVICE` wins over the display-name
selector; otherwise one booted device is used, or
`SOFTBOOK_CET_IOS_SIMULATOR` must resolve without ambiguity. A shutdown target
is booted and awaited before local tests or build work begins. The wrapper then
reuses an existing Metro server or starts one and lets the React Native CLI
build and install the debug app with `--udid` and unfiltered build diagnostics.
Launch flags and the bundle identifier are also validated before local device
work. Only after those inputs, target resolution,
local runtime-profile tests, the debug build, and installed app lookup have
passed does it run the remote write smoke. After that it relaunches
`com.softbook.cet` with `xcrun simctl launch` and the required `SIMCTL_CHILD_*`
environment variables. This matters because
`AppDelegate.swift` reads the app process environment, not the shell environment
around the helper script. Defaults can be overridden with
`SOFTBOOK_CET_IOS_DEVICE`, `SOFTBOOK_CET_IOS_SIMULATOR`,
`SOFTBOOK_CET_IOS_BUNDLE_ID`, and `SOFTBOOK_CET_METRO_PORT`. A failed or
successful run always stops a Metro process started by this wrapper; an already
running Metro server is reused and left alone. The exit trap also removes the
exact lifecycle-owned CloudBase records. The command never opens an acceptance
window, waits for `Ctrl+C`, or asks a person to operate the app.

The launch wrapper records only build, install, remote-contract and Simulator
launch facts. A successful launch reports
`automated_simulator_launch_verified=true`, while
`automated_simulator_ui_evidence_verified=false`,
`automated_real_device_evidence_verified=false`, and `gate_eligible=false`.
It cannot promote a Simulator launch into UI or physical-device evidence.

Model+harness Maestro acceptance after remote launch:

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
After the exact flow succeeds, the wrapper reports
`automated_simulator_ui_evidence_verified=true` but keeps
`automated_real_device_evidence_verified=false` and `gate_eligible=false`.
Missing Java, Maestro, Simulator, flow, or remote capability fails closed; there
is no person-operated fallback. A physical-device executor must independently
observe the real device before the real-device field can become true.

Local mock flow:

```bash
node infra/cloudbase/mock-softbook-api.mjs
```

To smoke an imported full-corpus payload instead of the built-in fixture, set
`SOFTBOOK_CET_CARD_SOURCE_CET4_FILE` and/or
`SOFTBOOK_CET_CARD_SOURCE_CET6_FILE` to validated card-source JSON files before
starting the mock. The mock revalidates each supplied payload and fails closed
before serving it.

In another shell:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="http://127.0.0.1:48731" \
SOFTBOOK_CET_TEST_CODE="123456" \
SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1 \
SOFTBOOK_CET_SMOKE_WRITE=1 \
SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 \
node infra/cloudbase/smoke-softbook-api.mjs
```
