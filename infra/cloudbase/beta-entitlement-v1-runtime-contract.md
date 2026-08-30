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
command also requires `expected_account_instance_id`. The private command,
stored audit and receiver HMAC bind that raw opaque generation, while public
plans and reports omit it. The canonical command receives a SHA-256 binding; replaying the same event is
idempotent, while reusing an event ID for different bytes is rejected. Public
actor, campaign, grant and event identifiers reject a literal phone number,
one revealed after NFKC normalization, and raw account-instance material; the
CLI result parser applies the same private-material boundary.

Command files contain personal data. They are operational inputs, not release
artifacts, and must not be committed, copied into `release-bundle.v1`, or
exported from the development environment.

## Audit and mutation rules

Each stored audit event binds action, event ID, campaign ID, grant ID, actor,
reason, timestamp, previous stage, resulting stage, and command hash. Grant
requires no other active beta grant. Revoke requires the exact active campaign
and grant ID. Revision and audit length advance together in the same
beta-entitlement document update. Planning resolves an expired canonical Trial
at the command timestamp without rewriting the base membership, so audit stages
cannot preserve an already elapsed Trial. Every stored audit event is converted
back to the complete command with the document phone owner and its SHA-256 is
recomputed. Moving an otherwise valid audit document from phone A to phone B
therefore fails closed before it can grant canonical membership.

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
and collection preflight. Dry-run reads the current base membership and beta
record and plans locally. Public plans contain campaign, grant, event, actor,
action and stage identities but no phone-derived identifier. It is dry-run by
default. Apply opens the personal-data command once and accepts only that same
fd's stable regular-file bytes from a path outside the repository whose every
component is non-symlink. Hardlinks plus outside byte-identical copies of any
exact-HEAD tracked blob, including symlink blobs, tracked paths and untracked
in-repository paths are all rejected before remote access. LFS pointer SHA-256
and size bindings are resolved against the same bytes; any gitlink fails closed.
The helper returns its checked HEAD, the first repository snapshot must match
it exactly, and the same HEAD is rechecked immediately before function invoke.

`--apply` additionally requires Node 22.13.0 and a clean `main` exactly equal to
`origin/main`, plus a dedicated `SOFTBOOK_BETA_OPERATOR_SECRET` with at least
32 characters and 12 unique characters, distinct from auth secrets; CLI and
receiver both enforce it. Before invocation it re-observes the receiver function and
requires the exact profile-and-commit-derived backend deployment ID, explicit
`closed_beta` release class and deployed beta-secret configuration. Apply sends
one strict `beta-entitlement-operator-invoke.v1` HMAC invocation bound to both
the command and that backend deployment ID. The receiver rejects every other
release class or deployment identity. That function reads base membership plus its revision,
plans the mutation, and writes the beta entitlement in one database
transaction. Before dry-run or apply the CLI queries `softbook_accounts` and
requires exactly the command's existing instance; an absent instance is an
explicit refusal that tells the user to sign in first. It also requires at
least one strict current active session whose phone, 64-hex account key and
instance match the command, whose account/session timestamps are canonical and
ordered, and whose refresh lifetime is still valid; an active-shaped malformed
or expired record fails closed. The receiver transaction
rederives the account key from the private phone and requires that exact current
instance plus deletion-task absence, so an A1 command cannot grant A2 after
deletion and re-registration. The CLI never performs the beta write directly; afterward it
re-reads and verifies the normalized beta audit against the function result.
The receiver transaction also derives and reads the account-keyed deletion
task before base-membership reconciliation or beta mutation. Any present task
fails closed with `account_deletion_pending`, including when deletion begins
after invocation authentication but before the transaction starts.
Its privacy-safe `beta-entitlement-report.v3`
binds the repository commit, profile bytes, environment, campaign, a
report-domain keyed command HMAC, identified operator, execution window,
receiver preflight, write safety,
unchanged base-membership digest and verified beta revision/audit/active state.
The report records privacy-safe before and after beta-state digests. Grant,
replay, revoke and replay must form one continuous transition chain; this binds
the lifecycle to one account without emitting a phone-derived account
identifier and makes cross-account report splicing fail closed.
It is `gate_eligible=false` on its own and never emits the phone number or
command bytes. Repository tests do not
constitute a real receiver grant, remote device verification, or launch
readiness.

The closed-beta evidence loader registers `beta-entitlement-drill` only over
five distinct tracked strict-JSON roles: one exact delivery profile plus applied
grant, idempotent grant replay, applied revoke and idempotent revoke replay
reports. It rehashes every raw file and requires one commit/profile/environment,
candidate campaign, exact backend deployment, grant, distinct grant/revoke
event identities, identified operator, unchanged base-membership digest and a
continuous before/after beta-state chain. Grant must move a non-premium base stage to
premium; revoke must restore it; revision/audit state advances exactly once per
mutation and remains byte-identical on both replays. A planned or isolated raw
report cannot pass the drill.
