# Check-in and Account Deletion States v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/interactions.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-daylight-studio-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`

## Product Truth

- Statistics is a supporting surface for simple statistics and an explicit check-in. It does not schedule learning, infer check-in from learning counts, or become a streak dashboard.
- A check-in is account-and-China-day scoped, explicit, monotonic, and safe to retry. A local queued action is not the same fact as server confirmation.
- Mine owns account and privacy actions without displacing Learning as the product center.
- Account deletion is destructive and account-wide. A successful request queues deletion and revokes the signed-in sessions; it does not prove that asynchronous erasure has already finished.
- Internal product decisions are accepted by model + harness. No human, user, or product-owner review is a delivery gate. The learner-facing confirmation before a destructive account action remains part of the product interaction, not an internal review gate.

## Implementation Hypothesis

The existing accepted Statistics ledger and Mine account-object silhouettes are sufficient. This bounded state extension reuses them and does not require a new visual system or a new core-surface search run.

## Decision

Adopt the state families rendered in `docs/design/mocks/check-in-account-deletion-states-v1.html` for phone and PC Web.

### Statistics check-in

The daily ledger remains visible in every state. The check-in action attaches to it as one quiet row or side object:

1. `unavailable_before_learning`: one completed card is still required; the route back to Learning is primary.
2. `ready`: the explicit action is available and does not imply a reward.
3. `submitting`: the affected action is disabled while the current attempt is being confirmed; the ledger does not disappear.
4. `queued_local`: the exact-day action is durably held for reconnection, but the copy does not call it server-confirmed.
5. `confirmed`: the account-owned daily record is confirmed; the control becomes a quiet completed state.
6. `recoverable_unknown`: confirmation is not known; retry continues the same monotonic action and must not imply a duplicate.

### Mine account deletion

The deletion entry starts inside the account object and expands in place:

1. `confirmation`: state the irreversible account-wide consequence, keep `保留账户` as the safe secondary action, and require one explicit destructive confirmation.
2. `submitting`: disable repeated submission and keep the consequence visible while the request outcome is unknown.
3. `accepted`: remove the operable signed-in shell, say that the request was accepted and the account was signed out, and say that cleanup may still be in progress.
4. `recoverable_unknown`: preserve the account object, expose safe retry, reveal no raw transport or provider language, and do not claim either erasure or non-erasure.

## Platform adaptation

- Phone: check-in states stay inside the daily object; deletion confirmation/submission/failure use the existing account-attached sheet silhouette. Accepted deletion becomes a neutral signed-out identity object.
- PC Web: check-in states remain attached to the center ledger with the right rail secondary. Deletion uses an account-attached center panel, not a browser-native alert or settings table. Accepted deletion becomes the calm identity gate and removes the authenticated route rail.
- Tablet is not newly authorized by this artifact. It may inherit the phone state meaning only after a dedicated tablet composition maps the same facts.

## Rejected interpretations

- Automatically checking in after card completion.
- Treating a queued local check-in as confirmed.
- Confetti, badges, streak rewards, trend dashboards, or red punishment semantics on Statistics.
- A one-tap deletion action without consequence confirmation.
- Copy that claims all data is erased immediately after a `202`-style accepted request.
- Leaving the authenticated Learning/Space shell operable after deletion acceptance.
- Raw error, route, provider, worker, queue, token, or internal state names in learner-visible copy.

## Model-owned acceptance

This exact design delta is accepted for design-only authority by the same model task using two review passes: Pass A inverted assumptions around confirmation, local queueing, and asynchronous erasure; Pass B projected ambiguity, duplicate-action, stale-session, narrow-screen, keyboard, and metadata-leak failures. No OpenAI API was called, and no separate task, provider, or independent reviewer is claimed. Repository checks remain required before merge.

## Status

`accepted_authority` for design-only planning. This PR contains no product UI implementation and does not claim runtime, deployment, device, distribution, or completed-erasure evidence.
