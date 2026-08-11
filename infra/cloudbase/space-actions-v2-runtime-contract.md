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
ledger inserts, action-lineage records, the digest-bound revision sidecar, and
the rollback-compatible account state in one transaction. A failed batch
commits nothing. That same transaction advances the account-state revision once
when the batch creates at least one new ledger, including a newly ledgered
`stale` action; an all-`duplicate` batch does not advance unless a directly
proven previous-package ledger must gain committed-state lineage.

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

The canonical revision lives in the account-keyed
`softbook_space_state_revisions` sidecar as a positive safe integer plus state
digest and a deterministic, cumulative set of action digest/result bindings.
Current writes use `space-state-revision.v2`; the retained v1 sidecar is a
read-only migration input and the next write/checkpoint upgrades it. The direct
`space-state.v2` business and wire shape remains
unchanged for rollback compatibility; bootstrap exposes the value only through
top-level `component_revisions.space.state_revision` and repeats it as the
Learning and Progress Space dependency. Missing canonical state and sidecar is
revision zero. Retained exact legacy state without a sidecar reconciles at
revision one or higher. A sidecar without state fails closed; a state-digest
mismatch advances through a new transactional checkpoint. The briefly
unreleased inline `revision` shape is accepted only as a migration floor and is
stripped on rewrite. CloudBase `_id` remains the only adapter-owned field
removed before exact stored-shape validation.

Each current ledger also owns an immutable record in
`softbook_space_action_lineages`, binding its digest and result to a committed
state checkpoint. Duplicate acknowledgement requires both that lineage and the
exact digest/result binding in the current cumulative revision authority, so a
coordinated ledger/lineage rewrite cannot invent a committed action without
also violating the checkpoint. A previous-package ledger without lineage is
acknowledged as duplicate only when the current canonical state directly proves
its `applied` or `stale` result; reconciliation then creates lineage atomically.
An older applied ledger that has already been superseded cannot be distinguished
from a forged orphan by the old schema. Rollout therefore requires a fenced
baseline/intermediate dual-write before those old ledgers are eligible for
automatic recovery; without that evidence the runtime fails closed.

## Mobile Durability

Mobile persists a credential-free `apply_space_action` entry before optimistic
UI authority advances. Replay injects the current access token only in memory.
The immutable action fields and action ID never change. When the active content
version advances for the same track, replay binds that action to the currently
validated content version; it never rebinds an action across tracks. This is
safe because content scope is the request envelope rather than part of the
action ledger digest, and the server still validates the card against the
current source.
The entry is removed as acknowledged only after strict matching
acknowledgement and canonical scope validation, followed by bootstrap
reconciliation.

Two exact HTTP 409 codes are terminal for an immutable queued action:
`space_card_not_in_content` and `space_action_id_conflict`. Mobile durably moves
those credential-free commands into a bounded local quarantine before removing
them from the active FIFO. It surfaces the rejection, continues later
mutations, and starts a causally later bootstrap request before presenting
reconciled space state. That refresh may correctly return the same Space
revision because a rejected command commits no canonical change.
Quarantined actions are diagnostic evidence, not acknowledgement or approval,
and logout clears them with the active queue.

`space_content_version_mismatch`, unknown HTTP failures, transport failures,
malformed responses, and every other non-terminal rejection remain active.
For `space_content_version_mismatch`, mobile requests a fresh bootstrap before
one same-track content-envelope rebound attempt. If refreshed content identity
and component revisions are unchanged, the queue remains blocked without an
automatic refresh/replay loop.
Authorization and session cancellation keep their separate session lifecycle
handling.
An action retained for an inactive track is rotated past without deletion so it
cannot starve current-track or account-wide mutations; it is retried only after
that track has its own validated bootstrap/content hydration.

Hydration starts from canonical bootstrap and overlays only matching durable
pending actions for the same account and track, including actions awaiting
same-track content-version rebinding. Quarantined actions are excluded. Valid
legacy `sync_space_state` queue entries migrate into deterministic per-card
favorite and sleep actions; the original snapshot is never sent.

## Legacy Boundary

Both `GET /v1/space/state-sync` and `POST /v1/space/state-sync` return 410 in
every runtime. Retained legacy documents remain read-only migration input.
