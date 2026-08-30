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
Before any migration checkpoint, ledger, lineage, revision, or state write,
that transaction reads the account-keyed deletion task. Any present task fails
closed with `account_deletion_pending`, preventing a pre-deletion authorized
Space request from recreating state after worker erasure.
The maximum twenty-action fixture therefore uses 65 document operations,
remaining below CloudBase's 100-operation transaction ceiling.

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

PC Web injects browser localStorage behind the same credential-free mutation
queue and uses the shared `/v2/space/actions` repository. Tokens are added only
in memory during replay. The visible favorite/sleep state is canonical
bootstrap plus same-account/track pending intent; remote mode never substitutes
a local Space authority. A visible mutation advances only after durable enqueue.
Retryable network or malformed-response failures remain explicitly queued; only
strict acknowledgement followed by a fresh canonical bootstrap is displayed as
server-confirmed. Terminal `space_card_not_in_content` or
`space_action_id_conflict` 409 results enter the bounded quarantine and remain
visible as rejected/stopped rather than being relabeled confirmed. PC Web reads
account-and-track quarantine on every snapshot and reload; rejection remains
visible until logout clears the queue/quarantine or a future explicit safe
resolution policy is implemented. Persisted rejection count and newer pending
count are independent facts; if both are nonzero the client renders both and
cannot report server-confirmed. Free membership receives only the stable accessible card
prefix as a read-only Space preview; trial and premium alone can mutate complete
Space. No receiver browser execution is implied.
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

## Receiver Space sync drill report

`infra/cloudbase/run-space-sync-drill.mjs` is dry-run by default. Apply requires
Node 22.13.0, clean local `main` exactly equal to `origin/main`, a receiver
closed-beta delivery profile, an identified operator and two distinct active
session tokens supplied only through process environment. The tokens and phone
identity never enter the report.

On one exact CET4 card, client A applies a favorite action, client B observes
the new canonical revision, exact replay returns `duplicate`, and a conflicting
reuse returns `space_action_id_conflict` without advancing state. Client B then
applies sleep while client A proves favorite and sleep merge independently.
New favorite and sleep actions finally restore the initial projection. Every
new ledger must advance the Space component revision exactly once; duplicate
and rejected conflict must not. A post-initial failure triggers best-effort new
restore actions and a bootstrap verification, but never produces a passed
report.

The privacy-safe `space-sync-drill-report.v1` binds repository commit, raw
profile SHA-256, expected backend deployment identity, content version, a hash
of the card ID, action hashes, revision sequence, client observations, write
safety and execution. It remains `gate_eligible=false`; repository mocks or the
raw report alone are not `space-sync-test` evidence, receiver deployment proof
or launch readiness. A later formal wrapper must pair it with exact production
deployment evidence rather than treating the locally derived expected identity
as remote inspection.

The closed-beta loader registers `space-sync-test` only over two distinct
tracked strict-JSON roles: the exact receiver delivery profile and one applied
`space-sync-drill-report.v1`. The semantic wrapper rehashes both files and
rebinds report commit/profile/environment, expected backend deployment ID and
content version to the exact closed-beta candidate. It recomputes the revision
sequence, same-account distinct-client observations, duplicate/conflict
no-commit behavior, independent favorite/sleep toggles, action-hash uniqueness
and final cleanup. Overall readiness still independently requires the formal
`production-deployment` gate; Space evidence cannot turn an expected backend ID
into remote deployment proof.
