# Softbook Bootstrap v2 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`

## Authority boundary

`product_truth`:

- Account, learning, physical-space, and membership state are shared across
  release surfaces and remain server-authoritative.
- Exact same-card cross-device resume is not required, but daily progress and
  useful learning state must survive a device change.
- Development cards, local cache, and green checks cannot become production
  content or launch evidence.

`implementation_hypothesis`:

- `GET /v2/bootstrap` is the current canonical account-read boundary.
- The current CloudBase adapter reads several collections for one response. It
  reports one `generated_at` observation, audit timestamps, and explicit
  owner-scoped component revisions, but does not claim a serializable
  cross-collection transaction or synthesize one scalar bootstrap revision.
- A scheduler cursor is nullable until `/v2/learning/session` persists one in
  the account-and-track `softbook_learning_sessions` record. Bootstrap overlays
  only its sanitized card/source/track identity and never infers an exact
  cursor from device-local state.
- Legacy `/v1` daily and learning snapshots can be read during migration, but
  the account-keyed `learning-events.v2` projections take priority after the
  first accepted v2 event. Legacy snapshots are not the final server scheduler.
- That first accepted event preserves valid legacy baselines for both tracks as
  sequence-zero projections, so migrating through CET4 cannot discard CET6
  history or vice versa.
- The v2 learning projection is track-scoped and survives a requested-day
  change. Daily completion aggregates remain keyed by the requested China
  product day. Pending review count is account-wide and derived from the latest
  accepted event per card.
- Favorite and sleeping state remain owned by physical space. Bootstrap
  overlays canonical space favorites onto learning card states and derives the
  progress `favorite_count` and `sleeping_count` from the same space snapshot
  rather than trusting legacy progress counters.
- Stored account learning sequences, v2 learning events, server-derived daily
  totals, FSRS projections, and learning-session cursors are revalidated before
  bootstrap returns them. Corrupt sequence authority, missing accepted-event
  fields, stale scheduler state, an invalid cursor scope or projection
  watermark, or inconsistent totals fail closed.
- CloudBase legacy physical-space discovery is paged outside the transaction;
  the deterministic account document is re-read and merged with that snapshot
  using doc-only transaction operations.
- Content metadata is an exact runtime-discriminated projection. Development
  and production retain the original seven-field shape; `controlled_pilot`
  returns its separate exact nine-field shape with pilot/release identity,
  exact Android/iOS minimum versions, canonical expiry, and
  `gate_eligible=false`. After parsing the complete response, the
  repository-local remote Bootstrap repository resolves the actual installed
  native platform and version and fails closed before returning the canonical
  snapshot unless that version meets the applicable release minimum. This
  precedes App hydration, mutation replay, or product-state writes.

## Request

```http
GET /v2/bootstrap?track=cet4&day_key=2026-07-20
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

Rules:

- `track` is required and must be `cet4` or `cet6`.
- `day_key` is required and must be a real calendar date in `YYYY-MM-DD` form.
- Account identity comes only from the active v2 session. The endpoint does
  not accept `phone_number` in a body or query.
- A missing, expired, or revoked session returns an auth error before any
  account state is read.
- PC Web sends `x-softbook-client: web`. Its force-fresh path uses the browser
  Fetch `cache: no-store` request option and does not add `Cache-Control`, so
  cross-origin preflight remains within the exact server allowlist
  `Authorization, Content-Type, X-Api-Key, X-Softbook-Client`.

## Response

```json
{
  "data": {
    "schema_version": "bootstrap.v2",
    "generated_at": "2026-07-20T10:00:00.000Z",
    "day_key": "2026-07-20",
    "track": "cet4",
    "component_revisions": {
      "schema_version": "bootstrap-component-revisions.v1",
      "membership": {
        "base_membership_revision": 0,
        "beta_entitlement_revision": 0
      },
      "learning": {
        "event_server_sequence": 0,
        "session_revision": 0,
        "space_revision": 0
      },
      "progress": {
        "learning_server_sequence": 0,
        "check_in_revision": 0,
        "space_revision": 0
      },
      "space": {
        "state_revision": 0
      }
    },
    "content": {
      "card_count": 5,
      "release_id": null,
      "minimum_client_version": null,
      "parent_release_id": null,
      "published_at": null,
      "source": {
        "id": "cloudbase-dev-card-source",
        "label": "CloudBase development card source"
      },
      "version": "sha256:<64 lowercase hex characters>"
    },
    "learning": {
      "acknowledged_at": null,
      "card_states": [],
      "cursor": null,
      "source": null
    },
    "membership": {
      "acknowledged_at": null,
      "stage": "trial_available",
      "counted_entry_count": 0,
      "last_experience_ended_by": null,
      "recovery_prompt_visible": false,
      "trial_duration_days": 5,
      "trial_started_at_entry_count": null
    },
    "progress": {
      "acknowledged_at": null,
      "checked_in_today": false,
      "day_key": "2026-07-20",
      "favorite_count": 0,
      "learning_completed_count": 0,
      "learning_authority": "empty",
      "pending_review_count": 0,
      "review_completed_count": 0,
      "sleeping_count": 0,
      "total_completed_count": 0
    },
    "space": {
      "acknowledged_at": null,
      "content_version": "sha256:<64 lowercase hex characters>",
      "schema_version": "space-state.v2",
      "states": [],
      "track": "cet4"
    }
  }
}
```

The example above shows the exact development/formal `content` variant. It
contains exactly `card_count`, `minimum_client_version`, `parent_release_id`,
`published_at`, `release_id`, `source`, and `version`; `source` contains exactly
`id` and `label`. Development uses null release fields. A formal production
release requires non-null release identity, semantic minimum client version,
and publication time.

In a `controlled_pilot` runtime, `data.content` instead contains exactly these
nine fields:

```json
{
  "card_count": 120,
  "expires_at": "2026-09-10T00:00:00.000Z",
  "gate_eligible": false,
  "minimum_client_versions": {
    "android": "1.0.0",
    "ios": "1.0.0"
  },
  "pilot_id": "cet4-pilot-2026",
  "release_class": "controlled_pilot",
  "release_id": "cet4-controlled-pilot-2026",
  "source": {
    "id": "cet4-controlled-pilot-source",
    "label": "CET4 Controlled Pilot"
  },
  "version": "sha256:<64 lowercase hex characters>"
}
```

This variant is valid only for the outer `track=cet4`. Its
`minimum_client_versions` object contains exactly semantic-version `android`
and `ios` entries, `expires_at` is a canonical UTC timestamp later than the
response's `generated_at`, `gate_eligible` is exactly `false`, and
`release_class` is exactly `controlled_pilot`. The formal-only
`minimum_client_version`, `parent_release_id`, and `published_at` fields are
forbidden. Unknown fields, a missing platform, invalid pilot/release identity,
an expired release, gate drift, or formal/pilot field mixing fails closed in
the repository-local mobile parser.

For a formal release, the single non-null `minimum_client_version` applies to
both supported native platforms. For a controlled pilot, mobile selects only
the minimum for its actual platform from `minimum_client_versions`. Installed
identity comes from synchronous `NativeModules.SoftbookAppInfo` constants
containing `platform` (`android` or `ios`) and `version`; the native platform
must also equal React Native `Platform.OS`. Both installed and minimum values
must be strict semantic versions with a required `x.y.z` core and only valid
optional prerelease/build identifiers. Numeric prerelease identifiers compare
numerically, alphanumeric identifiers compare lexically, a stable release sorts
after its prerelease, and build metadata does not change precedence. No
trimming, missing-component fill, or coercion such as converting native `1.0`
to `1.0.0` is allowed. Missing,
malformed, mismatched, unsupported, or below-minimum native identity fails
closed.

The remote Bootstrap repository performs this check after exact payload
parsing but before returning the snapshot to its caller. Development content
skips the check only because its release metadata has no minimum version;
fully local runtime does not read the native module. Passing Bootstrap is an
early gate rather than permission to trust a later manifest: the signed
content manifest independently enforces its own applicable minimum only after
Ed25519 verification.

Missing account-state documents for a valid account/day/track return explicit
empty state. They do not cause the server to copy a device snapshot or silently
use another day or track. `card_states` and `space.states` use deterministic
card-ID ordering. A non-null learning cursor contains only `card_id`,
`source_id`, and `track`; the opaque selection ID remains server-internal.

`card_states`, their source metadata, the bootstrap cursor, and `space.states`
are retained account projections, so a legal content replacement may leave a
historical source, card IDs, or interaction IDs that no longer exist in the
current source and the projection can exceed current `content.card_count`.
After validating the exact bootstrap content identity, mobile maps only
current-source/current-catalog card and interaction matches into current
learning presentation. Current selection authority comes from the validated
learning-session response; a retained bootstrap cursor is not mapped into a
different source. Daily totals and pending review remain the canonical Progress
projection; clients must not recount the filtered history and invent different
totals.

A fresh authenticated bootstrap may validate account authority for replay while
a durable learning outbox still targets an older retained content version. In
that case mobile preserves the immutable event, replays it before requesting a
replacement scheduler selection, and only after exact acknowledgement loads
and maps the active release. A content replacement or China-day rollover must
not require current-session UI hydration before this retained-event replay.

## Component revision authority

`component_revisions` is an additive top-level `bootstrap.v2` field. Keeping it
outside the strict `space-state.v2` object lets already-shipped parsers ignore
the new metadata while revision-aware clients require and validate its exact
shape. Backend deployment therefore precedes a client release that requires
`bootstrap-component-revisions.v1`.

- Membership is a two-part vector. `base_membership_revision` lives in a
  digest-bound sidecar and increments in the same transaction as every current
  base membership write, preserving rollback compatibility with the previous
  package's exact business document schema. Missing business state and sidecar
  is revision zero. A retained legacy document without a sidecar is revision
  one or higher and creates its sidecar transactionally; an orphan sidecar
  fails closed. A previous-package write is detected by digest mismatch and
  advances rather than reusing the old revision. Beta entitlement reuses the
  already-audited entitlement document revision, or zero when absent.
- Learning is scoped to the requested account and track.
  `event_server_sequence` equals the maximum positive `server_sequence` in the
  returned track projection and therefore the maximum returned card-state
  sequence. Every retained legacy card is serialized with an explicit
  `server_sequence: 0`; that pre-v2 baseline is scoped to the requested China
  day and may disappear on day rollover, while positive v2 history remains
  monotonic across day/content changes. `session_revision` is the existing account-and-track scheduler
  revision. `space_revision` identifies the account Space snapshot used to
  overlay `is_favorited`.
- Progress is scoped to the requested account and product day.
  `learning_server_sequence` is the account-wide event sequence because
  pending review is account-wide; `check_in_revision` is zero for an absent
  account-day record and one for the monotonic checked-in record;
  `space_revision` identifies the snapshot used for favorite and sleep counts.
  `progress.learning_authority` is one of `account_events_v2`,
  `legacy_account_baseline`, or `empty`. Before the first accepted v2 event,
  the adapter derives the pending-review count from the latest valid
  account-wide legacy daily snapshot (falling back to validated legacy learning
  states), so a requested-day change cannot erase pending review while the
  sequence is zero. `account_events_v2` requires a positive event sequence, a
  non-v2 authority requires sequence zero, `empty` requires zero pending review,
  and an unchanged sequence cannot relabel the authority.
  The CloudBase adapter reads the daily projection, account sequence, and
  check-in record in one read transaction before Space-derived counts are
  applied, preventing one Progress vector from labeling a split event read.
- Space `state_revision` is account-wide and lives in the v2 sidecar with the
  canonical-state digest and cumulative action digest/result bindings;
  current writes keep the strict `space-state.v2` business document unchanged.
  No canonical state and no sidecar is zero. Retained legacy state without a
  sidecar reconciles at revision one or higher. Every batch that creates at
  least one new immutable action ledger advances once in the same transaction
  as state, revision checkpoint, and action lineage, including a newly
  ledgered stale action. An all-duplicate batch does not advance unless a
  directly proven previous-package ledger must gain lineage; out-of-band
  previous-package state writes are detected by digest and advance on read.

`generated_at` and `acknowledged_at` remain observation and audit values. They
cannot order writes accepted in the same clock millisecond. Content SHA-256 and
release identity remain content scope rather than a monotonic revision. Equal
owner revisions require equal owner state, except for explicitly derived
presentation fields such as a server-calculated remaining duration.

The component vectors intentionally expose a composed read: Membership,
Learning, Progress, and Space may be observed at different valid generations.
Per-component stored revision fences prevent a revision from describing
different bytes inside its owner; they do not turn the complete response into
one cross-collection snapshot.

## Content release boundary

The content version is `sha256:` plus the SHA-256 of the normalized, ordered
track/source/card payload. Array order is significant; object-key order is
canonicalized before hashing. The shared runtime/import validator rejects empty
card arrays and duplicate card IDs before computing that version.

Development content may have `release_id: null`. Production bootstrap fails
closed with `503 content_release_unavailable` unless the content source carries
a `content-release.v1` descriptor whose track and content version match the
normalized payload. A `controlled_pilot` Bootstrap likewise fails closed unless
the active source carries a current `pilot-content-release.v1` for CET4 with
exactly 120 cards, a stable 60-card free prefix, exact Android/iOS semantic
minimum versions, canonical activation/expiry bounds, and
`gate_eligible=false`. Production and controlled-pilot modes accept only their
own release class and never fall back to development content.

This endpoint returns the applicable release metadata projection, not card
records, a signed manifest, private-object URLs, pack URLs, or audio bytes.
Cards remain on authenticated `/v2/learning/card-source`; the separately
authenticated `GET /v2/content/manifest` returns the implemented
Ed25519-signed exact formal or controlled-pilot manifest plus membership-scoped
expiring private downloads. For pilot responses those download expiries cannot
outlive the signed pilot release. The repository-local mobile Bootstrap path
now enforces the applicable minimum against the actual installed native
platform/version before it returns canonical state. This is local
implementation evidence only; receiver deployment and real-device proof remain
pending.

The current `import-card-source.mjs` is a development importer and rejects
non-null release descriptors. On apply it validates and archives a replaced
current source in `softbook_card_source_versions`, then registers the new
current version as active only in the fixed repository development environment;
it accepts no environment override. Formal and controlled-pilot publication use their
separate fail-closed release pipelines; their repository-local implementation
does not constitute receiver deployment or launch evidence.

## Explicit non-claims

This contract does not prove:

- TypeScript or CloudBase Run production deployment;
- real SMS provider readiness;
- production shipment of the repository-local mobile durable
  `learning-events.v2` replay and `/v2/learning/session` selection binding;
- receiver deployment or real-device proof of installed-client minimum-version
  enforcement, receiver-owned formal manifest key injection, complete
  model-owned complete-asset audio QC, private-object byte delivery, or automated real-device
  playback;
- complete formal whole-track approved content or any conversion of the
  controlled-pilot payload, fixtures, dry-runs, or smoke reports into beta or
  launch evidence;
- payment entitlement, deletion completion, or launch readiness.
