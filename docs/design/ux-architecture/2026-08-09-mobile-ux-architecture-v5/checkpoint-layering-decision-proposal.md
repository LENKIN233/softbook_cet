---
status: resolved_iff_separate_protected_decision_is_active
classification: implementation_hypothesis
decision_owner: product_owner
decision_recorded: docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md
gate_effect: delegated_to_exact_head_protected_decision
---

# Mobile UX Checkpoint Layering Decision Proposal v1

## Decision status

This proposal is not an approval record. Its questions are answered by the
separate protected record
`docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md`. That
record becomes effective only when the exact head of pull request `#484`
containing its bound bytes passes the protected product-owner environment.
Until then no decision is accepted. Even after activation, the record
authorizes Batch 1 owner/matrix/manifest preparation only; it does not authorize
provisioning, evidence collection, visual exploration, implementation, native
evidence promotion, release, or leadership presentation.

Unless that authenticated owner decision is active, the result remains:

`architecture_gate_blocked_with_browser_subset_verified`

## Referenced authority

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/README.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/platform-architecture.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md`

## Product truth versus implementation hypothesis

`product_truth` remains the required iOS, Android, representative-tablet, and
PC Web product; dedicated composition; single-current-card Learning; five
interaction families; Space hierarchy; canonical commit/access; formal
cross-target commerce; receiver-managed access separation; and zero learner
metadata leakage.

`implementation_hypothesis` is the proposed six-layer evidence workflow,
checkpoint naming, native carrier, target matrix, state-to-evidence ownership,
and sequencing. Accepting the workflow must not weaken product truth or any
formal gate.

## Problem requiring a decision

The current v5 sources use `architecture gate` for several different subjects:

- `README.md` says visual search remains blocked by uncovered states, all native
  evidence, PC Web mapping, and product-owner acceptance.
- `state-evidence-ledger.md` keeps the overall architecture gate blocked while
  any required device-class, forced-combination, native final-acceptance, or PC
  Web cell is blocked.
- `platform-architecture.md` places native-pending completion in P1 before
  promotion to accepted visual authority rather than in the P0 browser
  architecture subset.
- `spec/visual-language.json` forbids user-facing implementation before an
  accepted design artifact and implementation mapping.

Without an explicit layer decision, the work risks a circular dependency:
native final evidence requires a mapped native carrier, while a mapped product
implementation requires accepted visual authority, yet visual work is described
as blocked by the absent native evidence.

The correct response is not to rename blocked evidence as passed. The proposal
separates evidence subjects so each remains fail-closed under its real owner.

## Proposed decision

Adopt the six checkpoint subjects defined in `checkpoint-contract.md`:

1. Browser Architecture (`CP-BA`)
2. Canonical Service (`CP-CS`)
3. PC Web Parity (`CP-WEB`)
4. Visual Authority (`CP-VA`)
5. Native Final Acceptance (`CP-NFA`)
6. Release / Leadership Readiness (`CP-RLR`)

Permit `CP-BA`, `CP-CS`, and `CP-WEB` exact owner, target, environment,
scenario, and evidence-manifest preparation to proceed in parallel. Require a
separate protected product-owner decision to freeze those execution registries
before collecting evidence. Then require a separate product-owner architecture
decision, bound to exact checkpoint manifests and explicit remaining blockers,
before opening equal-completeness visual exploration. Keep native final acceptance after an
accepted visual artifact and implementation mapping. Keep formal release and
leadership readiness bound to the existing launch release candidate and release
operational policy. `CP-CS` uses one aggregation manifest over strictly isolated
profile/provider/account/environment/window scenario cohorts; it never blends
raw evidence. The single `launch-release-candidate.v1` cohort begins only at
`CP-RLR`. `CP-RLR` requires full owner-required platform, state, forced-
combination, capability, and parent-scope closure with zero carried blocker or
gap; only exact owner-backed `not_applicable_with_authority` results may be
excluded.

The current protected answer accepts checkpoint terminology, sequencing, and
manifest-preparation scope only. Because actual operators, independent
verifiers, and exact target/environment/scenario matrices remain unfrozen, it
does not authorize evidence collection. It does not alter any current ledger
cell, current PR status, product truth, visual acceptance, implementation
authorization, native result, or release result.

## Native carrier recommendation

Use the actual mapped candidate build after `CP-VA` whenever possible. If an
earlier native feasibility carrier is necessary, authorize it separately under
the `native_feasibility_only` restrictions in `checkpoint-contract.md`:

- separate non-production identity, signing, environment, accounts, store
  sandbox, and distribution;
- compile-time prohibition of production credentials/endpoints/channels;
- explicit expiry and internal device-lab scope;
- `gate_eligible=false` for native final acceptance and release;
- mandatory re-run on the exact mapped candidate build.

The product owner has **not** authorized this evidence build through this file.

## Decision questions for the product owner

1. Accept, reject, or amend the six checkpoint names and dependency ordering.
2. Define the exact P0 state/evidence set that may support an architecture
   decision permitting visual exploration; unresolved cells must remain named
   and blocked.
3. Confirm whether native feasibility waits for `CP-VA` or may use a separately
   accepted non-promotable evidence carrier.
4. Name the evidence owner, independent verifier, target device/OS/browser
   matrix, service environments, semantic owner anchors, decision owner, and
   owner-authentication path for each checkpoint. For `CP-CS`, confirm the
   product-owner decision record binds the exact aggregation manifest and all
   isolated scenario-manifest hashes; absent authenticated binding remains at
   most `technically_passed`.
5. Confirm that product-owner architecture acceptance permits only
   equal-completeness visual exploration, not implementation.
6. Confirm that `CP-NFA` and `CP-RLR` remain separate and that no browser,
   simulator, evidence build, repository simulation, or PR metadata may satisfy
   them.
7. Confirm that `CP-CS` aggregates results only through exact manifest hashes,
   never by blending raw evidence across formal/managed profiles, providers,
   product or provider accounts, deployments, content subjects, or execution
   windows.
8. Confirm that the single launch-release-candidate cohort is created only for
   `CP-RLR`, prior checkpoint acceptance is not launch-evidence inheritance, and
   formal readiness requires zero applicable blocker/gap across every
   owner-required release platform, state, and forced combination. Only exact
   owner-backed `not_applicable_with_authority` may be excluded.

## Required decision-record contract

An accepted/rejected decision must be recorded separately and bind at least:

- decision ID and contract version;
- exact approval-subject pull request, evidence-baseline commit, and
  `checkpoint-contract.md` SHA-256;
- exact accepted/rejected scope and checkpoint dependencies;
- named evidence manifests and remaining blockers when execution is authorized;
  a topology-only decision must instead bind their absence and forbid execution;
- for `CP-CS`, the authority-owned scenario matrix, aggregation-manifest hash,
  every isolated scenario-manifest hash, exact semantic owner anchors, evidence
  operator, independent verifier, decision owner, and authentication mechanism;
- native carrier choice and restrictions;
- allowed next action;
- product-owner identity and decision timestamp through the repository's
  required authority path;
- revocation/invalidation conditions.

An agent-authored edit to this proposal, a PR description, a review comment, or
a `verified_by` field is not that decision.

The protected Batch 0 answer accepts the roles and separation rule in question
4 but does not invent or freeze missing people, accounts, environments, or
matrices. Question 4 remains open at execution level, and question 5 remains
open until an exact architecture subject exists. Until another protected
decision binds those exact registries, the only allowed follow-up is their
preparation and review.

## Rule while the protected decision is inactive

Unless the separate decision record is active for its exact protected head:

- keep all six checkpoints fail-closed;
- preserve the exact strict-4 browser base plus the independently reviewed
  strict-5 Flip-focus delta only as `partial_verified` evidence; the delta does
  not migrate untouched strict-4 ledger cells into a new cohort;
- keep every `CP-CS` profile/provider/account/environment/window scenario
  isolated and do not create or imply a launch cohort;
- do not start visual candidates or implementation from this proposal;
- do not create a native evidence build;
- do not alter ledger cells based on this proposal;
- do not call the product final, native-complete, production-ready, or
  leadership-ready.
- do not permit `CP-RLR` entry while any owner-required platform, state, forced
  combination, capability, parent scope, or formal evidence cell is blocked,
  partial, expired, omitted, or marked `N/A` without exact owner authority.

The final goal remains a mature, explicitly accepted CET4/6 product that is
genuinely usable on iOS, Android, representative tablets, and PC Web.
