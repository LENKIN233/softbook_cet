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
- It contains exactly 120 model-authorized cards, starts a complete five-day experience only from the first valid Learning Session, and measures five-card rounds and five-day retention.
- It is not the formal closed beta. Formal CET4 closed beta continues to require 1,180 cards, 301 audio references, complete QC and one whole-track model-owned authorization.
- Pilot payment is unavailable. Continued access may be overlaid only by an audited receiver-operator pilot entitlement.

`implementation_hypothesis`:

- The repository implements fail-closed profile, bundle, model authorization, audit, audio-QC and release validators plus publication sequencing through an injected receiver adapter.
- Runtime content authority distinguishes `development`, `production` and `controlled_pilot`: production accepts only `content-release.v1`; controlled pilot accepts only a current `pilot-content-release.v1` with exactly 120 cards and a 60-card free prefix; neither mode falls back to development content.
- The shared authenticated `GET /v2/learning/card-source`, Bootstrap, Learning Events, Learning Session, content-manifest and Space paths apply that mode boundary. Bootstrap and content-manifest expose exact `controlled_pilot` variants rather than mixing formal release fields into pilot responses, and the mobile repositories parse those variants fail closed. Non-development authentication still requires strong separate secrets, a persistent store, trusted client IP and a non-development SMS provider. The controlled-pilot mobile runtime has no `/v1` dependency for loading card bodies.
- A concrete CloudBase receiver adapter, dry-run-first `preflight|provision|deploy|publish|verify` command, dry-run-first authorized-artifact bundle assembler, and separately deployed leased account-deletion worker with one-minute timer are implemented locally. Five-card round gating, its exact continuation store, the mobile completion-state binding, the atomic 120-hour Learning Session trial clock, audited pilot entitlement operations, strict dual-platform minimum-version shape validation, exact pilot Bootstrap/content-manifest parsing, and actual native iOS/Android minimum-version enforcement are implemented in the repository but remain undeployed. Bootstrap gates the canonical snapshot early; the manifest gates independently only after Ed25519 verification. Receiver-owned profile/secrets and execution, complete model-owned audio QC, persistent deletion-worker execution/drill, persistent-environment proof, and automated real-device evidence remain separate and incomplete.
- `controlled-pilot-receiver-delivery-report.v2` carries the same deterministic
  commit/profile/environment/function-topology backend deployment identity as
  formal delivery. The ID is injected into `softbook-api` and remotely reread
  after deployment and during verification without exposing secret values.
  Apply and verify also require an identified operator and emit canonical
  execution timestamps. This improves receiver traceability but remains
  `gate_eligible=false`.
- Every pilot schema carries an exact `pilot_id` and every release-shaped pilot artifact states `gate_eligible=false`.
- None of this has been deployed to the receiver environment in this repository run. Repository validation, fixtures, dry-runs and simulations cannot make the pilot externally ready or satisfy beta/launch gates.

## Trial authority (repository implementation; not yet deployed)

Authentication alone never starts the trial. Trial-available card-source exposes only the stable 60-card prefix, and the Learning Session authority may start an available trial only after it has validated canonical content and access, selected an eligible card from that same already-delivered prefix, persisted and confirmed the selection cursor, and is ready to return a successful session. It stores server-authoritative `trial_started_at` and `trial_expires_at` exactly 120 hours apart in the same membership transaction that changes `trial_available -> trial`; a later canonical card-source read may then expose all 120 cards.

Invalid content, a missing selection, cursor write failure, failed cursor confirmation or an unsuccessful session response cannot consume the trial. Repeated or concurrent session reads are idempotent. Membership, Bootstrap and Learning Session responses expose the canonical timestamps plus server-derived `trial_remaining_seconds`, calculated against that response's server time and set to zero outside an active trial; clients display them and never manufacture entitlement time or remaining duration.

## Five-card round authority (repository implementation; not yet deployed)

Controlled-pilot rounds are server gates, not client counters. `completed_count` is the cumulative count of newly accepted account-and-track learning or review events and equals the canonical learning projection's maximum `server_sequence`. A boundary exists only when that cumulative sequence is a positive multiple of five. Activity-day `progress.total_completed_count` remains daily feedback and is never round authority; this prevents midnight rollover from duplicating or skipping a boundary. At an unacknowledged boundary, `learning-session.v1` returns no selection or next-due time and returns one deterministic round-completion receipt bound to the authenticated account, active `pilot_id`, content version and completed count. That object contains `space_card_id`, equal to the active-content card ID from the canonical event whose `server_sequence` exactly equals `completed_count`; mobile resolves only this ID for the compact actual Space address and never infers the boundary card from phase grouping, `client_occurred_at`, or device time. It also contains ordered unique `review_card_ids`, derived in active card-source order from currently accessible, non-sleeping cards whose latest canonical account-and-track event has `answer_grade=review_needed`. Mobile may resolve only those IDs for the receipt's read-only review action and may not infer or reorder review content. The scheduler must not create or persist the next card cursor while that receipt is pending.

The primary “继续下一轮” action calls authenticated `POST /v2/learning/round/continue` with an exact `pilot-round-continue.v1` command containing only schema version, CET4, content version, receipt ID and completed count. The server rederives the account, pilot, active release, canonical count and receipt, requires a positive multiple of five, then writes one exact `pilot-round-continue-ack.v1` record. Exact replay is idempotent; account, pilot, content, count or receipt drift fails closed. Only after this acknowledgement may a later Learning Session select the next card.

The account-scoped continuation record is stored in `softbook_pilot_round_continuations`, validated exactly on every read, included in receiver provisioning/preflight/lifecycle cleanup and removed by account deletion. Duplicate learning events, offline replay, app restart and cross-device reads cannot increment, skip or acknowledge a boundary. Formal beta/production runtime does not expose the endpoint or apply this pilot gate.

The exact `pilot-round-completion.v1` receipt returned as
`learning-session.v1.round_completion` contains only:

```json
{
  "schema_version": "pilot-round-completion.v1",
  "pilot_id": "<active pilot ID>",
  "content_version": "sha256:<64 lowercase hex characters>",
  "receipt_id": "prc_<43 base64url characters>",
  "completed_count": 5,
  "space_card_id": "000005",
  "review_card_ids": ["000002", "000005"]
}
```

The exact `pilot-round-continue.v1` request body contains only
`schema_version`, `track`, `content_version`, `receipt_id`, and
`completed_count`. The exact successful response and stored acknowledgement
contains only the following public fields; storage additionally owns the
non-public `account_key` scope used for lookup and deletion:

```json
{
  "schema_version": "pilot-round-continue-ack.v1",
  "pilot_id": "<active pilot ID>",
  "track": "cet4",
  "content_version": "sha256:<64 lowercase hex characters>",
  "receipt_id": "prc_<43 base64url characters>",
  "completed_count": 5,
  "acknowledged_at": "2026-08-12T00:00:00.000Z"
}
```

Receipt IDs are deterministic SHA-256-derived opaque identifiers over the
server-owned account key, pilot ID, track, content version and completed count.
They never encode a phone number or accept client entropy. A continuation
document is keyed by account, track and completed count so exact replay returns
the original acknowledgement timestamp while later boundaries remain auditable.

## Schemas

### `controlled-pilot-profile.v1`

The profile binds an independent receiver-owned environment,
`runtime_mode=controlled_pilot`, only `cet4`, iOS and Android minimum versions,
a public signing key ID, a 30–50 account cohort limit and a pilot expiry. The
known personal development environment is rejected. It contains no credential
or user identity, requires a credential-free HTTPS API base URL with a function
path, and is always `gate_eligible=false`.

### `controlled-pilot-bundle.v1`

The bundle binds one exact controlled-pilot profile, exactly 120 model-authorized CET4
cards and a stable 60-card free prefix. Full content distribution is fixed at
listening 24, careful reading 24, cloze 16, writing 16, translation 16,
vocabulary 12 and grammar 12. All 120 cards must map to active boxes, duplicate
card IDs and unmapped cards are zero, every library covers at least two boxes,
and all five owned core interactions appear with counts that sum to 120. The
first 60 cards must contain every library. Repository development cards,
candidate workspace rows and dry-run projections do not count toward this
authorized total. Every referenced audio asset has one matching QC record; at
least the 24 listening cards require audio.

Authorization scope is `controlled_pilot_120`. The bundle binds a complete
`controlled-pilot-review.v2` by path and SHA-256 plus a
`controlled-pilot-authorization.v2` containing two distinct accepted model
runs. Their canonical input binds the exact review, runtime payload, scoped
audit, corpus fingerprint, pilot ID, content version, 14 boxes and 120 card IDs.
The bundle also binds the exact `card-make-quality-audit-v1` scoped-card report
by path and SHA-256, its corpus digest and 120-card scope digest in canonical
ascending card-ID order, and requires publication to rederive that the audit
scope is exactly the content payload without changing the payload's product
scheduling order. Audit has zero unresolved blockers, zero content risks, zero
review gaps, zero unexplained risks and complete metadata coverage. The only
allowed explained source risk is exactly 120 `synthetic_source` findings with
the immutable disclosure `synthetic_training_content_not_true_exam`; pilot
surfaces and research claims must describe these as CET4 preparation
simulations and must never represent them as true-exam excerpts. A missing
disclosure, unknown rule, count or scope drift, `unverified_source`, or any
non-source finding fails closed. Content, review, authorization, detailed
audit, audio manifest and audio QC remain path/hash bound. Publication must
upload and re-read audio, stage content, revalidate it and activate last.

### `pilot-content-release.v1`

The activated descriptor binds one exact controlled-pilot profile and is
accepted only in a `controlled_pilot` runtime. It binds 120 total cards, 60 free
cards, exact content version, minimum clients and pilot expiry. Runtime
authority accepts `minimum_client_versions` only when it contains exactly
`android` and `ios`, each with a semantic-version string, and accepts the
release only inside its activation-to-expiry window. The descriptor contains
exactly `activated_at`, `card_count`, `content_version`, `expires_at`,
`free_card_count`, `gate_eligible`, `minimum_client_versions`, `pilot_id`,
`profile_id`, `release_class`, `release_id`, `runtime_mode`, `schema_version`,
and `track`; an unknown field or non-string identifier fails closed. It is never accepted by
the formal release publisher and remains `gate_eligible=false`.

### Controlled-pilot client projections

The signed `content-manifest.v1` controlled-pilot variant contains exactly
`schema_version`, `release_id`, `release_class`, `pilot_id`, `track`,
`content_version`, `minimum_client_versions`, `expires_at`, `gate_eligible`,
and `assets`. `release_class` is exactly `controlled_pilot`, `track` is exactly
`cet4`, `minimum_client_versions` contains exactly semantic-version `android`
and `ios` entries, `expires_at` is a future canonical UTC timestamp, and
`gate_eligible` is exactly `false`. The formal
`minimum_client_version`/`parent_release_id` fields are forbidden. Each private
download expiry is capped at the signed release expiry, and mobile rejects a
download that outlives it. The complete signed wire shape is owned by
`infra/cloudbase/content-manifest-v1-runtime-contract.md`.

Bootstrap `data.content` uses a separate exact controlled-pilot projection:

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

Mobile now parses this exact Bootstrap variant, including the exact
`source.id`/`source.label` object, both semantic-version fields, canonical
expiry later than the response's `generated_at`, pilot and release identifiers,
and literal false gate marker. It rejects unknown fields, missing platforms,
formal-field mixing, expired pilot content, or any gate drift. Formal and
development Bootstrap content retain their separate exact seven-field shape.
After parsing, the remote Bootstrap repository selects the actual native
platform's minimum and fails closed before returning canonical state unless the
actual installed version meets it. The signed content-manifest repository
performs the same platform-specific check independently, but only after strict
Ed25519 verification. Installed identity is supplied synchronously by
`NativeModules.SoftbookAppInfo`, must match React Native `Platform.OS`, and
must be a strict semantic version with a required `x.y.z` core and only valid
optional prerelease/build identifiers; missing, malformed, mismatched,
unsupported, or below-minimum identity fails closed. Numeric prerelease
identifiers compare numerically, alphanumeric identifiers compare lexically, a
stable release sorts after its prerelease, build metadata does not change
precedence, and no value such as `1.0` is coerced to `1.0.0`.

These gates are repository-local implementation only. They have not been
deployed or proved on real iOS/Android devices in a receiver-owned environment,
and they do not change any pilot artifact's literal `gate_eligible=false`.

### `pilot-entitlement-command.v1`

An untracked receiver-operator input contains one idempotent event, pilot,
phone, `grant|revoke`, actor, reason, UTC occurrence time, previous stage and
resulting stage. Grant must result in
`pilot_premium`; revoke must restore the canonical base stage. Future mutation
implementation rederives and atomically verifies those stages while storing
the event and active overlay, leave base membership unchanged, reject client
routes. The collection is included in exact lifecycle cleanup and remains a
required target for the repository-local account-deletion worker. Dry-run/apply is
an execution mode outside the immutable command:
tooling defaults to dry-run and requires an explicit apply flag so the exact
same command hash can be verified before mutation.

The repository stores the active overlay and append-only audit in one
`softbook_pilot_entitlements` document keyed by phone, accepts it only when its
pilot ID matches the receiver runtime's exact configured pilot, exposes the
overlay to clients as the existing `premium` product state, and publishes its
independent audited revision in controlled-pilot Bootstrap. The overlay stops
granting access at the profile's exact pilot expiry. The operator command is receiver
only, dry-run first, and has no HTTP client route. Apply uses the receiver's
IAM-authenticated non-HTTP function invocation with a command-bound HMAC from
an independent receiver-only operator secret; the receiver function reads
base, beta and pilot records and commits audit plus overlay in one database
transaction, after which the CLI independently rereads the audit event. These
public plan and report projections bind pilot, event, actor, action and stage
identity without a phone-derived fingerprint. These repository guarantees
remain undeployed until receiver execution is completed.

## Account deletion (repository implementation; not yet deployed)

`POST /v2/account/deletion` stores the account key, phone, derived phone-rate
key and retry metadata before revoking sessions. The independent deletion
worker claims tasks with a random claim-bound five-minute lease, deletes every
current account-keyed Learning/Progress/Space/Auth Session record, phone-bound
auth challenges plus retained legacy daily/learning/Space records, only the
phone rate-limit key, membership plus its revision,
beta entitlement and pilot entitlement, and removes the deletion task last. A
partial failure requeues only the same live lease; a stale worker cannot complete
or release another claim; duplicate timer delivery is safe. Removing the task
last keeps login blocked until erasure is verified and permits clean
re-registration only after completion. Formal and controlled-pilot receiver
deployment now plans `softbook-api` plus `softbook-account-deletion-worker` and
the `account-deletion-every-minute` timer. Repository tests exercise CloudBase
collection coverage, lease loss, interruption/retry and post-deletion
registration, but receiver execution and monitoring evidence remain pending.

## Publication and deployment

`controlled-pilot-publisher-v1.mjs` verifies the profile/bundle binding, every
bound file hash, actual 120/60 distribution, catalog mapping, interaction
counts, audio bytes and QC coverage. Given an injected receiver adapter,
publication uploads private audio, stages hydrated content, verifies staged
evidence, activates last and rereads the active pointer. The shared concrete
CloudBase receiver adapter accepts the pilot profile without loosening the
formal release profile, records a distinct `pilot-stage-verification.v1`, and
refuses to replace a different active release in pilot mode.

`scripts/build_controlled_pilot_bundle.mjs` consumes only explicit artifacts
from the external card workspace: the hash-bound candidate runtime payload,
current model-owned pilot review, two-run authorization record, scoped audit,
audio bytes, and complete model-owned audio-QC records. It derives the corpus fingerprint and
all release evidence summaries, copies immutable bytes into a temporary bundle,
and invokes the production publisher verifier before returning. The command is
dry-run by default and retains the verified directory only with `--apply`; an
absent, duplicate, unidentified, failed, or hash-mismatched QC record fails closed.
When QC records retain card-workspace-relative `ai_tts/...` source paths and the
exported candidate lives elsewhere, `--asset-root` explicitly names that source
workspace; the bundle never guesses it from the export directory.
It creates neither candidate content nor content/audio authorization.

`infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs` is the
pre-deployment consumer-side integration check for an exact authorized candidate.
It hash-binds the candidate payload, review, model authorization and scoped audit; hydrates
environment-only private object IDs in memory; and exercises authenticated
`/v2/learning/card-source`, session-owned membership read and Learning
Session-owned trial start, five selection-bound Learning Events, the server-owned round boundary
and continuation, Bootstrap, and the signed 24-asset content manifest. It never
substitutes for complete identified
model-harness audio QC, persistent receiver execution, private-object byte delivery or
real-device proof, and its output is always `gate_eligible=false`.

`scripts/run_controlled_pilot_mobile_acceptance.mjs` composes that backend
smoke with the React Native acceptance suite. It requires the exact
authorized candidate/review/authorization/audit outside the product repository,
captures the backend's real card-source, first Learning Session, signed pilot
manifest and post-round Bootstrap responses only in a private temporary file,
and deletes that file after mobile validation. The mobile suite parses all 120
cards, canonically evaluates the 98 auto-scored cards, completes the 22 `flip`
cards through the owned confident self-assessment state, uses a pinned ephemeral Ed25519 public key
to verify the real signed manifest, parses the exact pilot Bootstrap variant,
and completes representative `flip`, `multiple_choice`, `lock`, `elimination`
and `swipe` cards through the rendered Learning surface. Its retained report
contains only hashes, counts, fixed card IDs and explicit false capability
flags. In particular,
`installed_client_minimum_version_enforced` deliberately remains `false`:
the runner injects a deterministic identity to exercise repository wiring but
does not execute an installed native release or prove the gate on a real
device. It remains neither model-owned audio QC nor receiver key injection,
persistent environment proof, automated real-device proof, deployment, or launch evidence; `gate_eligible` is
always false.

`deliver-controlled-pilot.mjs` provides `preflight`, `provision`, `deploy`,
`publish`, and `verify`. Every mutation is dry-run unless `--apply` is explicit;
apply requires Node 22.13.0, clean exact `main`, an independent receiver
environment, a complete collection catalog, strong separate auth/SMS/signing
secrets and successful remote inspection. Deployment injects
`SOFTBOOK_RUNTIME_MODE=controlled_pilot`, persistent CloudBase storage and a
non-development SMS provider, and excludes fixed development codes. The
command never emits launch-eligible evidence and does not provide pilot
rollback; a failed or expired pilot must remain fail closed rather than silently
activate arbitrary retained content.

Actual receiver execution, SMS delivery, authenticated route probes, trigger
logs, deletion drills and automated real-device playback remain external work. Repository
fixtures, dry-runs and in-memory adapters are never deployment evidence.

### `pilot-outcome-report.v1`

The report contains only aggregate integer counts for a 30–50 account cohort observed for five days. The validator derives rates and permits `advance` only when first-round completion is at least 70%, D1 at least 40%, D5 at least 20%, survey response at least 80%, exam-value plus Space understanding at least 60% of respondents, and P0 incidents equal zero. It rejects direct identifiers and remains `gate_eligible=false`.

## Release non-replacement

- Pilot profiles and bundles cannot be passed to `release-bundle.v1` verification or publication.
- Pilot content, authorization, device checks and outcome reports cannot update `docs/release/launch-readiness.v1.json` or replace formal beta evidence.
- Failure never falls back to repository development cards, unsigned manifests, public asset URLs, personal environments or arbitrary JSON.
- A successful pilot authorizes planning the remaining CET4 corpus; it does not authorize the 120 cards as a whole-track release without the later final 1,180-card model-owned authorization.
