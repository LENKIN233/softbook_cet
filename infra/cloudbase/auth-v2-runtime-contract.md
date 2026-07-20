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
- The mobile runtime still consumes `/v1`; no production client is switched by
  this contract alone.
- An account deletion request creates a durable queued task. Actual user-data
  erasure, retention policy enforcement, and deletion-provider orchestration
  remain separate production work.

## Runtime policy

The function accepts `SOFTBOOK_RUNTIME_MODE=development|production`.

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

### Rotate a refresh token

```http
POST /v2/auth/refresh
content-type: application/json

{"refresh_token":"softbook_refresh..."}
```

Every successful call rotates the refresh token. A cryptographically valid
older rotation is treated as replay and revokes the entire session. Random or
malformed tokens fail without disclosing whether a session exists.

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
login with `account_deletion_pending`; refresh rotation independently checks the
same task, so an interrupted account-wide revocation cannot restore access.

## Persistent records

CloudBase currently uses:

- `softbook_auth_rate_limits`
- `softbook_auth_challenges`
- `softbook_auth_sessions`
- `softbook_account_deletions`

Challenge verification, rate-counter increments, refresh rotation, and
single-session revocation run inside CloudBase transactions. Account-wide
revocation enumerates the phone's sessions after the deletion task is durable.

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

## Explicit remaining work

This contract does not satisfy the launch gate. Remaining blockers include:

- Tencent Cloud SMS provider integration, signature/template approval, and
  delivery smoke evidence;
- production secret injection, signing-key key-ring rotation, and stable index
  secret custody;
- production Web origin allowlisting and gateway abuse-control review;
- device-list and remote-device-revocation surfaces;
- deletion worker, retention rules, provider cleanup, and completed deletion
  drill;
- mobile secure refresh-token storage, automatic refresh, logout cleanup, and
  `/v2` migration;
- abuse, concurrency, penetration, backup, and production observability
  evidence.
