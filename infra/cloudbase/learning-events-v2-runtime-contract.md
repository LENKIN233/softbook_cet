# Softbook Learning Events v2 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/card-system.json`

## Status and authority

`product_truth`:

- Learning state must survive across release surfaces with at least daily-level
  consistency.
- The server is authoritative for shared learning state and aggregates.
- Exact same-card cross-device resume is not required.
- The visible self-assessment remains two-state. A runtime contract must not
  turn it into a four-grade user interaction.

`implementation_hypothesis`:

- `spec/account-sync-contract.json#learning_events_v2` is the owner of the
  event, idempotency, acknowledgement, and migration semantics below.
- `POST /v2/learning/events` uses `learning-events.v2` and returns
  `learning-events-ack.v2`.
- The repository-local CommonJS CloudBase function now implements the endpoint,
  transactional ledger, server sequence, daily aggregates, per-card learning
  projection, retained content lookup, and bootstrap projection read.
- The implementation has local memory and CloudBase-adapter tests. The React
  Native client also implements durable event allocation, exact replay, strict
  acknowledgement removal, and post-ack bootstrap reconciliation.
- This repository change deploys neither backend nor mobile release artifacts;
  global legacy v1 write removal and the scheduler remain unimplemented.
- The launch gate `canonical-bootstrap-and-idempotent-events` remains pending
  until backend deployment and client behavior pass the acceptance cases in
  this document.

## Repository-local backend

The route is wired in `infra/cloudbase/functions/softbook-api/index.js`. Request
validation lives in `learning-events-v2.js`; the memory and CloudBase adapters
share the transaction algorithm in `learning-events-v2-store.js`.

CloudBase uses one database transaction across these account-scoped records:

- `softbook_learning_events`: immutable event payload and canonical digest;
- `softbook_learning_event_cursors`: one event binding for each device cursor;
- `softbook_learning_event_sequences`: next account sequence and global pending
  review count;
- `softbook_learning_migration_revisions`: one account revision fence that
  closes the race between a bounded legacy snapshot and the first v2 event;
- `softbook_learning_states`: latest accepted event per card and track;
- `softbook_daily_progress`: server-derived learning and review counts by China
  product day;
- `softbook_card_source_versions`: current and retained versioned card sources.

Document IDs are SHA-256 keys over internal account keys and opaque event or
cursor identifiers; phone numbers are not event-ledger keys. The in-memory
adapter serializes copy-on-write transactions so the same algorithm can prove
rollback and concurrency behavior without claiming that memory is a production
store.

CloudBase transactions use deterministic `doc` operations only. Legacy learning
documents are read in bounded pages outside the transaction; the transaction
then reads and writes the account revision fence together with the first event.
If a v1 write changes the revision after preflight, the complete snapshot is
read again before retrying. Legacy physical-space discovery follows the same
doc-only boundary: its query is outside the transaction and the canonical merge
is transactionally written to one deterministic account document.

The CloudBase adapter accepts at most 9 events per request. That hard limit
keeps the tested worst case at 91 operations, below CloudBase's 100-operation
transaction ceiling, even when every event has a distinct retained content
version and China activity day and migration preserves both tracks. Defaults
are therefore 9 events, 90 days of past-event retention, and five minutes of
future clock skew. Development operators may lower the batch limit
and may set
`SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT`,
`SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS`, and
`SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS` to positive integers; a batch
limit above 9 fails configuration instead of creating a false atomicity claim.
Production still requires published content and continues to reject every v1
route.

## Request

```http
POST /v2/learning/events
Authorization: Bearer <access_token>
Content-Type: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

```json
{
  "schema_version": "learning-events.v2",
  "track": "cet4",
  "events": [
    {
      "event_id": "evt_01J0EXAMPLE",
      "card_id": "100101",
      "interaction_id": "flip",
      "phase": "learning",
      "outcome": "confident",
      "answer_grade": "passed",
      "used_hint": false,
      "used_peek": true,
      "client_occurred_at": "2026-07-21T08:00:00.000Z",
      "content_version": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "device_cursor": {
        "device_id": "install_01J0EXAMPLE",
        "sequence": 41
      }
    }
  ]
}
```

Account identity comes only from the active v2 session. The request must not
contain `phone_number`, tokens, entitlement data, canonical counters, a
client-chosen `day_key`, or scheduler-owned fields.

One request contains one track and one or more events up to a bounded server
limit. The acknowledgement preserves request order. A client may combine exact
duplicates and unseen events in one retry batch. The request, event, and
`device_cursor` objects are strict schemas; unknown fields are rejected.

## Event semantics

Every event is one immutable card completion. Required fields are:

- `event_id`: opaque and stable. Generate it before durable local enqueue and
  reuse it unchanged for every retry.
- `card_id`: the card answered by the user.
- `interaction_id`: `flip`, `multiple_choice`, `lock`, `elimination`, or
  `swipe`.
- `phase`: `learning` or `review`.
- `outcome`: `correct`, `incorrect`, `confident`, or `review`.
- `answer_grade`: `passed` or `review_needed`.
- `used_hint` and `used_peek`: booleans describing that completion.
- `client_occurred_at`: an RFC3339 instant preserved for bounded activity-day
  attribution. It is not canonical ordering or entitlement authority.
- `content_version`: the exact SHA-256 content version rendered for the answer.
- `device_cursor`: a pseudonymous installation ID plus a positive monotonic
  safe-integer sequence allocated before durable enqueue.

The grade is deterministic rather than a second client opinion:

| Outcome | Answer grade |
| --- | --- |
| `correct` | `passed` |
| `confident` | `passed` |
| `incorrect` | `review_needed` |
| `review` | `review_needed` |

`flip` accepts only `confident` or `review`. The other four interactions accept
only `correct` or `incorrect`. A mismatched interaction, outcome, or grade
invalidates the request.

A future scheduler may translate the two-state grade and objective outcome into
versioned algorithm input on the server. The client does not submit a raw FSRS
rating, stability, difficulty, due date, or other scheduler-owned state, and no
algorithm adapter may expand the visible two-state self-assessment into four
choices.

The device sequence may arrive with gaps or out of order after offline use. It
is replay provenance and a fork detector, not the scheduler cursor and not a
promise of exact cross-device resume.

## Content validation

The server validates that:

- `track` is `cet4` or `cet6`;
- `content_version` is a valid SHA-256 identifier known to the service;
- the card exists in that retained version and track;
- the submitted interaction matches the versioned card contract;
- production content belongs to a retained published release.

An event created offline against a retained older release may be accepted after
a newer release becomes current. Requiring the event version to equal only the
current release would make legitimate offline replay lossy. Unknown, removed
from retention, unapproved, or mismatched content is rejected atomically rather
than rewritten to the current version.

The event contains no card body, selected answer, correct answer, analysis,
audio transcript, or other content text.

## Idempotency and conflicts

The primary idempotency key is `(account_id, event_id)`.

- An exact replay returns `duplicate`, the original `server_sequence`, and no
  projection mutation. Once accepted, the byte-equivalent canonical event does
  not become invalid when a mutable time or content-retention window later
  changes.
- Before acknowledging a duplicate, the server recomputes the canonical digest
  from the stored immutable payload and track. A mismatch is storage corruption
  and fails closed without acknowledgement or writes.
- Reusing the event key with any different canonical event field returns HTTP
  `409` and rejects the entire request.
- `(account_id, device_id, sequence)` must map to exactly one `event_id`.
  Binding the same cursor to another event also returns `409` and rejects the
  entire request.
- IDs and cursors are account-scoped. The same opaque values in another account
  do not expose or alias the first account's event.
- A correction is a new event with a new event ID and device sequence. Accepted
  events are never updated in place.

The service validates the complete request before writing. New events, the
account-scoped server sequence allocation, and derived learning projections
commit in one transaction. A validation, conflict, storage, or transaction
failure leaves no partial acceptance. Concurrent exact submissions converge on
one accepted event plus duplicate acknowledgements; they never increment a
counter twice.

## Server authority and projections

Each newly accepted event receives one stable, monotonically increasing,
account-scoped `server_sequence`. Exact duplicates return the original value.
Canonical event order is `server_sequence`; client clocks and device sequences
cannot override it. The highest valid server sequence for a card is its latest
canonical learning event.

The service derives per-card learning state and learning/review completion
aggregates from accepted immutable events. It does not accept a client-authored
learning snapshot or progress counters. Favorite and sleeping state remain
owned by the physical-space canonical state, and check-in remains a separate
product action.

Bootstrap reads the account-keyed v2 learning projection for the requested
track regardless of requested day, reads the requested day's completion
aggregate, and overlays favorite state from canonical physical space. A first
v2 write preserves both CET4 and CET6 legacy learning baselines as
sequence-zero projections in the same transaction before closing migration,
and may seed that day's completion counts from the v1 daily snapshot. Newly
accepted events start at server sequence one; v1 snapshots are never accepted
as v2 event payloads.

The development bridge is one-way per account. Before the first accepted v2
event, valid v1 daily and learning snapshots may supply the migration baseline.
After that sequence exists, later `/v1/learning/state-sync` writes for the
account fail with `409 legacy_learning_write_disabled`. The guard and legacy
write share the same memory coordinator or CloudBase transaction as the
sequence boundary, so a late v1 learning snapshot cannot race behind the first
v2 acceptance.

CloudBase obtains the bounded legacy page snapshot outside the transaction
because that runtime does not support `where` inside a transaction. Every v1
learning write increments the deterministic account revision in its own
transaction. First-event migration validates and marks the same revision fence
as migrated in the event transaction, so a concurrent v1 write either wins
before a fresh preflight or conflicts and retries behind the v2 sequence.

`/v1/progress/daily-sync` remains temporarily available to migrated development
clients because it also carries the separate check-in action. In the same
transaction as the account sequence read, only `checked_in_today` is merged,
and it is monotonic for the product day. Submitted learning, review, pending,
and total counters cannot overwrite event-derived projections. Submitted
favorite and sleeping counters are ignored; bootstrap derives both counts from
canonical physical-space state. Physical-space writes keep their separate
authority and are not blocked by this learning migration.

For daily attribution, the service may derive the China product day from
`client_occurred_at` only within configured retention and future-skew bounds.
Outside those bounds it rejects the event. It never accepts a client-selected
canonical `day_key`.

Accepting an event does not grant trial, membership, content access, or a
scheduler position. Those authorities remain independent server decisions.

## Acknowledgement

```json
{
  "data": {
    "schema_version": "learning-events-ack.v2",
    "acknowledged_at": "2026-07-21T08:00:01.000Z",
    "track": "cet4",
    "results": [
      {
        "event_id": "evt_01J0EXAMPLE",
        "status": "accepted",
        "server_sequence": 183
      }
    ]
  }
}
```

Each input event has exactly one ordered result with status `accepted` or
`duplicate`. A missing or ambiguous response is retried with the same event IDs
and byte-equivalent canonical payloads. The local queue removes an event only
after its own accepted or duplicate result.

After replay, the client reads `/v2/bootstrap` again before presenting
reconciled server state or sending mutations that depend on the new canonical
state. The acknowledgement is not a replacement canonical snapshot.

Expected error classes:

- `400`: malformed schema, invalid enum or grade mapping, forbidden field, or
  invalid client time/cursor;
- `401` or `403`: missing, expired, revoked, or unauthorized v2 session;
- `409`: event-ID payload conflict or device-cursor fork;
- `422`: unknown content version, card, track, or interaction mismatch;
- `503`: event ledger or projection transaction unavailable.

Errors must not echo credentials, phone numbers, card content, or answer text.

## Offline producer and replay

The React Native implementation uses `learning-event-outbox.v1` under an
independent AsyncStorage key. It atomically persists the immutable event, the
pseudonymous installation ID, and the allocated positive device sequence before
advancing the card UI. A failed durable write leaves the current result in
place. Persisted entries contain no access or refresh token; replay injects the
current access token in memory.

The outbox sends at most 9 events for one account and one track per request. It
ends a batch at the first track boundary, so interleaved CET4/CET6 entries keep
their original enqueue order. It does not compact distinct IDs, mutate retry
payloads, or remove an entry for an ambiguous response. A strict acknowledgement
must preserve event order and IDs, use only `accepted` or `duplicate`, and
provide positive unique server sequences. A transient failure pauses automatic replay until network recovery,
app foreground, or a newly durably enqueued event, preventing render-driven
request loops while preserving exact retry bytes.

Replay is serialized per originating session. If an event is durably enqueued
or a dependent mutation finishes queueing after an in-flight pass has observed
its queue, the client records one follow-up pass and starts it when the current
pass settles; it neither sends concurrently nor waits for an unrelated future
connectivity trigger.

Authenticated startup hydrates the account's outbox count with bootstrap. A
pending event restored from an earlier process blocks another advance from the
stale card until strict acknowledgement and post-acknowledgement bootstrap
mapping complete. Events created in the current validated session may continue
to batch while offline because routine refreshes cannot overwrite their local
intent.

While any learning event remains pending, daily-progress and space-state
changes enter the persisted generic mutation queue instead of overtaking the
event. Mine, foreground, and connectivity refreshes may re-read bootstrap to
validate content identity, but do not map pre-acknowledgement projections over
optimistic local intent. After strict event acknowledgement, the client
refreshes and maps bootstrap before replaying those dependent mutations.

Generic mutation queue operations are serialized and use candidate persistence:
memory changes only after storage succeeds. A late remote result removes or
increments retry state only for the exact unchanged head entry, so a same-ID
replacement cannot be consumed by an older request.

Logout removes only the signed-out account's entries and preserves the
installation ID and next sequence. Generic queue hydration discards legacy
`sync_learning_state` entries; active mobile completion no longer calls
`/v1/learning/state-sync`.
Late replay, authorization, or bootstrap responses are scoped to the originating
session identity, not phone number alone. A response for a signed-out or
replaced session cannot refresh, invalidate, clear, hydrate, or change sync
state for the current session, including same-phone reauthentication.

Every remote authentication call has a 15-second deadline that includes
response validation and parsing. Access-token acquisition, the first protected
fetch, at most one forced refresh, and one retry also share one 15-second
deadline. Replacing or invalidating the originating session aborts its pending
refresh and protected requests. A timeout is an ambiguous retryable transport
failure: the exact event stays queued and its retry state advances.
Explicit caller cancellation or session replacement leaves the queued event and retry
state unchanged. None of these transport outcomes is an authorization rejection
or may invalidate or mutate a replacement session.

Reconnect order remains:

1. authenticate or refresh the v2 session;
2. read canonical bootstrap state and validate content identity;
3. replay exact queued events;
4. read bootstrap again;
5. enable dependent product-state writes from the reconciled baseline.

## Migration boundary

Legacy `/v1/learning/state-sync` remains a backend development-only migration
input for accounts without an accepted v2 event until global legacy-write
removal lands; the active React Native client no longer writes it.
`/v1/progress/daily-sync` has the same baseline role before migration and
becomes a check-in-only compatibility bridge afterward.
Neither route is a valid `learning-events.v2` payload. Production continues to
reject every v1 route.

Implementation order is intentionally serial:

1. owner contract and negative Harness gates;
2. transactional backend ledger, idempotency indexes, and projections;
3. mobile durable event generation and exact replay;
4. disable legacy snapshot writes;
5. server scheduler and scheduler cursor.

## Required implementation tests

The repository-local backend tests currently prove:

- exact replay returns duplicate and does not change any projection;
- the same event ID with changed payload fails with `409` and writes nothing;
- the same device cursor with another event ID fails with `409`;
- mixed duplicate/new batches return one result per input and commit only new
  events;
- one invalid event prevents all writes in the request;
- concurrent exact submissions converge on one event;
- device sequence gaps and out-of-order replay remain accepted;
- account isolation holds for event IDs and device cursors;
- top-level track changes are part of an event-ID payload conflict;
- the active session account key is rederived from the signed session phone;
- an atomic batch above 9 is rejected before storage work;
- the maximum nine-event, all-track migration fixture uses 91 transaction
  operations and therefore retains headroom below the platform ceiling;
- transaction test doubles reject `where`, matching CloudBase's doc-only rule;
- stored immutable event payloads are rehashed before duplicate acknowledgement;
- stored v2 learning/daily projections and migrated v1 events are fully
  revalidated before another acceptance;
- device cursor gaps and out-of-order replay preserve account server order;
- legacy learning-state migration reads every bounded query page;
- a changed migration revision forces a complete preflight retry;
- first-event migration preserves valid sequence-zero baselines for both
  tracks, including the track not present in the event request;
- migrated accounts reject later v1 learning snapshot writes;
- migrated daily progress can merge check-in but cannot override v2 learning
  counts or canonical physical-space counts;
- unknown or mismatched content/card/interaction is rejected;
- identity, credential, snapshot, counter, and content-text fields are rejected;
- server sequences are stable and monotonic per account;
- duplicate replay never increments learning or review counts twice;
- reconnect performs bootstrap before and after replay;
- tracked worktree state and formal approval records remain unchanged by tests.

The React Native tests additionally prove:

- event ID and device cursor are persisted before card UI advance;
- a failed persistent write does not advance the card;
- content version, two-grade mapping, and credential-free request bodies are
  preserved;
- restart keeps installation identity and monotonic sequence allocation;
- stale cursors are repaired without reuse and malformed event IDs are dropped;
- transient failure preserves byte-equivalent event payloads and pauses
  render-driven retries;
- reconnect replays the exact event, removes it only after strict acknowledgement,
  then refreshes bootstrap before dependent mutations;
- queues larger than 9 split into server-safe one-track batches;
- interleaved track entries retain their global enqueue order;
- account-scoped concurrent replay is isolated;
- a signed-out or replaced session's late 401 cannot refresh, invalidate,
  clear, or mutate the current session, including same-phone reauthentication;
- logout clears account entries without reusing the installation cursor;
- persisted generic v1 learning mutations are discarded during migration;
- metadata scanning rejects learning-event internals in visible UI copy.

## Explicit non-claims

The repository-local backend and mobile implementation do not prove:

- that `/v2/learning/events` is deployed in CloudBase or production;
- that the React Native client has been shipped against a deployed v2 endpoint;
- that legacy learning snapshots and the daily check-in bridge are globally
  disabled;
- that FSRS or any other scheduler is implemented;
- exact same-card cross-device resume;
- signed content packs, approved production content, payments, or launch
  readiness;
- that a green check is formal content or product-owner approval.
