# Softbook Controlled Pilot v1 Runtime Contract

Referenced active sources:

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/box-catalog.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Authority boundary

`product_truth`:

- The controlled pilot is a pre-beta CET4 learning proof for 30–50 invited iOS and Android users.
- It contains exactly 120 approved cards, starts a complete five-day experience only from the first valid Learning Session, and measures five-card rounds and five-day retention.
- It is not the formal closed beta. Formal CET4 closed beta continues to require 1,180 cards, 301 audio references, complete QC and one whole-track final approval.
- Pilot payment is unavailable. Continued access may be overlaid only by an audited receiver-operator pilot entitlement.

`implementation_hypothesis`:

- The runtime topic branch implements the receiver publisher, entitlement mutation, atomic trial start, five-card round gate, account deletion and deployment tooling. Mobile wiring, externally approved content, receiver deployment and real-device evidence remain separate and incomplete.
- Every pilot schema carries an exact `pilot_id` and every release-shaped pilot artifact states `gate_eligible=false`.
- Repository validation, fixtures, dry-runs and simulations cannot make the pilot externally ready or satisfy beta/launch gates.

## Trial authority

Authentication alone never starts the trial. The Learning Session authority may start an available trial only after it has validated canonical content and access, selected an eligible card, persisted and confirmed the selection cursor, and is ready to return a successful session. It stores server-authoritative `trial_started_at` and `trial_expires_at` exactly 120 hours apart in the same membership transaction that changes `trial_available -> trial`.

Invalid content, a missing selection, cursor write failure, failed cursor confirmation or an unsuccessful session response cannot consume the trial. Repeated or concurrent session reads are idempotent. Membership, Bootstrap and Learning Session responses expose the canonical timestamps plus server-derived `trial_remaining_seconds`, calculated against that response's server time and set to zero outside an active trial; clients display them and never manufacture entitlement time or remaining duration.

## Five-card round authority

Controlled-pilot rounds are server gates, not client counters. `completed_count` is the cumulative count of newly accepted account-and-track learning or review events and equals the canonical learning projection's maximum `server_sequence`. A boundary exists only when that cumulative sequence is a positive multiple of five. Activity-day `progress.total_completed_count` remains daily feedback and is never round authority; this prevents midnight rollover from duplicating or skipping a boundary. At an unacknowledged boundary, `learning-session.v1` returns no selection or next-due time and returns one deterministic round-completion receipt bound to the authenticated account, active `pilot_id`, content version and completed count. That object contains `space_card_id`, equal to the active-content card ID from the canonical event whose `server_sequence` exactly equals `completed_count`; mobile resolves only this ID for the compact actual Space address and never infers the boundary card from phase grouping, `client_occurred_at`, or device time. It also contains ordered unique `review_card_ids`, derived in active card-source order from currently accessible, non-sleeping cards whose latest canonical account-and-track event has `answer_grade=review_needed`. Mobile may resolve only those IDs for the receipt's read-only review action and may not infer or reorder review content. The scheduler must not create or persist the next card cursor while that receipt is pending.

The primary “继续下一轮” action calls authenticated `POST /v2/learning/round/continue` with an exact `pilot-round-continue.v1` command containing only schema version, CET4, content version, receipt ID and completed count. The server rederives the account, pilot, active release, canonical count and receipt, requires a positive multiple of five, then writes one exact `pilot-round-continue-ack.v1` record. Exact replay is idempotent; account, pilot, content, count or receipt drift fails closed. Only after this acknowledgement may a later Learning Session select the next card.

The account-scoped continuation record is stored in `softbook_pilot_round_continuations`, validated exactly on every read, included in receiver provisioning/preflight/lifecycle cleanup and removed by account deletion. Duplicate learning events, offline replay, app restart and cross-device reads cannot increment, skip or acknowledge a boundary. Formal beta/production runtime does not expose the endpoint or apply this pilot gate.

## Schemas

### `controlled-pilot-profile.v1`

The profile binds an independent receiver-owned environment,
`runtime_mode=controlled_pilot`, only `cet4`, iOS and Android minimum versions,
a public signing key ID, a 30–50 account cohort limit and a pilot expiry. The
known personal development environment is rejected. It contains no credential
or user identity and is always `gate_eligible=false`.

### `controlled-pilot-bundle.v1`

The bundle binds one exact controlled-pilot profile, exactly 120 approved CET4
cards and a stable 60-card free prefix. Full content distribution is fixed at
listening 24, careful reading 24, cloze 16, writing 16, translation 16,
vocabulary 12 and grammar 12. All 120 cards must map to active boxes, duplicate
card IDs and unmapped cards are zero, every library covers at least two boxes,
and all five owned core interactions appear with counts that sum to 120. The
first 60 cards must contain every library. Repository development cards,
candidate workspace rows and dry-run projections do not count toward this
approved total. Every referenced audio asset has one matching QC record; at
least the 24 listening cards require audio.

Approval scope is `controlled_pilot_120`. The bundle binds the exact `card-make-quality-audit-v1` scoped-card report by path and SHA-256, binds its corpus digest and 120-card scope digest in canonical ascending card-ID order, and requires publication to rederive that the audit scope is exactly the content payload without changing the payload's product scheduling order. Audit has zero unresolved blockers, zero content risks, zero review gaps, zero unexplained risks and complete metadata coverage. The only allowed explained source risk is exactly 120 `synthetic_source` findings with the immutable disclosure `synthetic_training_content_not_true_exam`; pilot surfaces and research claims must describe these as CET4 preparation simulations and must never represent them as true-exam excerpts. A missing disclosure, unknown rule, count or scope drift, `unverified_source`, or any non-source finding fails closed. Content, approval, detailed audit, audio manifest and audio QC remain path/hash bound. Publication implementation must upload and re-read audio, stage content, revalidate it and activate last.

### `pilot-content-release.v1`

The activated descriptor binds one exact controlled-pilot profile and is
accepted only in a `controlled_pilot` runtime. It binds 120 total cards, 60 free
cards, exact content version, minimum clients and pilot expiry. It is never
accepted by the formal release publisher and remains `gate_eligible=false`.

### `pilot-entitlement-command.v1`

An untracked receiver-operator input contains one idempotent event, pilot,
phone, `grant|revoke`, actor, reason, UTC occurrence time, previous stage and
resulting stage. Grant must result in
`pilot_premium`; revoke must restore the canonical base stage. Future mutation
implementation must rederive and atomically verify those stages while storing
the event and active overlay, leave base membership unchanged, reject client
routes, and clean all account-keyed pilot entitlement data during account
deletion. Dry-run/apply is an execution mode outside the immutable command:
tooling defaults to dry-run and requires an explicit apply flag so the exact
same command hash can be verified before mutation.

### `pilot-outcome-report.v1`

The report contains only aggregate integer counts for a 30–50 account cohort observed for five days. The validator derives rates and permits `advance` only when first-round completion is at least 70%, D1 at least 40%, D5 at least 20%, survey response at least 80%, exam-value plus Space understanding at least 60% of respondents, and P0 incidents equal zero. It rejects direct identifiers and remains `gate_eligible=false`.

## Release non-replacement

- Pilot profiles and bundles cannot be passed to `release-bundle.v1` verification or publication.
- Pilot content, approval, device checks and outcome reports cannot update `docs/release/launch-readiness.v1.json` or replace formal beta evidence.
- Failure never falls back to repository development cards, unsigned manifests, public asset URLs, personal environments or arbitrary JSON.
- A successful pilot authorizes planning the remaining CET4 corpus; it does not approve the 120 cards as a whole-track release without the later final 1,180-card approval.
