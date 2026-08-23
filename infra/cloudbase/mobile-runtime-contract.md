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
  membership reads/mutations use authenticated session-owned `/v2` routes;
  their `/v1` aliases remain development-only and production continues to
  reject every `/v1` route.
- The replacement learning mutation boundary is contract-defined in
  `infra/cloudbase/learning-events-v2-runtime-contract.md`. The repository-local
  CloudBase backend and current mobile runtime implement it locally. The client
  reads `learning-session.v1`, resolves only its selected card from the matching
  source, and persists an immutable selection-bound event plus pseudonymous
  device cursor before advancing the card. It removes only strict acknowledged
  events, refreshes bootstrap, and reads a fresh session before the next card or
  dependent writes.
  While an event is pending, check-in and space writes are queued instead of
  overtaking it, and a routine Mine/foreground refresh cannot replace local
  intent with a pre-acknowledgement bootstrap snapshot.
  Legacy daily/learning snapshot writes and both legacy physical-space snapshot
  methods are globally disabled. Explicit check-in and physical-space changes
  use strict v2 commands; learning and space counts retain their separate server
  authorities. Neither backend nor mobile release deployment is implied by this
  repository-local implementation.
- Bootstrap content and signed content-manifest parsing are exact
  discriminated unions. The mobile runtime now accepts the separate formal or
  development shape and the literal `controlled_pilot` shape, including exact
  dual-platform semantic-version fields, canonical pilot expiry and
  `gate_eligible=false`; mixed or unknown fields fail closed. Remote Bootstrap
  now applies an early fail-closed minimum-version gate against the actual
  installed native iOS/Android identity before returning canonical state, and
  the content-manifest repository independently applies the signed minimum
  only after strict Ed25519 verification. This repository implementation is not
  receiver deployment or real-device proof.

## Runtime Activation

Remote mode is installed in `apps/mobile/index.js` before `App` is registered.

Environment:

- `SOFTBOOK_CET_REMOTE_BASE_URL`: enables remote runtime profile.
- `SOFTBOOK_CET_REMOTE_API_KEY`: optional; sent as `x-api-key`.
- `SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS`: JSON object containing the
  release-owned content-manifest key IDs and 32-byte lowercase-hex Ed25519
  public keys. Remote content-manifest consumption fails closed without one.
- `SOFTBOOK_CET_LEARNING_TRACK`: optional, `cet4` or `cet6`; default `cet4`.
- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES`: optional comma-separated features to
  keep local while auth remains remote. Allowed values:
  `accountBootstrap,contentManifest,learningSource,membership,progressSync,spaceState,learningState`.

If `SOFTBOOK_CET_REMOTE_BASE_URL` is present, auth is remote. By default all
remote-capable features are also remote.

Remote release-bound content uses synchronous
`NativeModules.SoftbookAppInfo` constants `{platform, version}`. `platform`
must be `android` or `ios` and must equal React Native `Platform.OS`; `version`
and the applicable server minimum must be strict semantic versions with a
required `x.y.z` core and only valid optional prerelease/build identifiers.
Numeric prerelease identifiers compare numerically, alphanumeric identifiers
compare lexically, a stable release sorts after its prerelease, and build
metadata does not change precedence. The JS runtime does not trim, fill missing
components, or coerce native `1.0` into `1.0.0`. Missing, malformed,
mismatched, unsupported, or below-minimum native identity fails closed. Fully
local runtime does not read this module.

`spaceState` can be remote only when `accountBootstrap` is also remote. The
action queue requires a validated canonical content version before replay and
canonical bootstrap reconciliation after acknowledgement, so this dependency
fails during runtime configuration rather than on the first user action.

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

`data.content` is an exact discriminated union. Development and formal
production responses retain exactly `card_count`, `minimum_client_version`,
`parent_release_id`, `published_at`, `release_id`, `source`, and `version`;
development uses null release fields, while a formal release requires its
release ID, semantic minimum version and publication time. The exact
`controlled_pilot` variant instead contains only `card_count`, `expires_at`,
`gate_eligible`, `minimum_client_versions`, `pilot_id`, `release_class`,
`release_id`, `source`, and `version`. Its `release_class` is the literal
`controlled_pilot`, `gate_eligible` is the literal `false`, and
`minimum_client_versions` contains exactly semantic-version `android` and `ios`
entries. Both variants require `source` to contain exactly `id` and `label`.

The React Native Bootstrap repository parses this pilot variant locally and
requires a canonical UTC `expires_at` later than the response's
`generated_at`. It rejects missing platforms, unknown or mixed formal fields,
invalid pilot/release identifiers, expired content, and gate drift. It retains
the parsed minimum versions and release identity, selects the actual platform's
minimum, and requires the actual installed native version to meet it before the
repository returns the snapshot. A formal release uses its single non-null
`minimum_client_version` for either supported native platform. Development
content skips this check only because its release fields contain no minimum.
This ordering blocks App hydration, outbox replay, and product-state writes on
an unsupported installed client.

The additive top-level `component_revisions` object uses
`bootstrap-component-revisions.v1`: base-plus-beta Membership;
requested-track event sequence plus account-and-track session revision plus
Space dependency for Learning; account-wide event sequence plus monotonic
account-day check-in plus Space dependency for Progress; and account-wide
Space state revision. `generated_at` and `acknowledged_at` are observation and
audit timestamps, not same-millisecond conflict ordering, and no scalar global
bootstrap revision exists. Content SHA and release identity remain scope
identity rather than a monotonic counter.

Progress also carries `learning_authority`: `account_events_v2`,
`legacy_account_baseline`, or `empty`. Mobile requires the marker, rejects a
non-v2 authority with a positive learning sequence, rejects v2 authority at
sequence zero, requires an empty authority to carry zero pending review, and
keeps both authority and pending review strict at an unchanged sequence. The
server makes the legacy account baseline stable across China-day rollover; the
client does not relax that invariant.

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

Bootstrap request identity additionally includes requested track, China day,
and whether the read is a forced post-result refresh. A monotonically increasing
client request generation suppresses a late response from an older request in
the same auth session; changing track/day or forcing terminal/mismatch recovery
cannot reuse the older in-flight promise. Revision-aware merging rejects owner
revision regression and validates equal-revision owner invariants rather than
using response timestamps. A terminal Space 409 starts a fresh generation and
may reconcile to the same state revision. A content-version mismatch keeps the
command active, refreshes once, and retries only after a changed content scope;
an unchanged refresh cannot create an automatic loop.

Staged development smoke may explicitly keep `accountBootstrap` local. The
remaining `/v1` card-source and membership aliases are development migration
bridges, not production contracts. Remote learning and membership use
authenticated session-owned `/v2` routes; Bootstrap remains the canonical
cross-owner account read.

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

In `controlled_pilot`, the same response may instead contain one exact
`pilot-round-completion.v1` in `round_completion`, with `selection` and
`next_due_at` both null. Mobile resolves only the receipt's `space_card_id`
and ordered unique `review_card_ids` from the matching canonical source,
requires review IDs to remain inside the server-declared accessible prefix,
and never infers or reorders them. Its existing Learning completion object
shows the compact Space address and review count with one primary “继续下一轮”
action. That action sends the exact authenticated `pilot-round-continue.v1`
command to `POST /v2/learning/round/continue`; only a strict matching
acknowledgement permits a fresh session read. Failure keeps the receipt visible
and cannot advance locally. Other runtime modes do not expose this endpoint.

The opaque `selection_id`, server phase, selected card, and content version are
persisted in `learning-event-outbox.v2` before the completed card leaves its
result state. One pending unseen event blocks another completion. After a strict
event acknowledgement, the client refreshes bootstrap and reads a fresh session
before showing another card.

### Learning Card Source

```http
GET /v2/learning/card-source?track=cet4
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

The endpoint requires an active v2 session, accepts only one explicit `track`
query, and derives no content or account authority from client input. In
`production` and `controlled_pilot`, the selected track must already have a
matching current release and missing content fails closed. In development, when
`SOFTBOOK_STORE_MODE=cloudbase`, a missing track may seed the current development
card records before returning the same response shape. The `/v1` alias remains
development-only and is never used by the remote mobile profile.
Use `node infra/cloudbase/import-card-source.mjs --file <json> --track <track>`
for controlled development imports; dry-run is the default, and `--apply`
upserts only after the same validator accepts the payload.
For pre-publication listening-card validation with complete audio descriptors,
use `scripts/build_card_make_runtime_payload.mjs` with
`--payload-mode audio-bundle-candidate`, an exact `--scope-card-ids` list, and
the matching passing card-workspace `--audio-technical-audit`. This mode copies
the bound MP3 bytes into a local candidate bundle and validates the card source
with safe relative `asset_path` entries, hashes, durations, sizes, and optional
back-side transcripts. It does not create environment-specific
`storage_file_id` values and therefore is not accepted by the development
importer's `--apply` path. It also does not create content approval, perceptual
audio QC, a release bundle, deployment evidence, or launch approval.

For a complete pre-publication track handoff, use
`--payload-mode full-track-candidate` with the exact complete track card-ID list
and that track's passing technical-audio audit. The builder fails closed unless
the result is exactly CET4 1,180 cards / 108 boxes / 301 audio assets or CET6
1,234 cards / 110 boxes / 328 audio assets, covers all five core interactions,
and consumes every audited asset exactly once. This candidate mode proves that
the complete content can enter the runtime schema; it deliberately does not
replace per-track model authorization or model-owned complete-asset perceptual
audio QC.
Run the complete mobile parser, evaluator, representative UI, manifest-binding,
audio-control, and visible-metadata checks with:

```bash
node scripts/run_full_track_candidate_mobile_acceptance.mjs \
  --candidate-payload <full-track-candidate.json> \
  --checked-at <canonical UTC ISO-8601 timestamp>
```

Its report remains `gate_eligible=false` and explicitly records that signed
manifest, model-owned complete-asset audio QC, persistent receiver, and
automated real-device proof are absent.

An external `audio-bundle-candidate` payload can be checked against the real
mobile parser, interaction evaluator, Learning render branches, analysis
detail, audio-control surface, catalog mapping, and exact card-to-asset binding
with:

```bash
node scripts/run_audio_bundle_candidate_mobile_acceptance.mjs \
  --candidate-payload <audio-bundle-candidate.json> \
  --checked-at <canonical UTC ISO-8601 timestamp>
```

The runner accepts only an unpublished (`release=null`) external payload made
entirely of audio-bound listening cards with one release-bundle asset per card.
It uses a mode-`0600` temporary fixture, reconstructs a synthetic local
manifest solely to exercise the existing audio-control UI, verifies that no
runtime identifiers leak into rendered output, deletes the fixture, and
requires the tracked worktree to remain unchanged. Its safe report always
records `signed_manifest_verified=false`, `model_audio_qc_verified=false`,
`persistent_receiver_verified=false`,
`automated_real_device_evidence_verified=false`, and
`gate_eligible=false`; it is therefore pre-publication product acceptance, not
content authorization, signed-manifest evidence, deployment, or launch proof.

Use `node infra/cloudbase/audit-card-sources.mjs` for read-only validation of
the deployed CET4/CET6 documents after imports or deploys, including active
`spec/box-catalog.json` prefix and path alignment.

Remote card-source failure is fail-closed. The app renders the existing retry
state and never substitutes bundled development cards in remote mode.

Before receiver deployment, the approved external candidate can be exercised
through the same authenticated v2 card-source, Learning Session, Learning
Events, five-card round continuation, Bootstrap and signed content-manifest
services with:

```bash
node infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs \
  --candidate-payload <card-make-candidate.json> \
  --pilot-review <controlled-pilot-review.json> \
  --approval <controlled-pilot-approval.json> \
  --audit <scoped-card-quality-audit.json> \
  --checked-at <ISO-8601 timestamp>
```

The command hash-binds the exact payload, review, approval, audit and 120-card
scope, then hydrates only synthetic private storage IDs in memory. It does not
approve audio, use persistent receiver storage, deploy anything, or exercise a
real device; its report therefore always states those gaps and
`gate_eligible=false`.

The same exact approved artifacts can additionally cross the real backend wire
shapes, mobile repositories, pinned-key verifier, canonical-answer evaluation
for all 98 auto-scored cards, confident self-assessment completion for all 22
flip cards, and one Learning UI completion for each interaction family through:

```bash
node scripts/run_controlled_pilot_mobile_acceptance.mjs \
  --candidate-payload <card-make-candidate.json> \
  --pilot-review <controlled-pilot-review.json> \
  --approval <controlled-pilot-approval.json> \
  --audit <scoped-card-quality-audit.json>
```

The acceptance runner requires all four inputs to remain outside this product
repository. It creates a mode-`0600` backend-response fixture in a private
temporary directory, passes only an ephemeral Ed25519 public key to mobile,
verifies that the worktree is unchanged, and removes the fixture before
returning a content-free count/ID report. It covers parser, repository,
signature, owned scoring/self-assessment state and rendered Learning behavior
only. Its retained capability flag
`installed_client_minimum_version_enforced` deliberately remains `false`:
the suite injects a deterministic identity to exercise repository wiring but
does not execute an installed native release or prove the version gate on a
real device. It also does not inject a
receiver release key, approve or play audio bytes on a real device, use
persistent receiver state, deploy, or produce gate-eligible evidence.

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

### Content Manifest

```http
GET /v2/content/manifest?track=cet4&content_version=sha256%3A...
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

The exact response and signing rules are owned by
`infra/cloudbase/content-manifest-v1-runtime-contract.md`. The mobile repository
accepts only one of two exact signed `content-manifest.v1` variants:

- Formal content has no `release_class` and contains exactly `assets`,
  `content_version`, `minimum_client_version`, `parent_release_id`,
  `release_id`, `schema_version`, and `track`.
- Controlled-pilot content additionally discriminates with
  `release_class=controlled_pilot` and contains exactly `assets`,
  `content_version`, `expires_at`, `gate_eligible`,
  `minimum_client_versions`, `pilot_id`, `release_class`, `release_id`,
  `schema_version`, and `track`. It requires CET4, a future canonical UTC
  expiry, `gate_eligible=false`, and exactly semantic-version `android` and
  `ios` minimums.

Both variants remain inside the Ed25519-signed `{access, manifest}` payload.
The mobile parser rejects unknown or mixed fields and rejects any pilot download
whose expiry is later than the signed release expiry. Backend URL issuance also
caps each pilot download expiry at that same release expiry. Only after strict
signature verification does the repository select the applicable formal or
platform-specific pilot minimum and compare it with the actual native client
identity. A missing/invalid identity, platform mismatch, unsupported platform,
or lower semantic version fails closed before the verified manifest can be
returned to Learning. Receiver-owned key injection, persistent receiver
execution, private-object device download, real-device minimum-version proof,
and real-device playback remain pending; the pilot manifest and every
repository pilot smoke result remain `gate_eligible=false` and cannot replace
formal beta or launch evidence.

### Membership Entitlement

```http
GET /v2/membership/entitlement
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
      "trial_started_at": null,
      "trial_expires_at": null,
      "trial_remaining_seconds": 0,
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
- `trial_started_at`: canonical UTC timestamp or `null` before first start.
- `trial_expires_at`: canonical UTC timestamp exactly 120 hours after start, or
  `null` before first start.
- `trial_remaining_seconds`: server-derived non-negative integer; positive only
  for an active trial.
- `trial_started_at_entry_count`: positive integer or `null`.

### Membership Mutations

```http
POST /v2/membership/purchase
POST /v2/membership/dismiss-recovery
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{}
```

Response: same shape as membership entitlement.

There is no remote client-owned trial-start mutation. A successful Learning
Session with an eligible selection starts an available trial atomically; the
mobile client consumes the returned timestamps and remaining seconds.

### Daily Check-In v2

```http
POST /v2/progress/check-in
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "day_key": "2026-04-30"
}
```

The request body is exact: `day_key` is required and every identity, snapshot,
counter, or unknown field is rejected. Account identity comes only from the
active v2 session.

Success is a strict `daily-check-in.v2` response containing the matching
`day_key`, `checked_in_today: true`, and canonical `acknowledged_at`. Repeating
the command is monotonic and idempotent. A failed, ambiguous, cancelled, or
stale-session request remains queued as credential-free
`check_in_daily_progress` account context plus `dayKey`; only a strict matching
response removes it. The app then re-reads bootstrap before treating progress
as reconciled. The server stores this command in an independent account-and-day
record; learning-event migration cannot overwrite it and retained legacy daily
documents stay unchanged. CloudBase's adapter-owned `_id` is stripped before
the exact five-field business schema is checked; no other unknown stored field
is accepted.

After restart, the app may restore the local queued presentation only when the
persisted command matches both the active account and bootstrap day. Canonical
`checked_in_today: false` clears a stale same-day local value when no such
command exists. Event-derived completion counts never change the check-in
status to synchronized.

During queue hydration, a legacy `sync_daily_progress` entry migrates only when
its complete snapshot records an explicit checked-in state, a valid day,
nonnegative integer counters, and a total consistent with learning plus review;
all counters are then discarded. Every other legacy daily snapshot entry is
dropped. Card completion never creates this command. Both former v1 daily and
learning snapshot-write routes return `410` and retained legacy documents are
read-only migration input.

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

### Physical-Space Actions v2

```http
POST /v2/space/actions
Authorization: Bearer <access_token>
content-type: application/json
x-softbook-client: mobile
x-api-key: <optional>

{
  "schema_version": "space-actions.v2",
  "track": "cet4",
  "content_version": "sha256:<64-lowercase-hex>",
  "actions": [
    {
      "action_id": "space_installation_01_42",
      "card_id": "100101",
      "dimension": "favorite",
      "value": true,
      "client_occurred_at": "2026-07-24T10:00:00.000Z"
    }
  ]
}
```

The body is exact and contains no phone number, day key, counters, credentials,
or complete space snapshot. A batch contains 1-20 immutable actions. `favorite`
and `sleep` merge independently by client timestamp and then action ID, so
changing one dimension cannot erase the other. Track, content version, and card
IDs must match the current normalized card source.

The client persists a credential-free `apply_space_action` command before
applying optimistic UI. Only a strict ordered `space-actions-ack.v2` result with
`applied`, `stale`, or `duplicate`, plus a matching canonical `space-state.v2`
projection, removes that action. A transient failure retains the exact action
for replay with the current in-memory credential. The immutable action fields
and ID remain unchanged; a same-track content update rebinds only the request
envelope to the currently validated version, while cross-track rebinding is
forbidden. Startup uses canonical bootstrap as the base and overlays only
same-account, same-track durable pending actions; unqueued local state cannot
overwrite the server.

Exact action-ID replay returns `duplicate`; reusing an action ID with different
content rejects the complete batch. `GET /v1/space/state-sync` and
`POST /v1/space/state-sync` always return 410. The full storage, migration,
ordering, and acknowledgement contract is in
`infra/cloudbase/space-actions-v2-runtime-contract.md`.

## Integration Smoke Checklist

1. Remote runtime starts with `SOFTBOOK_CET_REMOTE_BASE_URL`.
2. Learning, space, and statistics are blocked by auth gate before login.
3. `/v2/auth/request-code` returns a challenge.
4. `/v2/auth/verify-code` returns a rotating session and matching phone number.
5. `/v2/bootstrap?track=<track>&day_key=<YYYY-MM-DD>` returns matching scope,
   content SHA-256, membership, progress, learning, and physical-space state.
6. Writes performed through the active v2 endpoints are visible in a later
   bootstrap read for the same account and absent for another account.
7. `/v2/learning/card-source?track=<track>` returns non-empty valid
   `card_records` and a `content_version` equal to the preceding bootstrap
   content version.
8. At least one card for each core interaction is available in the remote card
   source before full visual QA: `flip`, `multiple_choice`, `lock`,
   `elimination`, `swipe`.
9. `/v2/membership/entitlement` returns a valid session-owned entitlement.
10. The first eligible `/v2/learning/session` read changes `trial_available` to
    `trial` and returns the exact server trial clock; invalid or empty selection
    does not consume it.
11. Membership purchase and dismiss recovery return valid entitlement payloads.
12. `/v2/learning/session?track=<track>` returns a strict selection whose track,
    source, and content version match the loaded card source.
13. Completing that selected card persists `learning-event-outbox.v2` with the
    exact selection ID before UI advance and POSTs `/v2/learning/events`
    without identity fields.
14. A strict event acknowledgement removes the event, then `/v2/bootstrap`
    returns the derived learning and daily state and a fresh
    `/v2/learning/session` read chooses the next card before dependent writes.
15. Explicit check-in POSTs exact `{day_key}` to `/v2/progress/check-in`, waits
    for a strict matching acknowledgement, and reconciles bootstrap; card
    completion never uploads a daily snapshot. Restart recovery preserves the
    queued presentation only for an exact active-account/day command, and
    event-derived progress never confirms check-in.
16. Favorite/sleep changes persist an immutable action before optimistic UI,
    POST exact `space-actions.v2`, validate the strict acknowledgement, and
    reconcile through bootstrap.
17. Temporary 503 retains the exact event and immutable space action. Returning
    to 2xx never changes their IDs or immutable fields; only a same-track space
    request envelope may bind the action to the currently validated content
    version.
18. Expiring access credentials refresh once under concurrent requests; a
    rejected refresh or repeated 401 clears account-bound persistence.
19. Remote card-source or session failure renders retry state without
    bundled-card fallback.
20. Both methods on `/v1/space/state-sync` and both former daily/learning
    snapshot writes remain globally disabled with 410.

## Local Mock Validation

Before the real backend URL is available, validate this handoff with the local
mock server:

```bash
node infra/cloudbase/mock-softbook-api.mjs
```

The local mock may serve validated full-corpus payloads by setting
`SOFTBOOK_CET_CARD_SOURCE_CET4_FILE` and/or
`SOFTBOOK_CET_CARD_SOURCE_CET6_FILE` before startup. Injected files pass through
the same import validator as the built-in mock source; this is local runtime
evidence only and does not write CloudBase or establish launch readiness.

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
membership mutations do not change a shared fixed acceptance-test phone. Isolated
runs assert the expected membership stage sequence: `trial_available` before
Learning Session, `trial` after its first eligible selection, and `premium`
after purchase.

Expected high-level output:

```text
[ok] request-code: 200
[ok] verify-code: token received
[ok] bootstrap: sha256:<digest>; release=none
[ok] membership entitlement: trial_available
[ok] learning card-source: 5 cards from mock-cet4-source
[ok] learning session: learning:100101
[ok] daily check-in: 200
[ok] legacy snapshot APIs: 410
[ok] learning-events v2: accepted then duplicate at server_sequence=1
[ok] space-actions v2: applied then duplicate
[ok] bootstrap after writes: sha256:<digest>; release=none
[ok] learning-session trial: trial; remaining=432000
[ok] membership purchase: premium
[ok] membership dismiss-recovery: premium
[ok] bootstrap after membership mutations: sha256:<digest>; release=none
```

## Current Frontend Code Pointers

- `apps/mobile/src/runtime/appRuntimeConfig.ts`
- `apps/mobile/src/runtime/installedClientVersion.ts`
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
