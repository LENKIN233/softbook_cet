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
`phone_number`, `grant_id`, `actor_id`, `reason`, and canonical UTC
`occurred_at`. Unknown fields fail closed. The exact canonical command receives
a SHA-256 binding; replaying the same event is idempotent, while reusing an
event ID for different bytes is rejected.

Command files contain personal data. They are operational inputs, not release
artifacts, and must not be committed, copied into `release-bundle.v1`, or
exported from the development environment.

## Audit and mutation rules

Each stored audit event binds action, event ID, grant ID, actor, reason,
timestamp, previous stage, resulting stage, and command hash. Grant requires no
other active beta grant. Revoke requires the exact active grant ID. Revision and
audit length advance together in the same beta-entitlement document update.

The runtime fails closed on malformed active evidence. Inactive historical
records do not change membership. Account/smoke lifecycle cleanup treats the
beta-entitlement document as user data and removes it by exact manifest-owned
phone ID.

Canonical Trial activation reads the base membership and beta-entitlement
document in one CloudBase transaction. An active beta grant returns Premium and
does not create or rewrite the base membership or increment Trial counters.
Learning-session scheduling also rechecks the canonical membership stage and
acknowledgement after every accepted fresh, resumed, or empty cursor operation;
grant or revoke drift forces a full scheduling retry before response. A
conditional Trial commit preserves the later canonical acknowledgement, so
retrying after beta or base-membership drift cannot move freshness backward.

## Operator safety

`infra/cloudbase/manage-beta-entitlement.mjs` is read/write only against a
validated receiver-owned `delivery-profile.v1`. It performs remote environment
and collection preflight, reads the current base membership and beta record,
and prints a phone-free account fingerprint in its plan. It is dry-run by
default.

`--apply` additionally requires Node 22.13.0 and a clean `main` exactly equal to
`origin/main`. After an update it re-reads and byte-compares the normalized
stored record with the plan. Repository tests do not constitute a real receiver
grant, remote device verification, or launch readiness.
