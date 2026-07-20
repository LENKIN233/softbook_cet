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
- This document defines the next runtime boundary. The endpoint, transactional
  ledger, projections, mobile producer, and scheduler are not implemented by
  the contract-only change that introduced this file.
- The launch gate `canonical-bootstrap-and-idempotent-events` remains pending
  until backend and client behavior pass the acceptance cases in this document.

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
  projection mutation.
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

The mobile implementation must durably allocate the event ID and device cursor
with the event payload before considering it queued. Persisted queue entries
contain no access or refresh token; replay injects the current access token in
memory. Queue compaction must not merge distinct event IDs or rewrite accepted
history.

Reconnect order remains:

1. authenticate or refresh the v2 session;
2. read canonical bootstrap state and validate content identity;
3. replay exact queued events;
4. read bootstrap again;
5. enable dependent product-state writes from the reconciled baseline.

## Migration boundary

Legacy `/v1/progress/daily-sync` and `/v1/learning/state-sync` remain
development-only migration inputs until separate backend and mobile adoption
changes land. They are not valid `learning-events.v2` payloads. Production
continues to reject every v1 route.

Implementation order is intentionally serial:

1. owner contract and negative Harness gates;
2. transactional backend ledger, idempotency indexes, and projections;
3. mobile durable event generation and exact replay;
4. disable legacy snapshot writes;
5. server scheduler and scheduler cursor.

## Required implementation tests

The backend and mobile PRs cannot claim this contract without proving:

- exact replay returns duplicate and does not change any projection;
- the same event ID with changed payload fails with `409` and writes nothing;
- the same device cursor with another event ID fails with `409`;
- mixed duplicate/new batches return one result per input and commit only new
  events;
- one invalid event prevents all writes in the request;
- concurrent exact submissions converge on one event;
- device sequence gaps and out-of-order replay remain accepted;
- account isolation holds for event IDs and device cursors;
- unknown or mismatched content/card/interaction is rejected;
- identity, credential, snapshot, counter, and content-text fields are rejected;
- server sequences are stable and monotonic per account;
- duplicate replay never increments learning or review counts twice;
- reconnect performs bootstrap before and after replay;
- tracked worktree state and formal approval records remain unchanged by tests.

## Explicit non-claims

This contract-only artifact does not prove:

- that `/v2/learning/events` is deployed or callable;
- that the React Native client emits or replays v2 events;
- that legacy snapshot writes are disabled;
- that FSRS or any other scheduler is implemented;
- exact same-card cross-device resume;
- signed content packs, approved production content, payments, or launch
  readiness;
- that a green check is formal content or product-owner approval.
