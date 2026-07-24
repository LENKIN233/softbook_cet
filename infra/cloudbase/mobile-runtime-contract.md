# Softbook CET Frontend Backend Runtime Contract

Scope: handoff for backend deployment/integration. This file is derived from
the current React Native frontend runtime and repository code only.

Referenced active specs:

- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/card-system.json`
- `spec/space-operations.json`

Current boundary:

- Product truth: React Native client, authenticated learning, top-level nav
  `learning / space / statistics / mine`, single-card learning flow, physical
  space hierarchy, daily-level sync, shared membership entitlement.
- Implementation hypothesis: the concrete REST endpoints and payload names below
  are the current mobile runtime shape. They can be changed later, but changing
  them requires updating the mobile repositories and tests.
- The server-side `/v2` auth/session foundation is documented separately in
  `infra/cloudbase/auth-v2-runtime-contract.md`. Mobile authentication now uses
  that contract. Mobile login and restored sessions now reconcile through
  `/v2/bootstrap` before learning or product-state writes. Card payload and
  non-learning product mutations remain on `/v1` only as a development
  migration bridge; production continues to reject every `/v1` route.
- The replacement learning mutation boundary is contract-defined in
  `infra/cloudbase/learning-events-v2-runtime-contract.md`. The repository-local
  CloudBase backend and current mobile runtime implement it locally. The client
  reads `learning-session.v1`, resolves only its selected card from the matching
  source, and persists an immutable selection-bound event plus pseudonymous
  device cursor before advancing the card. It removes only strict acknowledged
  events, refreshes bootstrap, and reads a fresh session before the next card or
  dependent writes.
  While an event is pending, daily and space writes are queued instead of
  overtaking it, and a routine Mine/foreground refresh cannot replace local
  intent with a pre-acknowledgement bootstrap snapshot.
  After an account accepts a v2 event, legacy learning-state writes are rejected
  while daily progress becomes a check-in-only compatibility bridge; submitted
  learning and space counters no longer have authority. Neither backend nor
  mobile release deployment is implied by this repository-local implementation.

## Runtime Activation

Remote mode is installed in `apps/mobile/index.js` before `App` is registered.

Environment:

- `SOFTBOOK_CET_REMOTE_BASE_URL`: enables remote runtime profile.
- `SOFTBOOK_CET_REMOTE_API_KEY`: optional; sent as `x-api-key`.
- `SOFTBOOK_CET_LEARNING_TRACK`: optional, `cet4` or `cet6`; default `cet4`.
- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES`: optional comma-separated features to
  keep local while auth remains remote. Allowed values:
  `accountBootstrap,learningSource,membership,progressSync,spaceState,learningState`.

If `SOFTBOOK_CET_REMOTE_BASE_URL` is present, auth is remote. By default all
remote-capable features are also remote.

All remote feature requests after auth require:

```http
Authorization: Bearer <access_token>
x-softbook-client: mobile
x-api-key: <api key, optional>
```

## Endpoints

### Request SMS Code

```http
POST /v2/auth/request-code
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "phone_number": "13800138000"
}
```

Success returns `challenge_id`, `expires_at`, and `retry_after_seconds`. The
challenge is bound to the submitted phone number and must be supplied during
verification.

Failure: non-2xx renders `Remote auth request-code failed with <status>.`.

### Verify SMS Code

```http
POST /v2/auth/verify-code
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "challenge_id": "opaque-id",
  "phone_number": "13800138000",
  "sms_code": "123456"
}
```

Response:

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

`data.phone_number` must match the requested phone number. A refreshed response
must also preserve `session_id`.

### Refresh and Logout

```http
POST /v2/auth/refresh
content-type: application/json

{"refresh_token":"softbook_refresh..."}
```

The mobile coordinator refreshes on restore and before protected requests when
the access token has at most 60 seconds remaining. Concurrent demand shares one
refresh operation. The complete rotated credential pair is written to Keychain
or Keystore before it becomes current in memory.

```http
POST /v2/auth/logout
Authorization: Bearer <access_token>
```

Logout first attempts server revocation, then always writes the local revocation
tombstone and clears secure credentials, user state, and account-bound queued
mutations. A network failure cannot keep the device logged in.

Both access and refresh tokens use `auth-session.v2` secure storage. Neither may
enter AsyncStorage. Persisted mutation context contains only `phone_number`; the
current access token is injected in memory during replay. Mutation identifiers
also contain no credentials; hydration rewrites identifiers created by the old
token/phone-based membership retry format. `auth-session.v1` is invalidated
because it cannot be upgraded without refresh credentials.

Generic mutation queue operations are serialized and use candidate persistence:
memory changes only after AsyncStorage succeeds, and storage failures reject the
caller. A remote result removes or increments retry state only when the queue
head is byte-equivalent to the entry that was actually sent; an updated same-ID
entry survives a late result and is replayed separately.

### Canonical Bootstrap

```http
GET /v2/bootstrap?track=cet4&day_key=2026-07-20
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

The response returns `bootstrap.v2` content-version metadata, membership,
daily progress, learning card state, nullable scheduler cursor, and physical
space. It never accepts a phone number and returns explicit empty server state
for missing account/day/track documents. The full response and production
content-release boundary are defined in
`infra/cloudbase/bootstrap-v2-runtime-contract.md`.

The React Native client calls this endpoint after login and restored-session
authentication, before replaying queued mutations or enabling product-state
writes. It validates the response schema and request scope, then uses server
membership, daily progress, learning cursor/card state, and physical space as
the reconciliation baseline. The loaded card source must match bootstrap track,
card count, card IDs, interactions, and content SHA-256 before stored learning
state can hydrate the surface. The reconciled snapshot is not written to local
persistence, pushed remotely, or used to replay queued mutations until that
content check completes.

The request never contains `phone_number`. A transient bootstrap failure keeps
an otherwise valid auth session available for retry, but the client fails closed
when there is no previously validated canonical state and required content: it
does not open learning, replay queued mutations, push restored snapshots, grant
a local trial, or substitute bundled development cards. A successful reconnect
with no pending learning event re-runs bootstrap before generic mutation replay.
When an immutable learning event is already pending against a previously
validated bootstrap/content pair, reconnect preserves the local completion,
re-reads bootstrap only to validate that the content identity is still current
without mapping its pre-acknowledgement projections, then replays the event and
refreshes canonical state immediately after acknowledgement before dependent
daily or space mutations.

Replay, bootstrap, and authenticated HTTP authorization handling are scoped to
the originating auth session ID, not phone number alone. A late 401/403 from a
signed-out or replaced session cannot refresh or invalidate the current
session, including when the same phone number authenticated again.

Staged development smoke may explicitly keep `accountBootstrap` local. The
remaining `/v1` card source and product mutations are still a development
migration bridge, not a production contract. Remote membership canonical reads
come from bootstrap; the legacy entitlement read is no longer used by the full
remote mobile profile.

### Learning Session

```http
GET /v2/learning/session?track=cet4
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

The strict `learning-session.v1` payload is defined in
`infra/cloudbase/learning-session-v1-runtime-contract.md`. Remote learning
requires it and the card-source response to match on track, source ID, and
content SHA-256. The client renders only the returned `selection.card_id`; it
does not choose another card by local membership, sleep, review, interaction,
or catalog order. `selection: null` is a valid server result and cannot trigger
local-card fallback.

When the response membership stage differs from the bootstrap snapshot, such as
the first session changing `trial_available` to `trial`, mobile refreshes and
verifies canonical bootstrap before presenting the session. It does not
synthesize entitlement details from the session response.

The opaque `selection_id`, server phase, selected card, and content version are
persisted in `learning-event-outbox.v2` before the completed card leaves its
result state. One pending unseen event blocks another completion. After a strict
event acknowledgement, the client refreshes bootstrap and reads a fresh session
before showing another card.

### Learning Card Source

```http
GET /v1/learning/card-source?track=cet4
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

Response:

```json
{
  "data": {
    "source": {
      "id": "remote-cet4-source",
      "label": "Remote CET4 Source"
    },
    "track": "cet4",
    "content_version": "sha256:<64 lowercase hex characters>",
    "card_records": []
  }
}
```

`track` must be `cet4` or `cet6` and must match the query.
`content_version` is computed by the backend from the normalized ordered source
and must match `/v2/bootstrap` before canonical learning state can hydrate the
loaded cards. A mismatch fails closed because it indicates that the two reads
observed different content revisions.

CloudBase development backend note: when `SOFTBOOK_STORE_MODE=cloudbase`, this
endpoint reads the `softbook_card_sources` collection by track (`cet4` or
`cet6`). If a track document is missing, the function seeds the current
development card records into that collection before returning the same response
shape. This persistence detail must not change the mobile contract below.
Use `node infra/cloudbase/import-card-source.mjs --file <json> --track <track>`
for controlled development imports; dry-run is the default, and `--apply`
upserts only after the same validator accepts the payload.
Use `node infra/cloudbase/audit-card-sources.mjs` for read-only validation of
the deployed CET4/CET6 documents after imports or deploys, including active
`spec/box-catalog.json` prefix and path alignment.

Remote card-source failure is fail-closed. The app renders the existing retry
state and never substitutes bundled development cards in remote mode.

Every card record must satisfy:

- `card_id`: 6 digits.
- `knowledge_ref`: 4 digits.
- `card_id` starts with `knowledge_ref`.
- `space_metadata.box_ref === knowledge_ref`.
- `knowledge_ref` maps to an active `spec/box-catalog.json` prefix for the
  requested track, and `space_metadata.library/group/box` matches that catalog
  path.
- `front.eyebrow`, `front.prompt`, `front.support`, `front.context` are
  non-empty strings.
- `analysis.title`, `analysis.summary`, `analysis.exam_tip` are non-empty
  strings.
- `space_metadata.library`, `space_metadata.group`, `space_metadata.box` are
  non-empty strings.
- If `hint_layer` exists, `hint_layer.reveal_gesture` must be `下滑`.

Supported `interaction_id` values:

- `flip`: requires `back_text`; must not claim `auto_scoring: true`.
- `multiple_choice`: requires exactly 4 `options`, `auto_scoring: true`, and
  `answer_key.correct_option` that exists in options.
- `lock`: requires `lock_slots`, `auto_scoring: true`, and
  `answer_key.lock_pattern` aligned with slots.
- `elimination`: requires `elimination_items`, `auto_scoring: true`, and
  non-empty `answer_key.correct_items` that exist in items.
- `swipe`: requires exactly 2 `swipe_states`, `auto_scoring: true`, and
  `answer_key.correct_state` that exists in states.

### Membership Entitlement

```http
GET /v1/membership/entitlement
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

Response:

```json
{
  "data": {
    "entitlement": {
      "stage": "trial_available",
      "counted_entry_count": 0,
      "last_experience_ended_by": null,
      "recovery_prompt_visible": false,
      "trial_duration_days": 5,
      "trial_started_at_entry_count": null
    }
  }
}
```

Field rules:

- `stage`: `trial_available`, `trial`, `free`, or `premium`.
- `counted_entry_count`: non-negative integer.
- `last_experience_ended_by`: `trial`, `premium`, or `null`.
- `recovery_prompt_visible`: boolean.
- `trial_duration_days`: positive integer.
- `trial_started_at_entry_count`: positive integer or `null`.

### Membership Mutations

```http
POST /v1/membership/start-trial
POST /v1/membership/purchase
POST /v1/membership/dismiss-recovery
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "phone_number": "13800138000"
}
```

Response: same shape as membership entitlement.

If `start-trial` fails with a 5xx, the app locally allows the trial and queues
the mutation for replay.

### Daily Progress Sync

```http
POST /v1/progress/daily-sync
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "checked_in_today": true,
  "day_key": "2026-04-30",
  "favorite_count": 1,
  "learning_completed_count": 1,
  "pending_review_count": 0,
  "phone_number": "13800138000",
  "review_completed_count": 0,
  "sleeping_count": 0,
  "total_completed_count": 1
}
```

Success: any 2xx. Body is ignored.

Failure: non-2xx queues `sync_daily_progress` for replay.

For an unmigrated development account, this snapshot may seed the first v2
migration baseline. After the first accepted v2 learning event, the endpoint
only merges monotonic `checked_in_today`. Learning/review/pending/total values
cannot overwrite v2 projections, and favorite/sleeping counts are derived from
canonical space during bootstrap. Production rejects all `/v1` routes.

### Learning Events v2

```http
POST /v2/learning/events
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "schema_version": "learning-events.v2",
  "track": "cet4",
  "events": [
    {
      "event_id": "event_install_example_1",
      "selection_id": "sel_01J0EXAMPLESELECTION",
      "card_id": "100101",
      "interaction_id": "flip",
      "phase": "learning",
      "outcome": "confident",
      "answer_grade": "passed",
      "used_hint": false,
      "used_peek": true,
      "client_occurred_at": "2026-04-30T10:00:00.000Z",
      "content_version": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "device_cursor": {
        "device_id": "install_example",
        "sequence": 1
      }
    }
  ]
}
```

The body contains no phone number or credential. The response must be a strict
ordered `learning-events-ack.v2`; only matching `accepted` or `duplicate`
results remove events. Failure retains the byte-equivalent event and pauses
automatic retries until an explicit connectivity/app/new-event trigger. See
`infra/cloudbase/learning-events-v2-runtime-contract.md` for the complete
contract. Daily-progress and space-state changes made while an event is pending
enter the persisted generic mutation queue; they are not sent until event
acknowledgement and canonical bootstrap reconciliation complete.

Authenticated startup reads the account outbox count alongside bootstrap. If a
pending event survived a process restart, the stale card may render for content
validation but cannot advance again; exact replay, strict acknowledgement, and
post-acknowledgement bootstrap mapping must finish first. This recovery guard
allows exact duplicate replay plus at most one unseen selection-bound event; the
mobile client never creates multiple unseen events during one offline session.

### Space State Sync

```http
POST /v1/space/state-sync
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "day_key": "2026-04-30",
  "phone_number": "13800138000",
  "states": [
    {
      "card_id": "100101",
      "is_favorited": true,
      "is_sleeping": false,
      "last_modified_at": "2026-04-30T10:00:00.000Z"
    }
  ]
}
```

Success: any 2xx. Body is ignored.

Failure: non-2xx queues `sync_space_state` for replay.

## Integration Smoke Checklist

1. Remote runtime starts with `SOFTBOOK_CET_REMOTE_BASE_URL`.
2. Learning, space, and statistics are blocked by auth gate before login.
3. `/v2/auth/request-code` returns a challenge.
4. `/v2/auth/verify-code` returns a rotating session and matching phone number.
5. `/v2/bootstrap?track=<track>&day_key=<YYYY-MM-DD>` returns matching scope,
   content SHA-256, membership, progress, learning, and physical-space state.
6. Writes performed through the migration endpoints are visible in a later
   bootstrap read for the same account and absent for another account.
7. `/v1/learning/card-source?track=<track>` returns non-empty valid
   `card_records` and a `content_version` equal to the preceding bootstrap
   content version.
8. At least one card for each core interaction is available in the remote card
   source before full visual QA: `flip`, `multiple_choice`, `lock`,
   `elimination`, `swipe`.
9. `/v1/membership/entitlement` returns a valid entitlement.
10. Space gate can trigger `/v1/membership/start-trial`.
11. Membership purchase and dismiss recovery return valid entitlement payloads.
12. `/v2/learning/session?track=<track>` returns a strict selection whose track,
    source, and content version match the loaded card source.
13. Completing that selected card persists `learning-event-outbox.v2` with the
    exact selection ID before UI advance and POSTs `/v2/learning/events`
    without identity fields.
14. A strict event acknowledgement removes the event, then `/v2/bootstrap`
    returns the derived learning and daily state and a fresh
    `/v2/learning/session` read chooses the next card before dependent writes.
15. Explicit check-in can POST `/v1/progress/daily-sync`; card completion does
    not duplicate its v2-derived counts through that route.
16. Favorite/sleep changes can POST `/v1/space/state-sync`.
17. Temporary 503 retains the exact event or queued compatibility mutation;
    returning to 2xx replays it without changing event ID or payload.
18. Expiring access credentials refresh once under concurrent requests; a
    rejected refresh or repeated 401 clears account-bound persistence.
19. Remote card-source or session failure renders retry state without
    bundled-card fallback.

## Local Mock Validation

Before the real backend URL is available, validate this handoff with the local
mock server:

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

Use `SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1` for write-enabled smoke runs so
membership mutations do not change a shared manual-acceptance phone. Isolated
runs assert the expected membership stage sequence: `trial_available` before
mutations, `trial` after start-trial, and `premium` after purchase.

Expected high-level output:

```text
[ok] request-code: 200
[ok] verify-code: token received
[ok] bootstrap: sha256:<digest>; release=none
[ok] membership entitlement: trial_available
[ok] learning card-source: 5 cards from mock-cet4-source
[ok] daily progress sync: 200
[ok] learning-events v2: accepted then duplicate at server_sequence=1
[ok] space state sync: 200
[ok] bootstrap after writes: sha256:<digest>; release=none
[ok] membership start-trial: trial
[ok] membership purchase: premium
[ok] membership dismiss-recovery: free
[ok] bootstrap after membership mutations: sha256:<digest>; release=none
```

## Current Frontend Code Pointers

- `apps/mobile/src/runtime/appRuntimeConfig.ts`
- `apps/mobile/src/auth/authRepository.ts`
- `apps/mobile/src/bootstrap/accountBootstrapRepository.ts`
- `apps/mobile/src/bootstrap/accountBootstrapHydration.ts`
- `apps/mobile/src/bootstrap/accountBootstrapRuntimeConfig.ts`
- `apps/mobile/src/learning/remoteCardSource.ts`
- `apps/mobile/src/learning/sourceContract.ts`
- `apps/mobile/src/membership/membershipRepository.ts`
- `apps/mobile/src/sync/progressSyncRepository.ts`
- `apps/mobile/src/sync/learningEventOutbox.ts`
- `apps/mobile/src/sync/learningEventsRepository.ts`
- `apps/mobile/src/sync/learningEventSyncRepository.ts`
- `apps/mobile/src/space/spaceStateRepository.ts`
- `apps/mobile/src/sync/mutationQueueRepository.ts`
