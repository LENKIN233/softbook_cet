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
  reports one `generated_at` value and per-component freshness, but does not
  claim a serializable cross-collection transaction.
- A scheduler cursor is nullable until a server scheduler has persisted one.
  The service does not infer an exact cursor from device-local state.
- Legacy `/v1` daily and learning snapshots can be read during migration, but
  they are not a substitute for idempotent `learning-events.v2` or the final
  server scheduler.

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

## Response

```json
{
  "data": {
    "schema_version": "bootstrap.v2",
    "generated_at": "2026-07-20T10:00:00.000Z",
    "day_key": "2026-07-20",
    "track": "cet4",
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
      "pending_review_count": 0,
      "review_completed_count": 0,
      "sleeping_count": 0,
      "total_completed_count": 0
    },
    "space": {
      "acknowledged_at": null,
      "day_key": "2026-07-20",
      "states": []
    }
  }
}
```

Missing account-state documents for a valid account/day/track return explicit
empty state. They do not cause the server to copy a device snapshot or silently
use another day or track. `card_states` and `space.states` use deterministic
card-ID ordering.

## Content release boundary

The content version is `sha256:` plus the SHA-256 of the normalized, ordered
track/source/card payload. Array order is significant; object-key order is
canonicalized before hashing. The shared runtime/import validator rejects empty
card arrays and duplicate card IDs before computing that version.

Development content may have `release_id: null`. Production bootstrap fails
closed with `503 content_release_unavailable` unless the content source carries
a `content-release.v1` descriptor whose track and content version match the
normalized payload. This endpoint returns release metadata, not card records,
signed manifests, pack URLs, or audio URLs.

The current `import-card-source.mjs` is a development importer and rejects
non-null release descriptors. A separate publication pipeline must prove formal
content approval before it can persist `content-release.v1`; that pipeline is
not implemented by this change.

## Explicit non-claims

This contract does not prove:

- TypeScript or CloudBase Run production deployment;
- real SMS provider readiness;
- idempotent `learning-events.v2`;
- FSRS scheduling or a persisted server cursor;
- signed content manifests, complete approved content, or audio QC;
- payment entitlement, deletion completion, or launch readiness.
