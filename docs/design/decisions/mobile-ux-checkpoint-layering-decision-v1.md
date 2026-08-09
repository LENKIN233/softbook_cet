---
status: effective_iff_pr_484_exact_head_has_protected_product_owner_approval
classification: product_owner_governance_decision
decision_id: mobile-ux-checkpoint-layering-decision-v1
contract_version: mobile-ux-checkpoint-contract-v1
decision: accept_topology_with_fail_closed_batch_1_manifest_preparation_scope
decision_owner: github:LENKIN233
approval_subject_repository: LENKIN233/softbook_cet
approval_subject_pull_request: 484
evidence_baseline_commit: f26c2c6049ef2fdc379f181d85eb79a90598343c
activation_authority: formal-product-owner-approval
gate_effect: batch_0_topology_and_batch_1_manifest_preparation_only
bound_checkpoint_contract_path: docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md
bound_checkpoint_contract_sha256: c7ec113f1b57fa40d8e246d117a04d99fd7734338368375632cf1ccb9ae18c0c
bound_decision_proposal_path: docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-layering-decision-proposal.md
bound_decision_proposal_sha256: 4eb3c66ad19fcac7e7f5c3063212801209361fa613e8acf94db8d314d8811723
bound_browser_evidence_path: docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md
bound_browser_evidence_sha256: 6de4b67c506159038b5a198a98f14822cb7e083e31008081f3054e94731daa79
bound_state_evidence_ledger_path: docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md
bound_state_evidence_ledger_sha256: d3a1ad9a5f53e058faee3ca6e00357ba518665efbbd371986d6e61c3a269c381
bound_pc_web_mapping_path: docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md
bound_pc_web_mapping_sha256: 508571e9d3bf6832da53cbfd197e7c09d04acc4a7ae16b8ce8212f784e8e0157
---

# Mobile UX Checkpoint Layering Decision v1

## Activation and authentication

This is the separate product-owner decision record required by
`checkpoint-layering-decision-proposal.md`. File existence, author identity,
commit text, PR text, chat text, or an agent review does not activate it.

The decision becomes effective only when all of the following are true:

1. the exact head of pull request `#484` contains these exact record bytes and
   every bound source byte and is reachable from the repository;
2. GitHub workflow `formal-product-owner-approval` classifies the change as
   sensitive;
3. required reviewer `github:LENKIN233` approves environment
   `formal-product-owner-approval` for that exact head;
4. both `formal-approval-product-owner` and aggregate `formal-approval` finish
   successfully for that exact head; and
5. the repository's fail-closed decision validator confirms the pull-request
   subject, evidence baseline, bound paths, and SHA-256 values.

The authenticated product-owner identity and decision timestamp are the
reviewer and approval time recorded by that protected-environment deployment
review. If the exact-head check is absent, pending, skipped, cancelled, or
failed, this record has `gate_effect=none` and the proposal remains unaccepted.
Approval of another pull request or another sensitive change cannot activate,
renew, or replace this decision.

## Bound decision subject

- Repository: `LENKIN233/softbook_cet`
- Approval subject pull request: `#484`
- Evidence baseline commit:
  `f26c2c6049ef2fdc379f181d85eb79a90598343c`
- Checkpoint contract:
  `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md`
- Checkpoint contract SHA-256:
  `c7ec113f1b57fa40d8e246d117a04d99fd7734338368375632cf1ccb9ae18c0c`
- Decision proposal:
  `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-layering-decision-proposal.md`
- Decision proposal SHA-256:
  `4eb3c66ad19fcac7e7f5c3063212801209361fa613e8acf94db8d314d8811723`
- Browser evidence:
  `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md`
- Browser evidence SHA-256:
  `6de4b67c506159038b5a198a98f14822cb7e083e31008081f3054e94731daa79`
- State-evidence ledger:
  `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`
- State-evidence ledger SHA-256:
  `d3a1ad9a5f53e058faee3ca6e00357ba518665efbbd371986d6e61c3a269c381`
- PC Web mapping:
  `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md`
- PC Web mapping SHA-256:
  `508571e9d3bf6832da53cbfd197e7c09d04acc4a7ae16b8ce8212f784e8e0157`

The activation head is supplied by the protected `#484` workflow rather than
embedded in this file, avoiding a self-referential commit claim. After that
exact approval, descendants may rely on this decision only while this record,
all five bound sources, their SHA-256 values, the sensitive-path classifier,
and the fail-closed validator remain unchanged. Any drift requires a new
protected product-owner decision; an unrelated approval is never reusable.

## Product truth preserved

This decision changes evidence topology and sequencing only. It does not alter:

- the required iOS, Android, representative-tablet, and PC Web targets;
- system-sequenced single-current-card Learning;
- `学习 / 空间 / 统计 / 我的` top-level order;
- the five distinct interaction families, with Flip alone using exactly
  `有把握 / 再回看` (`有把握 = confident/mint`,
  `再回看 = review/amber`);
- `library → group → box → card` Space ownership, favorite as a tag, or
  reversible sleep/wake eligibility;
- canonical authentication, completion, membership, commerce, managed-access,
  and reconciliation truth; or
- the prohibition on learner-visible repository, runtime, reviewer, prompt,
  predicate, test, environment, and implementation language.

## Decision answers

### Q1 — Names and dependency ordering

Accept the six checkpoint subjects and ordering in the bound contract:

1. `CP-BA` — Browser Architecture
2. `CP-CS` — Canonical Service
3. `CP-WEB` — PC Web Parity
4. `CP-VA` — Visual Authority
5. `CP-NFA` — Native Final Acceptance
6. `CP-RLR` — Release / Leadership Readiness

`CP-BA`, `CP-CS`, and `CP-WEB` may prepare exact owner, target, environment,
scenario, and evidence-manifest registries in parallel. They may not collect or
execute new evidence until those exact registries are frozen by another
protected product-owner decision. A later exact architecture decision is
required before `CP-VA`; an accepted visual artifact and implementation mapping
are required before `CP-NFA`; and one new launch release candidate cohort is
required before `CP-RLR`.

### Q2 — P0 scope and carried blockers

No checkpoint manifest and no state-evidence row is accepted by this decision.
All 173 semantic-state and forced-combination rows retain their current
`blocked_required_target` result.

The only frozen browser input retained is:

- the exact strict-4 browser base at commit
  `bd3ed0f54350b252f1554872de5a07cd09f97232`; plus
- the independently reviewed strict-5 Flip-focus delta at commit
  `d5b9250ad255215830ff21fe7e1651797234b79a`.

Together they remain `CP-BA=partial_verified` for their exact named subset.
The strict-5 delta does not migrate untouched strict-4 ledger cells into a new
cohort. Canonical service, PC Web implementation/replay, real 200% behavior,
native behavior, final visual authority, implementation mapping, stores,
receiver operations, real audio/content, assistive technology, and release
evidence remain blocked.

### Q3 — Native feasibility carrier

Choose the preferred path: native feasibility waits for an accepted `CP-VA`
artifact and exact implementation mapping. This decision does not authorize an
early `native_feasibility_only` carrier, alternate application identity,
internal distribution, store sandbox build, or any native evidence collection.
A future exception requires another protected product-owner decision.

### Q4 — Owners, verification, matrices, and authority path

- Product and checkpoint decision owner: `github:LENKIN233`.
- Semantic owners: the exact owner specs resolved through
  `spec/authority-map.json` and named in the bound checkpoint contract.
- `CP-BA` evidence owner role: Mobile UX architecture evidence owner;
  verification role: independent exact-hash browser reviewer.
- `CP-CS` operators: separately named receiver/provider account owners per
  isolated scenario manifest; verification must be a named person with no
  operator role in that scenario.
- `CP-WEB` evidence owner role: PC Web design/implementation owner;
  verification roles: independent Web behavior and accessibility reviewers.
- `CP-VA` evidence owner role: UI/UX design owner; verification role:
  independent UI/UX and accessibility design reviewer. No agent self-accepts.
- `CP-NFA` evidence owners: iOS and Android platform owners; verification roles:
  independent native QA/accessibility reviewers and relevant provider owners.
- `CP-RLR` owners and separation of duties: those registered by
  `spec/release-operational-policy.json`, with a distinct independent verifier.

Role acceptance does not fill a missing person, account, environment, device,
or verifier. Every scenario/aggregation manifest must name its actual operator
and independent verifier. Absence keeps that checkpoint blocked.

This record does **not** freeze those actual identities or the exact
device/OS/browser, service-environment, provider/account, scenario, or evidence
matrices. Q4 therefore remains open at execution level: only the role and
separation contract is accepted. Drafting candidate registries is permitted;
provisioning, execution, evidence collection, aggregation, and promotion are
not.

Candidate Batch 1 registry subjects must cover the contract matrices, including
separate iOS phone, Android phone, iPadOS, Android-tablet, and PC Web
compositions; required
portrait/landscape or constrained-window states; long content, focus, reduced
motion, high contrast, input, and 200% cases where applicable. `CP-CS` permits
only receiver-owned staging/provider sandbox or stronger contract-eligible
environments. Local timers, in-memory adapters, and browser presentation are
not canonical-service evidence.

The owner authentication path is the protected environment defined in
`spec/repo-delivery-contract.json`:
`formal-product-owner-approval`, required reviewer `github:LENKIN233`, with no
administrator bypass.

### Q5 — Only allowed next action

After activation, the only newly allowed action is to draft and review exact
Batch 1 owner/verifier, target-device/OS/browser, service-environment,
provider/account, scenario, and evidence-manifest registries for `CP-BA`,
`CP-CS`, and `CP-WEB`. This decision does not authorize provisioning, evidence
collection or execution, aggregation, checkpoint promotion, `CP-VA`, a
promotable visual candidate, a palette or component system, implementation
mapping, or mobile/Web implementation.

A later protected product-owner manifest decision must bind the exact Batch 1
registries and actual identities before evidence collection may begin. After
that evidence is gathered, a separate protected architecture decision must
bind the exact manifests, results, and carried blockers before
equal-completeness visual exploration may begin.

### Q6 — Native and release separation

Confirm `CP-NFA` and `CP-RLR` are separate. Browser runs, local repositories,
simulators, emulators, an evidence build, source availability, CI success, PR
metadata, or a design review cannot satisfy either checkpoint. `CP-NFA`
requires the mapped candidate on real target systems. `CP-RLR` re-executes its
formal evidence against one launch cohort.

### Q7 — Canonical-service aggregation

Confirm `CP-CS` may aggregate only by one exact aggregation manifest that
references every required isolated scenario manifest by path and SHA-256.
Formal/managed profiles, providers, product/provider accounts, service
deployments, content subjects, and execution windows remain separate. Raw
evidence or measurements never move between scenario cohorts. Missing, failed,
expired, cross-subject, or unverifiable evidence keeps the aggregate blocked.

### Q8 — Launch cohort and closure rule

Confirm the single `launch-release-candidate.v1` cohort begins only at
`CP-RLR`. Earlier checkpoint evidence or acceptance is not inherited as launch
evidence. `CP-RLR` requires zero applicable blocker, partial result, expired
result, omitted parent scope, carried gap, or unowned `N/A` across every
owner-required platform, state, forced combination, capability, and registered
formal evidence type. Only an exact owner-backed
`not_applicable_with_authority` result may be excluded.

## Current checkpoint results

Activation of this decision yields only these scoped results:

| Checkpoint | Result after activation |
| --- | --- |
| `CP-BA` | `partial_verified` for the bound strict-4 base plus strict-5 focus delta only |
| `CP-CS` | `blocked` |
| `CP-WEB` | `blocked` |
| `CP-VA` | `blocked`; visual exploration not authorized |
| `CP-NFA` | `blocked` |
| `CP-RLR` | `blocked` |

No accepted checkpoint manifest or execution registry exists. This is
acceptance of the Batch 0 topology and Batch 1 manifest-preparation boundary,
not permission to collect evidence and not acceptance of architecture evidence,
visual quality, native behavior, implementation, release, or leadership
readiness.

## Revocation and invalidation

This decision is revoked or the affected scope becomes `invalidated` when any
of the following occurs without a new protected owner decision:

- the bound record, contract, proposal, evidence baseline, browser evidence,
  ledger semantics, PC Web
  mapping, owner spec, target matrix, or authority path changes incompatibly;
- the protected approval is absent, dismissed, cancelled, superseded, or bound
  to a different head than the record bytes;
- a required operator/verifier distinction, account/environment subject, raw
  artifact hash, evidence window, exception expiry, or semantic owner binding
  is missing or fails validation;
- the product owner rejects or revokes the topology or allowed next action; or
- a lower checkpoint result used by a later decision is rejected, revoked, or
  invalidated.

Any byte change to this decision or a bound source fails closed until its new
hashes receive a new protected product-owner approval. The approval recorded
for pull request `#484` is durable only for the unchanged bound decision and
cannot be borrowed by another pull request.

Historical raw evidence remains historical only after invalidation. It cannot
be relabeled, stitched, or inherited into a new checkpoint or release cohort.

## Explicit non-claims

This decision does not claim that the current product is visually accepted,
native-complete, production-ready, launch-ready, leadership-ready, or suitable
for a leadership checkout from `main`. It does not select black/white/gray or
any other palette. It does not revive any rejected mobile visual direction.
