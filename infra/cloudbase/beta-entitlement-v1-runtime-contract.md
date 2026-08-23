# Softbook Beta Entitlement v1 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`

## Authority boundary

`product_truth`:

- Closed-beta users may receive the complete premium experience without payment.
- Membership remains shared server authority across supported clients.
- Clients cannot grant or revoke their own entitlement.

`implementation_hypothesis`:

- A receiver operator supplies a local `beta-entitlement-command.v1` input to a
  dry-run-first repository command.
- The receiver stores the active grant and its append-only audit history in one
  `softbook_beta_entitlements` document keyed by phone number.
- The canonical membership read overlays `premium` only while an active grant
  exists. The base `softbook_memberships` document is never rewritten by the
  operator command, so revocation reveals the latest base membership and cannot
  downgrade a later non-beta premium state.

## `beta-entitlement-command.v1`

The strict operator input contains `event_id`, `action=grant|revoke`,
`phone_number`, `campaign_id`, `grant_id`, `actor_id`, `reason`, and canonical
UTC `occurred_at`. Unknown fields fail closed. The campaign must equal the
closed-beta release candidate campaign used by formal evidence. The exact
canonical command receives a SHA-256 binding; replaying the same event is
idempotent, while reusing an event ID for different bytes is rejected.

Command files contain personal data. They are operational inputs, not release
artifacts, and must not be committed, copied into `release-bundle.v1`, or
exported from the development environment.

## Audit and mutation rules

Each stored audit event binds action, event ID, campaign ID, grant ID, actor,
reason, timestamp, previous stage, resulting stage, and command hash. Grant
requires no other active beta grant. Revoke requires the exact active campaign
and grant ID. Revision and audit length advance together in the same
beta-entitlement document update.

The runtime fails closed on malformed active evidence. Inactive historical
records do not change membership. Account/smoke lifecycle cleanup treats the
beta-entitlement document as user data and removes it by exact manifest-owned
phone ID.

Learning-session Trial activation treats beta entitlement as transactionally
relevant membership authority. After a selection cursor is accepted, the
scheduler rechecks stage, acknowledgement, and the base/beta/pilot component
revision checkpoint. The activation transaction then reads the selected cursor,
base membership, and beta entitlement together (plus pilot entitlement only in
controlled-pilot mode) and conditionally matches that checkpoint before any
base Trial write. A grant or revoke racing selection therefore causes bounded
rescheduling; an active beta grant remains premium and cannot consume or mutate
the underlying Trial clock. Repository tests cover this ordering but are not a
receiver grant or deployed concurrency proof.

## Operator safety

`infra/cloudbase/manage-beta-entitlement.mjs` is read/write only against a
validated receiver-owned `delivery-profile.v1`. It performs remote environment
and collection preflight, reads the current base membership and beta record,
and prints a phone-free account fingerprint in its plan. It is dry-run by
default.

`--apply` additionally requires Node 22.13.0 and a clean `main` exactly equal to
`origin/main`. After an update it re-reads and byte-compares the normalized
stored record with the plan. Its privacy-safe `beta-entitlement-report.v2`
binds the repository commit, profile bytes, environment, campaign, command
hash, identified operator, execution window, receiver preflight, write safety,
unchanged base-membership digest and verified beta revision/audit/active state.
It is `gate_eligible=false` on its own and never emits the phone number or
command bytes. Repository tests do not
constitute a real receiver grant, remote device verification, or launch
readiness.
