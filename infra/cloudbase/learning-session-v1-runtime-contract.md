# Softbook Learning Session v1 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`

## Authority boundary

`product_truth`:

- The primary learning path is one system-sequenced card flow.
- The service or scheduler decides card order and remembers useful learning
  position; the client renders the selected card and interaction.
- Due review work precedes new material.
- Sleeping state and membership access are server-authoritative.
- The visible flip assessment remains two-state. Scheduling must not add a
  four-choice assessment surface.

`implementation_hypothesis`:

- `GET /v2/learning/session` is the repository-local server selection boundary.
- FSRS-6 runs through the exact dependency `ts-fsrs@5.4.1` under policy
  `softbook-fsrs.v1`, with library defaults and fuzz disabled.
- Scheduler state is an integrity-checked projection of accepted immutable
  `learning-events.v2` events. It is not accepted from a client.
- This backend and the mobile binding are repository-local and not deployed.
  Mobile accepts only a session/card-source pair with matching track, source,
  and content version, renders only the returned card, and copies the opaque
  selection ID into the immutable completion event.

## Request

```http
GET /v2/learning/session?track=cet4
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

Rules:

- `track` is required and must be `cet4` or `cet6`.
- Account identity comes only from the active v2 session.
- The endpoint rejects a request body and the query fields `phone_number`,
  `day_key`, client time, membership state, card IDs, and scheduler state.
- The service clock owns selection time and the China product day used for
  canonical space reads.
- Production retains the existing fail-closed content publication rule: the
  selected source must have a matching published `content-release.v1`.

## FSRS projection

Each account-and-track `learning-events.v2` projection contains:

- `scheduler_version: "softbook-fsrs.v1"`;
- `scheduler_by_card_id`, keyed by canonical card ID;

The currently selected card is stored separately in the revisioned
`softbook_learning_sessions` account-and-track document. This lets the
learning-events transaction clear a matching cursor atomically without mixing
ephemeral selection state into the immutable-event-derived FSRS projection.
The same document stores `learning_acknowledged_at` and
`learning_server_sequence`, a two-part projection watermark that must equal the
v2 learning projection timestamp and latest positive server sequence used for
selection. The sequence component prevents two event transactions accepted in
the same clock millisecond from making a split old-projection/new-session read
look current.

For every positive-sequence latest card event, exactly one scheduler entry
must exist. Each entry records the matching latest event ID and server
sequence, the exact algorithm and library versions, and the serialized FSRS
card state. Orphan, stale, malformed, non-finite, or cross-card entries fail
closed.

An unseen card starts from `createEmptyCard()` only when its first new event is
accepted. A sequence-zero legacy migration baseline has no invented FSRS
history and remains immediately review-eligible. Its first accepted v2 event
starts the versioned FSRS history from server acceptance time.

The event-to-rating mapping is:

| Existing event evidence | Internal FSRS rating |
| --- | --- |
| `answer_grade=review_needed` | `Again` |
| `answer_grade=passed` and `used_hint` or `used_peek` | `Hard` |
| `answer_grade=passed` without assistance | `Good` |

`Easy` is unused. This is a server-only mapping and does not change the
two-state self-assessment UI.

The scheduler applies events in canonical `server_sequence` order at the
server's `acknowledged_at` acceptance time. `client_occurred_at` remains a
bounded activity-day input and cannot move scheduler time or order backward.

Current selection validation, one new immutable event, its device cursor
binding, account sequence, latest learning projection, FSRS projection, session
projection-watermark update, exact selected-cursor clearing, and daily progress
commit in one storage transaction. Every newly accepted event advances the
account-and-track session revision,
updates the timestamp watermark component, and advances the sequence component
even when it does not clear a selected cursor. An exact duplicate returns its
original acknowledgement and never advances FSRS state, due time, cursor,
watermark, revision, or counts.

The first v2 event may migrate legacy baselines for both tracks. That
transaction also synchronizes each migrated track's session watermark while
preserving a valid sibling-track cursor; it never leaves bootstrap with a
migrated projection paired to an older session watermark.

## Selection

The endpoint returns at most one card ID and never returns card body content.

1. Resume a persisted cursor only while its account, track, content version,
   source, membership access, and non-sleeping state remain eligible, its
   projection watermark matches, and a transaction confirms its revision
   before response.
2. Otherwise choose an accessible, non-sleeping due review. Sequence-zero
   legacy cards are due immediately. Other cards are due when their FSRS
   `due` time is not later than server time. Sort by due time, canonical
   card-source index, then card ID.
3. If no review is due, choose the first accessible, non-sleeping unseen card
   in normalized `card_records` order.
4. If neither exists and membership is already `trial`, `free`, or `premium`,
   return `selection: null` and the earliest eligible future `next_due_at`, or
   `null` when no future review exists. An account still at `trial_available`
   follows the explicit non-consuming `409` boundary below.

Canonical sleeping state removes a card from resume, due, new, and future-due
selection without deleting its learning or FSRS history. Favorite state does
not change order.

The first authenticated learning-session entry starts an available trial
exactly once through the existing membership authority. Trial and premium
schedule all cards. Free schedules the stable release-scoped prefix of
`ceil(card_count * 0.5)` cards in canonical source order. This is close to
half, never a tiny demo, and never the full library when the source has more
than one card.

Canonical context validation, selection ID generation, and required cursor
persistence complete before trial activation. Invalid content, unavailable
selection entropy, or a failed cursor write therefore cannot consume an
available trial.

After every fresh cursor write, resumed-cursor confirmation, or empty-cursor
confirmation, the scheduler re-reads canonical membership. Any change to its
stage or `acknowledged_at` forces the entire scheduling loop to recompute before
activation or response. Trial activation conditionally matches that checkpoint;
the CloudBase transaction reads both base membership and beta entitlement, so
an active beta Premium grant returns Premium without rewriting base membership
or incrementing Trial counters. The activation clock is sampled when the
mutation begins, and the committed acknowledgement is the later of that value
and the current canonical acknowledgement, so a retry cannot move membership
freshness backward.

Repository-local CloudBase trial, purchase, and recovery mutations use one
membership-document transaction. A concurrent trial start or recovery
dismissal cannot overwrite a premium purchase. This storage guarantee does not
turn the development purchase route into production payment entitlement.

The selected card is persisted as an opaque cursor. Re-reading while it remains
eligible returns the same selection ID with reason `persisted_cursor`. Exactly
one newly accepted event carrying that selection ID and matching card, phase,
and content version clears the cursor atomically. A stale, missing,
cross-account, or mismatched selection fails with `409`; an exact duplicate
remains replayable after the cursor is cleared. A stale cursor caused by
content, access, or sleep drift is replaced or cleared on the next session read.
A new selection uses revision
compare-and-swap; projection-watermark mismatch or failed resumed-cursor
confirmation retries the complete canonical read. A `selection: null` response
and its `next_due_at` receive the same transactional watermark and revision
confirmation, so a concurrent event cannot overwrite or return stale scheduler
output.

## Response

```json
{
  "data": {
    "schema_version": "learning-session.v1",
    "generated_at": "2026-07-23T04:00:00.000Z",
    "track": "cet4",
    "content_version": "sha256:<64 lowercase hex characters>",
    "source_id": "cloudbase-dev-card-source",
    "membership_stage": "trial",
    "algorithm": {
      "id": "FSRS-6",
      "library": "ts-fsrs",
      "library_version": "5.4.1",
      "policy_version": "softbook-fsrs.v1"
    },
    "access": {
      "mode": "full",
      "accessible_card_count": 5,
      "total_card_count": 5
    },
    "selection": {
      "selection_id": "sel_<opaque>",
      "card_id": "110101",
      "phase": "learning",
      "reason": "catalog_new",
      "due_at": null
    },
    "next_due_at": null
  }
}
```

`phase` is `review` for a due or legacy review and `learning` for a new card.
`reason` is `catalog_new`, `due_review`, or `persisted_cursor`. A resumed
cursor preserves its original phase and due time but reports
`persisted_cursor`.

The response membership stage is `trial`, `free`, or `premium`;
`trial_available` must be activated before a successful response. `free`
requires `free_subset` access, while `trial` and `premium` require `full`.
If an account is still `trial_available` and canonical scheduling produces no
eligible selection, the endpoint returns
`409 learning_session_trial_selection_required`. Before returning that failure, it
rechecks membership after the empty cursor write; membership drift causes a
full scheduling retry so access and selection are recomputed from one canonical
context. The failure preserves the canonical empty cursor revision but does not
start or consume Trial. Waking an eligible card or otherwise restoring a valid
server selection makes a later request eligible to start Trial.

## Mobile binding

Remote mobile learning fetches `learning-session.v1` and the canonical card
source under the same authenticated session. It requires exact track,
`source_id`, and `content_version` agreement, resolves only the returned
`card_id`, and never reorders cards or reapplies client membership, sleep, or
review policy. For an already active `trial`, `free`, or `premium` membership,
`selection: null` is valid and never triggers bundled-card fallback.

If `membership_stage` differs from the bootstrap snapshot because the session
activated or observed a newer entitlement, mobile refreshes bootstrap and
requires the canonical stage to match before presenting the session. It never
constructs entitlement counters or dates from the session response.
Authentication alone never invokes Trial start. When mobile uses local
scheduling, its automatic Trial entry waits until a concrete current card is
ready; explicit protected-entry actions remain user initiated.

An offline `start_membership_trial` command is credential-free and carries
closed `membership-trial-entry.v1` provenance. An explicit protected-entry
action records `explicit_user`; an automatic local counted entry binds the
exact local `card_id`, `source_id`, and track. Queue hydration discards every
legacy unversioned, missing, unknown-version, or unclosed provenance before
replay, so an upgrade cannot replay an authentication-era automatic Trial
start.

Completion persists `selection_id`, selected card, server phase, exact content
version, event ID, and installation cursor before leaving the result state. A
pending unseen event blocks a second completion. Only after strict
acknowledgement, canonical bootstrap reconciliation, and a fresh session read
may mobile render another server-selected card. A previously validated cached
selection may be completed once offline; mobile does not choose a second card
offline.

## Failure behavior

- `400`: malformed or authority-bearing request input;
- `401`: missing, expired, or revoked active session;
- `409`: the learning projection changed while a cursor write was attempted
  and bounded retry could not converge, an unseen completion did not match the
  current selection, or Trial cannot start because no eligible selection can be
  persisted;
- `500`: a stored learning, scheduler, or learning-session projection violates
  its integrity contract;
- `503`: canonical content, space, or storage is unavailable or invalid.

No failure falls back to client ordering, bundled cards, another account,
another track, or unvalidated scheduler state.

## Formal launch evidence boundary

The scheduler gate requires three independent
`learning-runtime-evidence.v1` reports:

- `fsrs-version-lock`;
- `scheduler-contract-test`;
- `clock-boundary-test`.

The reports bind this contract's exact SHA-256 plus the deployed commit,
receiver-owned environment, release, backend deployment, and all three client
builds. The validator rechecks the exact `ts-fsrs@5.4.1`,
`softbook-fsrs.v1`, fuzz-disabled policy, and repository
`softbook-api/package-lock.json` SHA-256, plus due-before-new ordering,
sleeping and membership exclusion, selection-bound completion, duplicate
non-advance, and server-acceptance clock boundaries. The outer subject commit
must match the report and be reachable from the validated HEAD; the operator
and independent verifier must differ; measured clock events must fit the
execution window. All reports match one product-owner-recorded
`launch-release-candidate.v1` cohort, and any repository raw artifact is
tracked and rehashed independently. A `result=passed` field alone has no
authority.

Repository memory tests, local smoke, dry-runs, and simulations are
`gate_eligible=false` and cannot satisfy the scheduler launch gate.

## Explicit non-claims

This contract does not prove:

- production CloudBase deployment or CloudBase Run migration;
- deployed mobile/backend integration or release validation;
- production membership expiry, StoreKit, WeChat Pay, or Alipay entitlement;
- complete approved card content, signed packs, or audio QC;
- formal launch evidence from repository-local or simulated tests;
- launch readiness.
