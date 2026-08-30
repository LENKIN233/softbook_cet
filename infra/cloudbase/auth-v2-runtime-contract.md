# Softbook Auth v2 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`

## Authority boundary

`product_truth`:

- A user signs in with a mainland China mobile number and SMS code before
  learning.
- Account state is server-authoritative and can resume across devices.
- Authentication state is revocable; logout and account deletion must clear
  access rather than relying on a client-only flag.
- A successful local or CI check is not production evidence or launch
  readiness.

`implementation_hypothesis`:

- The `/v2` paths, payload field names, token lifetimes, collection names, and
  CloudBase persistence below are the current backend migration contract.
- The mobile runtime consumes `/v2` auth, protected `/v2/bootstrap`, the
  authenticated `/v2/learning/card-source`, and session-owned `/v2/membership`
  reads/mutations. Retained `/v1` aliases are development-only; the full remote
  profile has no production `/v1` dependency.
- An account deletion request creates a durable exact task. The repository now
  implements the leased, retryable worker and receiver two-function deployment
  plan that erase current user-data collections and remove the login fence
  last. Receiver execution/monitoring, provider cleanup, retention policy
  enforcement, and a completed real-environment deletion drill remain separate
  production work.

## Runtime policy

The function accepts
`SOFTBOOK_RUNTIME_MODE=development|production|controlled_pilot`.
The deployed default entry requires that value explicitly; missing or blank
configuration fails before a store, fixed code, or HTTP route becomes usable.

Development mode keeps `/v1` available and supplies the existing fixed-code
adapter when no SMS provider is injected. Production mode fails closed unless:

- `SOFTBOOK_AUTH_TOKEN_SECRET` is a non-default value of at least 32 characters;
- `SOFTBOOK_AUTH_INDEX_SECRET` is an explicit stable value of at least 32
  characters and differs from the token-signing secret;
- the store declares a persistent, non-memory implementation;
- a non-development SMS provider is injected; and
- request-code receives a trusted client IP from the CloudBase gateway context.

Production mode disables all `/v1` routes with `410 legacy_api_disabled`.
There is intentionally no environment-only switch that silently turns the
development SMS adapter into a production provider. Internal constructor
overrides also cannot re-enable v1 or disable the trusted-client-IP requirement
in production.

In development only, protected `/v1` product routes accept either a valid legacy
token or an active server-backed v2 access token. The authenticated card-source
and membership paths have moved to `/v2`; their development `/v1` aliases are
evaluated after the non-development v1 rejection, so none can expose v1 in
production or controlled pilot.

The unaudited `/v2/membership/purchase` placeholder is development-only.
Production and controlled pilot return `404 route_not_found`; closed-beta
premium access remains available only through the audited receiver-operator
entitlement operation.

## Endpoints

### Request a challenge

```http
POST /v2/auth/request-code
content-type: application/json

{"phone_number":"13800138000"}
```

Success returns `challenge_id`, `delivery`, `expires_at`, and
`retry_after_seconds`. It never returns the SMS code or its digest. The service
applies independent, persistent ten-minute counters per HMAC-keyed phone number
and trusted client IP. Defaults are five requests per phone and twenty per IP;
the raw values and enumerable bare hashes are not used as counter keys.
Sign-in challenge persistence derives the canonical account key and
transactionally checks the account-deletion task in the same store operation.
While the task exists, `/v2/auth/request-code` returns
`account_deletion_pending` and cannot leave a sign-in challenge that survives
worker completion. The separately purpose-bound deletion-recovery route below
is the only challenge-creation exception to that login fence.

### Verify a challenge

```http
POST /v2/auth/verify-code
content-type: application/json

{
  "challenge_id":"opaque-id",
  "phone_number":"13800138000",
  "sms_code":"123456",
  "device_id":"installation-id",
  "device_name":"user-visible device label"
}
```

Challenges expire after five minutes, are consumed once, and lock after five
failed attempts. Verification returns:

```json
{
  "data": {
    "access_token": "softbook_v2...",
    "expires_in": 900,
    "phone_number": "13800138000",
    "refresh_expires_at": "2026-08-19T08:00:00.000Z",
    "refresh_token": "softbook_refresh...",
    "session_id": "opaque-id",
    "token_type": "Bearer"
  }
}
```

The access token is HMAC-signed and expires after 15 minutes. The refresh token
expires after 30 days. Database records contain only the SMS-code HMAC digest
and current refresh-token SHA-256 hash, never either raw secret.
For provider-owned challenges, every active provider rejection is also
committed as one local failed attempt; reaching the configured limit locks the
local challenge even if a later provider verification would succeed.

### Read the authorized card source

`GET /v2/learning/card-source?track=cet4|cet6` derives canonical membership
from the active session before serialization. Trial and premium receive the
full ordered source; free and trial-available receive only the stable prefix
`ceil(card_count * 0.5)`. The first Learning Session also selects only from
that already-delivered prefix, atomically activates Trial, and permits the next
canonical card-source read to return the full source. The response keeps the
full release content identity but never serializes inaccessible suffix card
bodies, answer keys, or analysis.

### Rotate a refresh token

```http
POST /v2/auth/refresh
content-type: application/json

{"refresh_token":"softbook_refresh..."}
```

Every successful call rotates the refresh token. A cryptographically valid
older rotation is treated as replay and revokes the entire session. Random or
malformed tokens fail without disclosing whether a session exists.
Receiver drills require each returned refresh payload to advance exactly one
generation; changed bytes with the same or an older rotation do not prove rotation.

### Logout

```http
POST /v2/auth/logout
Authorization: Bearer <access_token>
```

The route revokes the token's server session and returns `204`. Repeating the
same signed logout request is idempotent.

### Request account deletion

```http
POST /v2/account/deletion
Authorization: Bearer <access_token>
```

The route creates or returns one queued deletion task for the account, revokes
all of that phone number's sessions, and returns `202`. Retrying with the same
still-valid signed access token returns the same task. Session creation checks
the durable deletion task in the same persistence transaction and rejects new
login with `account_deletion_pending`; refresh rotation and the shared active
session guard independently check the same task. Every future protected `/v2`
route must use that guard, so an interrupted account-wide revocation cannot
restore either token rotation or API access.

The active-session guard is not the final write authority. Every account
product-state mutation also reads the account-keyed deletion task inside the
same storage transaction that would commit the mutation. Any present task—
including queued, processing, a future finalizing state, or malformed state—
fails closed with `account_deletion_pending`. This prevents work that passed
authentication immediately before deletion from recreating Learning,
Progress, Space, membership, beta, or pilot data after a worker sweep.

### Recover an unknown deletion request

PC Web may recover a durable credential-free `requesting` marker without
recreating a general login session:

```http
POST /v2/account/deletion/recovery/request-code
content-type: application/json

{"phone_number":"13800138000"}
```

The response contains only `challenge_id`, `delivery`, `expires_at`,
`retry_after_seconds`, and `purpose: account_deletion_recovery`. The challenge
uses the ordinary phone/IP rate limits and verification-attempt limit, but its
persisted purpose is cryptographically included in the code digest and checked
transactionally on verify. Neither a sign-in challenge nor a recovery
challenge can be verified through the other purpose's endpoint.

```http
POST /v2/account/deletion/recovery/verify-code
content-type: application/json

{
  "challenge_id":"opaque-id",
  "phone_number":"13800138000",
  "sms_code":"123456"
}
```

When the exact account task exists, verification returns:

```json
{
  "data": {
    "schema_version": "account-deletion-recovery.v1",
    "state": "pending",
    "safe_to_register": false,
    "deletion_request": {
      "id": "delete_opaque",
      "requested_at": "2026-08-30T00:00:00.000Z",
      "status": "queued"
    }
  }
}
```

`status` is `queued` or `processing`. If no task currently exists, the exact
projection is `state: none`, `safe_to_register: true`, and
`deletion_request: null`. Because the worker intentionally retains no
tombstone, `none` never claims that a prior request was accepted or completed.
Recovery verification returns no access token, refresh token, or session ID
and cannot authorize any protected route.

## Persistent records

CloudBase currently uses:

- `softbook_auth_rate_limits`
- `softbook_auth_challenges`
- `softbook_auth_sessions`
- `softbook_account_deletions`

Challenge verification, rate-counter increments, active-session reads, refresh
rotation, and single-session revocation run inside CloudBase transactions.
Every newly created challenge also stores its exact `sign_in` or
`account_deletion_recovery` purpose; a missing or mismatched purpose fails
verification.
Account-wide revocation enumerates the phone's sessions after the deletion task
is durable.

The independently deployed `softbook-account-deletion-worker` runs
`index.accountDeletionWorkerMain` from the same tested artifact on the
`account-deletion-every-minute` timer. Each `account-deletion-task.v1` stores
the account key, phone, exact derived phone-rate key, retry fields and a random
claim-bound five-minute lease. A stale worker cannot complete or requeue a task
owned by another lease.

Queued tasks and expired processing leases are queried independently, merged by
`requested_at`, and then capped by the worker run limit. Older live processing
leases therefore cannot occupy a pre-filter page and starve queued deletion
requests.

Receiver deployment rereads the worker function name, handler, runtime, timeout,
empty custom environment-variable set, and exact timer configuration. The
worker receives none of the HTTP API's auth, SMS, signing, or operator secrets.
Deployment creates a missing timer, preserves an already exact timer without
duplicate creation, and fails closed on handler, variable, or schedule drift
before reporting success.

The worker deletes current account-keyed Auth Session, check-in, Progress,
Learning Event/cursor/sequence/migration/session/state, pilot-round continuation,
and Space action/lineage/revision/state records; phone-filtered SMS challenges
plus retained legacy daily-progress, learning-state and Space-state records;
phone-keyed base membership, membership revision, beta entitlement and pilot
entitlement; and only the phone rate-limit key. It repeats the phone challenge
sweep as the final guarded data mutation immediately before task completion.
Shared IP rate limits and global content releases remain untouched. Every
individual erasure runs in a transaction that re-reads the account-deletion
task and requires the current lease ID before deleting. A stale worker therefore
cannot continue after a newer worker owns or removes the task and cannot erase
data written by a clean post-completion re-registration. Every deletion is
idempotently re-read or re-queried, the task is removed last, partial failure
returns the same live lease to queued, and a completed task leaves no tombstone
so a clean re-registration is allowed.

Before production deployment, infrastructure work must add collection TTL
policies for expired rate-limit and challenge records, least-privilege access,
backup/restore coverage, and deletion-task worker monitoring.

## Error contract

Expected client-actionable codes include:

- `invalid_phone_number`
- `sms_rate_limited`
- `sms_delivery_failed`
- `invalid_sms_code`
- `expired_sms_challenge`
- `sms_challenge_locked`
- `sms_challenge_consumed`
- `invalid_auth_token`
- `expired_auth_token`
- `invalid_refresh_token`
- `expired_refresh_token`
- `refresh_token_reused`
- `revoked_auth_session`
- `client_ip_unavailable`
- `account_deletion_pending`

Server errors keep a stable code but use the generic public message from the
existing API error envelope.

## Receiver session revocation drill report

`infra/cloudbase/run-session-revocation-drill.mjs` is dry-run by default. Apply
requires Node 22.13.0, clean local `main` exactly equal to `origin/main`, a
tracked regular 100644 receiver closed-beta profile whose bytes equal exact
`HEAD`, an identified operator, and two fresh access plus
refresh credential pairs supplied only through process environment. The access
claims must identify the same phone account and different server session IDs;
each refresh claim must match its access session. Both access tokens are first
confirmed against receiver Bootstrap. Token payload decoding is identity
comparison only and never replaces server validation.

Client A rotates its refresh pair, then exact reuse of the old refresh token
must return `refresh_token_reused` and revoke that session. The rotated refresh
and access credentials must both return `revoked_auth_session`. Client B must
then successfully rotate its refresh pair and confirm the rotated access token
against Bootstrap; this proves both halves of the sibling session were active
after client A's replay. Client B logout and exact signed logout replay use the
rotated access token and must both return 204; the rotated access and refresh
credentials must then return `revoked_auth_session`. Apply intentionally
destroys both dedicated test sessions and cannot restore them.

The machine operator is part of the report, so apply rejects an operator value
that embeds the decoded phone, including separator-obfuscated digit forms, or
credential-shaped material before any session or data-plane request. This keeps execution attribution without creating a phone/token
side-channel through an otherwise valid machine principal.

Before the four session credentials are read, apply removes all four credential
variables from every control-plane subprocess environment, reuses the receiver
control-plane inspector, and requires the deployed `softbook-api` function identity,
runtime, handler, timeout, signing key, store/runtime modes and deterministic
backend deployment ID to match the exact commit and tracked profile. Requests
then use only that profile's exact HTTPS API base, set `redirect=error`, reject
any changed response URL and enforces one ten-second deadline through response
body parsing. A profile outside the
repository, a dirty or untracked profile, deployment drift, redirect or timeout
fails before token transmission.

The privacy-safe `session-revocation-drill-report.v1` binds repository commit,
raw profile SHA-256, expected backend deployment identity, one content/release
scope, hashes of the two opaque session IDs, exact status sequence, write safety
and execution. It never contains phone or token values and remains
`gate_eligible=false`. Repository mocks and raw output do not constitute a real
receiver `session-revocation-test`; a later formal wrapper must rehash and bind
the report to the exact candidate and must not substitute expected backend
identity for the separate production-deployment gate.

## Explicit remaining work

This contract does not satisfy the launch gate. The repository now implements
both a receiver-owned HTTPS webhook and a direct Tencent Cloud SMS v20210111
adapter. The Tencent path binds one mainland-China E.164 recipient to an
environment-supplied approved SdkAppId, sign, template, and explicit
`code`/`expiry_minutes` parameter order; only a single `Ok` status for that
recipient is accepted. Credentials and template configuration remain outside
tracked files, and provider details are not exposed through the public auth
error envelope.

`infra/cloudbase/smoke-sms-provider.mjs` implements a database-free two-phase
provider acceptance path. Apply mode is restricted to clean exact `main`, keeps
the phone and generated code in a mode-0600 ignored file, and requires an
independent receiver adapter to write a mode-0600 `sms-receiver-evidence.v1`
artifact signed with its Ed25519 private key. Confirmation receives only the
configured public key, revalidates the exact run, target, source, receipt,
timestamp, key ID, signature and code against the adapter/key/fingerprint
pinned before the send, then deletes both private artifacts before
publishing a strict PII-free `sms-provider-smoke.v2` raw report below
`docs/release/evidence/raw/`. That report is not gate-eligible by itself; formal
launch evidence must wrap it in the typed `launch-gate-evidence.v1` contract.
Repository tests and the launch validator cover this workflow, but neither raw
nor formal evidence exists until the receiver actually performs and confirms a
real send.

Remaining blockers include:

- Tencent Cloud SMS account enablement, signature/template approval, an
  actually executed lifecycle-managed delivery smoke raw report, and its typed
  formal wrapper;
- production secret injection, signing-key key-ring rotation, and stable index
  secret custody;
- production Web origin allowlisting and gateway abuse-control review;
- device-list and remote-device-revocation surfaces;
- receiver deployment/monitoring of the deletion-worker timer, collection
  retention rules, provider cleanup, and completed deletion drill; repository
  tests already cover explicit post-deletion re-registration and the no-
  tombstone task-removal policy;
- mobile secure refresh-token storage, automatic refresh, logout cleanup, and
  `/v2` migration;
- abuse, concurrency, penetration, backup, and production observability
  evidence.
