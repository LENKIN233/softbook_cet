---
authority: implementation_hypothesis
owner: spec/account-sync-contract.json#physical_space_actions_v2
status: implemented_locally_not_deployed
---
# Physical Space Actions v2 Runtime Contract

This contract narrows the repository-local implementation of the product-owned
physical-space semantics. It does not grant content approval, deployment
approval, or launch readiness.

## Endpoint

`POST /v2/space/actions` requires an active v2 session. Account identity comes
only from that session.

The exact `space-actions.v2` body contains:

- `schema_version`: `space-actions.v2`
- `track`: `cet4` or `cet6`
- `content_version`: the current normalized card-source SHA-256
- `actions`: one to twenty exact action objects

Each action contains only `action_id`, `card_id`, `dimension`, `value`, and
`client_occurred_at`. `dimension` is `favorite` or `sleep`. The endpoint rejects
phone numbers, day keys, counters, complete snapshots, unknown fields, unknown
cards, stale content versions, and timestamps more than five minutes ahead of
server time.

## Idempotency And Merge

The action ledger is keyed by account plus action ID. An exact repeat returns
`duplicate`; reusing the ID with different canonical content rejects the whole
batch with HTTP 409.

Favorite and sleep use separate clocks. Each clock orders writes by
`client_occurred_at`, then by `action_id` for equal timestamps. The endpoint
returns `applied`, `stale`, or `duplicate` per input action.

CloudBase commits legacy migration, ledger checks, both dimension merges,
ledger inserts, and the account state in one transaction. A failed batch
commits nothing.

## Canonical Projection

The `space-actions-ack.v2` response preserves input order and returns the
requested track's current projection:

- `schema_version`: `space-state.v2`
- `acknowledged_at`
- `track`
- `content_version`
- sorted `states` with `card_id`, `is_favorited`, `is_sleeping`, and
  `last_modified_at`

Bootstrap uses the same projection. Scheduler sleep authority reads the same
account state; it does not delete learning history or scheduler state.

## Mobile Durability

Mobile persists a credential-free `apply_space_action` entry before optimistic
UI authority advances. Replay injects the current access token only in memory.
The immutable action fields and action ID never change. When the active content
version advances for the same track, replay binds that action to the currently
validated content version; it never rebinds an action across tracks. This is
safe because content scope is the request envelope rather than part of the
action ledger digest, and the server still validates the card against the
current source.
The entry is removed only after strict matching acknowledgement and canonical
scope validation, followed by bootstrap reconciliation.

Hydration starts from canonical bootstrap and overlays only matching durable
pending actions for the same account and track, including actions awaiting
same-track content-version rebinding. Valid legacy `sync_space_state` queue entries migrate into
deterministic per-card favorite and sleep actions; the original snapshot is
never sent.

## Legacy Boundary

Both `GET /v1/space/state-sync` and `POST /v1/space/state-sync` return 410 in
every runtime. Retained legacy documents remain read-only migration input.
