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

## Runtime Activation

Remote mode is installed in `apps/mobile/index.js` before `App` is registered.

Environment:

- `SOFTBOOK_CET_REMOTE_BASE_URL`: enables remote runtime profile.
- `SOFTBOOK_CET_REMOTE_API_KEY`: optional; sent as `x-api-key`.
- `SOFTBOOK_CET_LEARNING_TRACK`: optional, `cet4` or `cet6`; default `cet4`.
- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES`: optional comma-separated features to
  keep local while auth remains remote. Allowed values:
  `learningSource,membership,progressSync,spaceState,learningState`.

If `SOFTBOOK_CET_REMOTE_BASE_URL` is present, auth is remote. By default all
remote-capable features are also remote.

All remote feature requests after auth require:

```http
Authorization: Bearer <auth_token>
x-softbook-client: mobile
x-api-key: <api key, optional>
```

## Endpoints

### Request SMS Code

```http
POST /v1/auth/request-code
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "phone_number": "13800138000"
}
```

Success: any 2xx. The mobile app does not read the response body.

Failure: non-2xx renders `Remote auth request-code failed with <status>.`.

### Verify SMS Code

```http
POST /v1/auth/verify-code
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "phone_number": "13800138000",
  "sms_code": "123456"
}
```

Response:

```json
{
  "data": {
    "auth_token": "token",
    "phone_number": "13800138000"
  }
}
```

`data.phone_number` must match the requested phone number.

### Learning Card Source

```http
GET /v1/learning/card-source?track=cet4
Authorization: Bearer <auth_token>
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
    "card_records": []
  }
}
```

`track` must be `cet4` or `cet6` and must match the query.

Every card record must satisfy:

- `card_id`: 6 digits.
- `knowledge_ref`: 4 digits.
- `card_id` starts with `knowledge_ref`.
- `space_metadata.box_ref === knowledge_ref`.
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
Authorization: Bearer <auth_token>
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
Authorization: Bearer <auth_token>
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
Authorization: Bearer <auth_token>
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

### Learning State Sync

```http
POST /v1/learning/state-sync
Authorization: Bearer <auth_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "day_key": "2026-04-30",
  "events": [
    {
      "card_id": "100101",
      "completed_at": "2026-04-30T10:00:00.000Z",
      "interaction_id": "flip",
      "is_favorited": false,
      "outcome": "confident",
      "phase": "learning",
      "used_hint": false,
      "used_peek": true
    }
  ],
  "phone_number": "13800138000",
  "source_id": "remote-cet4-source",
  "source_label": "Remote CET4 Source",
  "track": "cet4"
}
```

Success: any 2xx. Body is ignored.

Failure: non-2xx queues `sync_learning_state` for replay.

Allowed values:

- `interaction_id`: `flip`, `multiple_choice`, `lock`, `elimination`, `swipe`.
- `outcome`: `correct`, `incorrect`, `confident`, `review`.
- `phase`: `learning`, `review`.

### Space State Sync

```http
POST /v1/space/state-sync
Authorization: Bearer <auth_token>
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
3. `/v1/auth/request-code` returns 2xx.
4. `/v1/auth/verify-code` returns a token and matching phone number.
5. `/v1/learning/card-source?track=<track>` returns non-empty valid
   `card_records`.
6. At least one card for each core interaction is available in the remote card
   source before full visual QA: `flip`, `multiple_choice`, `lock`,
   `elimination`, `swipe`.
7. `/v1/membership/entitlement` returns a valid entitlement.
8. Space gate can trigger `/v1/membership/start-trial`.
9. Membership purchase and dismiss recovery return valid entitlement payloads.
10. Completing a card can POST `/v1/progress/daily-sync`.
11. Completing a learning/review card can POST `/v1/learning/state-sync`.
12. Favorite/sleep changes can POST `/v1/space/state-sync`.
13. Temporary 503 on membership/progress/learning-state/space-state queues the
    mutation; returning to 2xx replays it.

## Local Mock Validation

Before the real backend URL is available, validate this handoff with the local
mock server:

```bash
node infra/cloudbase/mock-softbook-api.mjs
```

In another shell:

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="http://127.0.0.1:48731" \
SOFTBOOK_CET_TEST_PHONE="13800138000" \
SOFTBOOK_CET_TEST_CODE="123456" \
SOFTBOOK_CET_SMOKE_WRITE=1 \
SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 \
node infra/cloudbase/smoke-softbook-api.mjs
```

Expected high-level output:

```text
[ok] request-code: 200
[ok] verify-code: token received
[ok] membership entitlement: trial_available
[ok] learning card-source: 5 cards from mock-cet4-source
[ok] daily progress sync: 200
[ok] learning state sync: 200
[ok] space state sync: 200
[ok] membership start-trial: trial
[ok] membership purchase: premium
[ok] membership dismiss-recovery: free
```

## Current Frontend Code Pointers

- `apps/mobile/src/runtime/appRuntimeConfig.ts`
- `apps/mobile/src/auth/authRepository.ts`
- `apps/mobile/src/learning/remoteCardSource.ts`
- `apps/mobile/src/learning/sourceContract.ts`
- `apps/mobile/src/membership/membershipRepository.ts`
- `apps/mobile/src/sync/progressSyncRepository.ts`
- `apps/mobile/src/sync/learningStateRepository.ts`
- `apps/mobile/src/space/spaceStateRepository.ts`
- `apps/mobile/src/sync/mutationQueueRepository.ts`
