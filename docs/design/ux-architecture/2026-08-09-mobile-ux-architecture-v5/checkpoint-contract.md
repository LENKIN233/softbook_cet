---
status: governed_by_protected_product_owner_decision
classification: implementation_hypothesis
product_owner_acceptance: effective_iff_bound_exact_head_protected_approval_passes
gate_effect: batch_0_topology_and_batch_1_manifest_preparation_only_when_decision_active
scope: mobile_ux_checkpoint_layering
---

# Mobile UX Checkpoint Contract v1

## Status and authority boundary

This contract is a **proposal** for separating evidence checkpoints that are
currently described under the overloaded term `architecture gate`. It is not an
accepted product decision and changes no existing ledger result. Until an
explicit product-owner decision accepts or replaces it, the active result
remains `architecture_gate_blocked_with_browser_subset_verified`.

This document is design/governance-only. It does not:

- accept a visual system or visual candidate;
- authorize React Native, native, or PC Web implementation;
- promote browser or simulator evidence to native evidence;
- prove canonical service, store, receiver, audio, deployment, or release truth;
- authenticate product-owner approval;
- change `state-evidence-ledger.md`, any runtime contract, or any formal launch
  threshold.

When this document conflicts with an owner spec, the owner spec wins and the
affected checkpoint fails closed.

## Referenced authority

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `docs/design/design-harness.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-ux-state-contract.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/platform-architecture.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md`

## Product truth preserved

The checkpoint split does not weaken or redefine these product truths:

- iOS, Android, representative tablets, and PC Web are required release
  targets; phone, tablet, and PC Web require dedicated composition.
- Learning remains a system-sequenced, single-current-card CET4/6 flow.
- `学习 / 空间 / 统计 / 我的` remain the four top-level destinations in that
  order.
- Flip, Four-choice, Lock, Elimination, and Swipe remain five materially
  distinct interaction families; Flip alone uses `有把握 / 再回看`.
- Space retains `library → group → box → card`; favorite is a tag and
  sleep/wake changes Learning eligibility without deleting progress.
- Authentication, Learning completion, Space mutation, membership, purchase,
  restore, and receiver-managed access must preserve canonical commit/access
  truth. A client or design adapter never self-grants success or Premium.
- Formal commerce exists on all release targets and remains separate from
  receiver-managed additional access.
- Learner-visible surfaces must not expose reviewer, repository, runtime,
  predicate, test, environment, internal-key, or implementation language.

## Implementation hypotheses governed here

The six checkpoint names, their dependencies, exact evidence manifests, native
carrier choice, route containers, breakpoints, target device matrix, service
scenario orchestration, PC Web per-state mapping, and any non-promotable
evidence build are implementation hypotheses until accepted by their owner.

The current grayscale geometry, DOM, CSS, browser timers, local scenario
adapters, and platform frames are not product truth and must not seed a final
visual system.

## Checkpoint topology

The six checkpoints are distinct evidence subjects:

1. `CP-BA` — Browser Architecture
2. `CP-CS` — Canonical Service
3. `CP-WEB` — PC Web Parity
4. `CP-VA` — Visual Authority
5. `CP-NFA` — Native Final Acceptance
6. `CP-RLR` — Release / Leadership Readiness

`CP-BA`, `CP-CS`, and `CP-WEB` may prepare exact execution registries in
parallel. Evidence gathering begins only after a protected product-owner
decision freezes actual operators, independent verifiers, targets,
environments, scenarios, and manifest identities. A future product-owner
architecture decision must then name exactly which accepted results and
explicitly blocked gaps permit entry to visual exploration. `CP-VA` may then
select an accepted visual artifact and implementation mapping. `CP-NFA`
requires a mapped build on real target systems. `CP-RLR` requires one formal
launch release candidate cohort and every registered release gate.

No lower checkpoint automatically passes a higher checkpoint. A higher
checkpoint may reference a lower checkpoint only by exact checkpoint ID,
contract version, subject commit, evidence manifest hash, and decision status.

### Proposed execution batches

- Batch 0A, serial: accept or amend this layering proposal and its role and
  separation rules. This batch does not fill missing identities or change any
  ledger cell.
- Batch 0B, parallel preparation: draft exact actual-owner/verifier,
  target-device/OS/browser, service-environment, provider/account, scenario,
  and manifest registries for `CP-BA`, `CP-CS`, and `CP-WEB`. No provisioning,
  evidence execution, collection, aggregation, or promotion is permitted.
- Manifest decision, serial: the product owner freezes or rejects those exact
  registries through the protected authority path.
- Batch 1, parallel after that decision: gather `CP-BA`, `CP-CS`, and `CP-WEB`
  evidence in their own manifests. No lane may borrow another lane's evidence
  class.
- Architecture decision, serial: the product owner accepts or rejects an exact
  architecture subject and names every carried blocker plus the only allowed
  next action.
- Batch 2, serial-by-authority: perform equal-completeness visual exploration
  and decide `CP-VA`; then create and accept an implementation mapping.
- Batch 3, parallel after a mapped carrier exists: run iOS/Android native
  evidence and any remaining canonical/Web integration evidence, then decide
  `CP-NFA`.
- Batch 4, serial formal closure: assemble one launch release candidate cohort
  and execute `CP-RLR` through its registered formal gates.

Provisioning of external accounts, device access, and receiver-owned staging
may begin only when a separate authority explicitly permits it; the current
Batch 0 decision does not. Provisioning is never checkpoint evidence by itself.

## Checkpoint state terms

| Status | Meaning |
| --- | --- |
| `not_started` | No eligible evidence cohort exists. |
| `blocked` | One or more required entries, evidence cells, owners, or decisions are absent or failed. |
| `partial_verified` | A frozen, independently reviewed subset passed; missing required scope remains blocked. |
| `technically_passed` | Every technical exit criterion for this checkpoint passed under one eligible checkpoint subject: either one scenario cohort or one aggregation manifest whose required isolated scenario cohorts all passed; product or formal acceptance has not been inferred. |
| `accepted` | The checkpoint's named decision owner explicitly accepted the exact technically passed cohort through the required authority path. |
| `rejected` | The named decision owner rejected the checkpoint or revoked a prior acceptance. |
| `invalidated` | A binding source, build, service, policy, artifact, or validity window changed after evidence capture. |

`partial_verified` is never shortened to `passed`. `technically_passed` is not
product-owner acceptance. PR metadata, a reviewer summary, a local JSON file, or
an agent-authored decision record cannot change a checkpoint to `accepted`.

## Common evidence cohort

Every scenario-cohort or checkpoint-aggregation manifest must bind the fields
below when applicable. A field that is not applicable requires an owner-backed
reason; absence alone is not `N/A`.

| Field | Requirement |
| --- | --- |
| Contract identity | Checkpoint contract version, checkpoint ID, manifest schema, and evidence class. |
| Repository subject | Repository, full reachable commit SHA, branch/PR context, and exact source-artifact paths plus SHA-256. |
| Parent checkpoints | Exact parent checkpoint IDs, decision status, subject commit, and manifest hashes. |
| Product/profile subject | Formal-commerce or receiver-managed profile, membership stage, intended origin, and target state IDs. Profiles may not be blended. |
| Environment | Local read-only browser, receiver-owned staging, provider sandbox, production-like staging, or production, using the layer's allowed class. |
| Client/build subject | iOS build, Android build, PC Web deployment, bundle/application identity, version/build number, signing class, and distribution channel where applicable. |
| Service/content subject | Backend deployment, release/bundle/content version, runtime-contract hash, entitlement configuration, and private-content/audio manifest where applicable. |
| System subject | Device model/class, OS/API version, navigation mode, orientation/window mode, browser/version, text/display settings, motion setting, input method, and assistive technology. |
| Canonical command subject | Test account identity by non-secret stable reference, account/day baseline, command/event/selection ID, acknowledgement, refresh/reconciliation pointer, and provider/store result where applicable. |
| Execution window | Start/end timestamps, validity/expiry rule, and clock/time-zone basis. |
| Evidence | Exact state IDs, expected and observed results, raw artifact paths, sizes, SHA-256 values, and evidence classification. |
| Separation of duties | Operator and independent verifier identities; they must be distinct where the owner policy requires it. |
| Exceptions | Explicit exception owner, scope, expiry, residual risk, and fail-closed removal/reassessment condition. |

Evidence from different commits, builds, service deployments, content releases,
profiles, providers, accounts, or execution windows must not be combined to
manufacture a single passed scenario cohort. A new binding subject creates a
new scenario cohort unless the checkpoint owner defines and validates an exact
inheritance rule.

Checkpoints that necessarily cover mutually exclusive subjects use two levels:

1. A **scenario-cohort manifest** binds one profile, provider, product account,
   provider account where applicable, service environment/deployment, content
   subject, and execution window. Its raw evidence and pass/fail result are
   evaluated independently; evidence bytes or measurements from another
   scenario cohort cannot fill a missing or failed result.
2. A **checkpoint aggregation manifest** lists the exact scenario-cohort
   manifest paths and SHA-256 values, the authority-owned required-scenario
   matrix, each isolated result, and aggregate coverage. It may aggregate
   results, never raw evidence or measurements. It is `technically_passed` only
   when every required scenario has one eligible independently verified cohort
   and no required scenario is blocked, failed, expired, silently omitted, or
   marked `N/A` without an exact owner-backed authority reason.

### Aggregation compatibility boundary

An aggregation manifest is not permission to combine otherwise incompatible
cohorts. The authority-owned required-scenario matrix must enumerate every
dimension that is allowed to vary between child manifests. The proposed
allowed matrix-varying dimensions are limited to:

- scenario/state ID and the canonical command/event/selection instance used to
  exercise that scenario;
- formal-commerce versus receiver-managed profile/origin, provider/store lane,
  declared service-environment lane, and non-secret product/provider test-account
  reference;
- target client platform lane, device/OS/browser, orientation/window mode,
  input method, display/text/motion setting, and assistive technology; and
- child execution timestamps that remain wholly inside the aggregation
  validity window.

Each varying value must match one exact required-matrix row. A matrix row may
select a platform-specific client build only through the aggregation manifest's
frozen client-build map; it cannot supply an arbitrary build. No field varies
merely because it appears in a child manifest, and an unenumerated dimension or
value is incompatible rather than implicitly optional.

Every child in one aggregation must share one immutable compatibility key. The
aggregation manifest freezes that key directly and does not derive it by
majority or intersection. It contains:

- the full reachable repository commit and every applicable source-artifact
  path plus SHA-256;
- a backend-deployment map that pins the exact environment identity and
  deployment/version/hash for every declared service-environment lane;
- a release/content map that pins the release/bundle/content and
  private-content/audio-manifest identities and hashes for every lane where
  those subjects are applicable;
- the active runtime-contract versions/hashes and the applicable product,
  platform, membership, and release-policy versions/hashes;
- a client-build map that pins the exact corresponding build identity, version,
  signing class, distribution channel, and deployment hash for each required
  platform/provider lane; and
- one aggregation validity window, expiry rule, and clock/time-zone basis that
  contains every child execution window and is still valid when the aggregate
  is recomputed.

Platform/provider lanes may therefore use their different *corresponding*
builds only when those builds were frozen together in the compatibility key.
Two child manifests that disagree on repository/source bytes, the backend or
content subject pinned for their declared lane, runtime contract, policy, the
build pinned for their lane, or aggregation validity window are incompatible
even if their individual results passed. Changing the required matrix,
compatibility key, backend-deployment map, release/content map,
client-build map, or validity window creates a new aggregation subject and
invalidates the old aggregate.

For every referenced child, the aggregation validator must independently:

1. resolve the declared manifest path as a normalized repository-relative path,
   reject absolute paths, traversal, and symlink escape, and require the
   expected regular-file/tracking class;
2. read the referenced bytes and recompute their SHA-256 rather than trusting a
   declared digest;
3. validate the child schema and evidence class, revalidate its raw evidence
   pointers/hashes under the applicable semantic validator, and recompute its
   result, expiry, and independent-verifier eligibility;
4. compare every immutable child field with the aggregation compatibility key
   and the exact backend, content, and client-build entries pinned for that
   child's matrix lanes;
5. bind every allowed varying field to exactly one required-matrix row, rejecting
   duplicate coverage, undeclared values, and one child used for multiple rows;
   and
6. recompute aggregate coverage and status from the authority-owned matrix and
   validated child results without accepting cached child or aggregate status.

A missing, unreadable, unhashable, untracked-when-required, unrecomputable,
expired, incompatible, duplicated, or undeclared child fails the aggregation
closed. A validator that cannot interpret a required field or type also fails
closed; it must not downgrade that field to `N/A`, omit the child, or preserve a
previous pass. These are proposed contract requirements only and have no gate
effect or promotion effect until accepted through the authority path above.

The single `launch-release-candidate.v1` cohort rule belongs only to `CP-RLR`
and its registered formal gate reports. A pre-release `CP-CS` aggregation is not
a launch cohort and cannot be renamed or promoted into one. If canonical-service
evidence is later consumed by `CP-RLR`, every release-applicable formal report
must independently satisfy the active launch schema and match the one formal
release-candidate cohort; prior checkpoint acceptance is not inheritance.

## CP-BA — Browser Architecture checkpoint

### Owner

- Evidence owner: Mobile UX architecture evidence owner.
- Verification owner: Independent exact-hash browser reviewer.
- Decision owner: Product owner for any permission to move beyond architecture
  evidence.

### Entry

- The state contract, platform architecture, learner-only proofs, reviewer-only
  evidence surface, and fail-closed ledger exist.
- Learner and reviewer artifacts are physically separated and metadata-leak
  validation passes.
- The exact platform/source files to replay are frozen by SHA-256.

### Exit

- The required P0 browser-architecture state set is explicitly owned and
  replayed across iOS phone, Android phone, iPadOS, and Android tablet browser
  documents, including portrait, landscape, constrained width, large/200%
  browser text, keyboard/focus, reduced-motion replacement, and leakage checks.
- Five-family behavior, Space hierarchy/continuity, Auth focus/return, formal
  commerce versus managed access separation, origin return, recovery/escape,
  and PC-Web-independent mobile/tablet composition remain semantically correct.
- Every changed cell has an exact evidence pointer and independent frozen-hash
  review. Presentation-only or external-origin-unproven cells remain blocked.
- No page console error, horizontal page overflow, clipped required action, or
  hidden reviewer/test control exists in the operated subset.

### May claim

- `browser_architecture_partial_verified` or
  `browser_architecture_technically_passed` for the exact named cohort.
- Rendered architecture, browser interaction, DOM semantics, focus, and
  responsive containment for exact covered state IDs.

### Must not claim

- Canonical acknowledgement, durability, process recovery, Trial, entitlement,
  store, receiver operation, private audio, native platform behavior, final
  visual quality, production readiness, or leadership readiness.
- A platform browser frame is never an iOS/Android native result.

## CP-CS — Canonical Service checkpoint

### Owner

- Semantic owners, resolved through `spec/authority-map.json`:
  - `spec/account-sync-contract.json` owns authentication, canonical bootstrap,
    daily check-in, Learning events/session sequencing, Space action sync,
    Trial start, purchase/restore reconciliation, and receiver-managed access
    command/read truth;
  - `spec/membership.json` owns the Trial/Free/Premium access matrix and
    formal-commerce versus closed-beta access rules;
  - `spec/interactions.json` owns interaction-result and attached-audio resource
    semantics;
  - `spec/space-operations.json`, `spec/knowledge-map.json`, and
    `spec/box-catalog.json` own favorite/sleep/wake and Space ownership meaning;
  - `spec/card-system.json` owns card/content schema, while
    `spec/runtime-boundaries.json` and the referenced `infra/cloudbase/*`
    contracts own implementation/deployment boundaries only and cannot override
    those semantic owners.
- Evidence operators: Named receiver/provider account owners for each isolated
  scenario cohort. An operator may not verify the same scenario cohort.
- Verification owner: A named independent verifier with no operator role in the
  scenario cohort or its aggregation decision.
- Decision owner: The product owner named by the accepted checkpoint-layering
  decision.
- Authentication path: A separate product-owner decision record must bind its
  decision ID and timestamp, exact reachable repository commit, this contract
  version, the `CP-CS` aggregation-manifest path and SHA-256, every scenario
  manifest hash, accepted scope, and remaining non-release blockers through the
  owner-authentication mechanism selected in Batch 0. Until that mechanism is
  defined and authenticates the record, `CP-CS` can reach at most
  `technically_passed`; author identity, PR text, commit text, `verified_by`, or
  an agent-authored record is not acceptance.

### Entry

- An authority-owned required-scenario matrix and a checkpoint aggregation
  manifest exist. Every tested state names its semantic owner anchor,
  implementation/runtime boundary, canonical command/read, target profile,
  provider where applicable, product/provider account references, account/day
  baseline, service environment/deployment, execution window, and recovery rule.
- Formal-commerce, receiver-managed access, iOS store, Android store, Web
  payment, private-content/audio, and other mutually exclusive subjects are
  separate scenario cohorts. No scenario cohort blends profile, provider,
  account, service deployment, content subject, or execution window.
- Required receiver/provider staging or sandbox capabilities are provisioned;
  repository-local timers and in-memory adapters are excluded.

### Exit

- Required Auth, Learning completion, check-in, favorite/sleep/wake,
  membership/Trial/Free/Premium, formal purchase/restore, receiver-managed
  grant/revoke, entitlement refresh, cross-device reconciliation, and private
  audio/content states have exact acknowledgement and refresh/recovery evidence.
- Duplicate, offline, lost-during-pending, retry, process restore, stale
  account/day, store pending/cancel/error/success, restore/account mismatch, and
  safe failure paths each pass in their required isolated scenario cohort.
- The aggregation manifest references every required scenario-cohort manifest
  by exact path and SHA-256 and recomputes complete coverage. Missing, failed,
  expired, cross-profile, cross-provider, cross-account, cross-deployment, or
  cross-window evidence keeps `CP-CS` blocked; aggregation never copies raw
  evidence or measurements between cohorts.
- Client presentation never promotes a local or provider result to canonical
  access before the authoritative read/reconciliation succeeds.

### May claim

- Canonical service behavior for the exact state IDs and isolated
  account/profile/provider/deployment/command/content/window subjects named by
  the accepted aggregation manifest. Acceptance of the aggregate does not make
  any constituent scenario a formal launch report.

### Must not claim

- Native UX quality, final visual authority, real-device behavior, release
  readiness, receiver production deployment, or launch-gate satisfaction.
- Store success alone is not canonical Premium; a receiver-managed grant is not
  formal-commerce evidence.

## CP-WEB — PC Web Parity checkpoint

### Owner

- Evidence owner: PC Web design/implementation owner under
  `spec/platform-contract.json` and the accepted `pcw-01 Focused Workbench`
  decision.
- Verification owners: Independent Web behavior and accessibility reviewers.
- Decision owner: Product owner for cross-target architecture acceptance.

### Entry

- Every shared state ID has a proposed pointer to the accepted PC Web authority
  or an explicit blocked/N/A-with-authority result.
- The PC Web composition remains independently designed; mobile/tablet frames
  are not copied into the workbench.

### Exit

- Every Tier-1 semantic state and `COV-13` has an exact current mapping and
  evidence result.
- High-risk Tier-2 flows are operated at declared desktop widths and 200% zoom
  with keyboard-only, mouse/pointer, visible focus, reduced motion, and screen
  reader coverage.
- Learning, all five interaction families, Space, Statistics, Mine, Auth,
  formal commerce, managed access, origin return, and canonical-service-backed
  states preserve meaning without hover-only or gesture-only completion.
- Any unimplemented or service-unproved state remains blocked rather than being
  covered by a mapping document alone.

### May claim

- PC Web semantic parity and Web behavior for exact mapped/operated state IDs in
  the named deployment/browser cohort.

### Must not claim

- Mobile or native completion, cross-target account/service truth without
  `CP-CS`, final visual authority for mobile/tablet, or release readiness.

## CP-VA — Visual Authority checkpoint

### Owner

- Evidence owner: UI/UX design owner using accepted visual-language,
  interaction/motion, physical-space, and surface-specific artifacts.
- Verification owner: Independent UI/UX and accessibility design reviewer.
- Decision owner: Product owner. No agent may self-accept its own visual output.

### Entry

- A product-owner architecture decision explicitly permits equal-completeness
  visual exploration and names the accepted `CP-BA`, `CP-CS`, and `CP-WEB`
  results plus every carried blocked gap.
- Candidate work inherits product truth and accepted behavior artifacts without
  inheriting rejected visual geometry, palette, fragments, or screenshots.
- Every candidate has equal state/content completeness and answers the design
  review checklist.

### Exit

- A surviving rendered visual candidate is explicitly accepted by the product
  owner after equal comparison, content extremes, containment, focus,
  contrast/high-contrast, reduced-transparency/motion, route-control,
  tablet/landscape, and interaction/Space reconciliation review.
- The accepted artifact identifies unresolved gaps and is followed by an exact
  implementation mapping. Same-PR design invention cannot authorize same-PR
  user-facing implementation.

### May claim

- Accepted visual authority for the exact artifact/state/platform scope named
  in the product-owner decision.
- Permission to create/review an implementation mapping and, only after the
  repository implementation gate is satisfied, a separate implementation PR.

### Must not claim

- Native completion, implementation correctness, store/service deployment,
  launch readiness, or leadership readiness.
- A grayscale proof, current RN screenshot, relative improvement, or technical
  pass is not visual acceptance.

## CP-NFA — Native Final Acceptance checkpoint

### Owner

- Evidence owners: iOS and Android platform implementation owners.
- Verification owners: Independent native QA and accessibility reviewers, with
  provider/store owners for capability-specific evidence.
- Decision owner: Product owner for native product acceptance; release gates
  remain independently owned by release policy.

### Entry

- `CP-VA` is accepted for the exact target scope and an implementation mapping
  binds the accepted design/behavior artifacts to code.
- The candidate iOS and Android builds are built from a reachable commit and
  bind the same service/content cohort required by the test matrix.
- Real target devices and provider sandboxes are available. Simulator/emulator
  preflight is allowed but cannot satisfy real-device rows.

### Exit

- Real iPhone, Android phone, iPad, and Android tablet evidence covers the
  required Tier-2 and forced-combination matrix.
- Safe areas/system bars, IME/OTP, iOS Back/edge swipe, Android System and
  Predictive Back, Dynamic Type/font/display scale, VoiceOver/TalkBack/Switch
  Access, touch/pointer/keyboard, rotation/multi-window/process restoration,
  store purchase/restore, and real attached-audio lifecycle pass.
- Every result binds exact build, device/OS, service/content cohort, state IDs,
  raw artifact hashes, execution window, and independent verification.
- No native run silently changes Learning/Space state during cancel, Back,
  interruption, restoration, or accessibility navigation.

### May claim

- Native final acceptance for the exact iOS/Android builds, devices, state IDs,
  service/content cohort, and validity window named in the accepted checkpoint.

### Must not claim

- PC Web completion without `CP-WEB`, deployment/launch readiness, production
  capability, store publication, or leadership readiness.
- Simulator-only, evidence-build-only, or browser-wrapped results are not native
  final acceptance.

## CP-RLR — Release / Leadership Readiness checkpoint

### Owner

- Policy owner: `spec/release-operational-policy.json` and registered
  type-specific launch-evidence contracts.
- Evidence operators: Receiver/provider owners for each formal capability and
  release operation.
- Verification owner: Distinct independent verifier.
- Acceptance owner: Product owner authenticated through the protected formal
  approval environment for the exact PR head and release-candidate cohort.

### Entry

- Required design, implementation, `CP-CS`, `CP-WEB`, and `CP-NFA` parent
  subjects are accepted for the exact full release scope, and their exact
  contract versions, subject commits, manifest hashes, and decision records are
  named. A scoped parent acceptance cannot satisfy entry when its scope omits a
  required release target, device class, semantic state, forced combination, or
  capability.
- A machine-checked release coverage-closure manifest expands the active
  `spec/platform-contract.json`, state contract, target matrix, and registered
  capability requirements into every required iOS, Android, representative
  tablet, and PC Web platform/state/forced-combination cell. Every cell must be
  backed by eligible non-blocked evidence of the correct class or an exact
  owner-backed `not_applicable_with_authority` reason. Missing evidence, silent
  omission, `partial_verified`, expired evidence, an unowned `N/A`, or any
  carried blocker/gap fails entry closed; exceptions cannot relabel a required
  cell as `N/A`.
- The cohort binds exact commit, policy/profile/environment, parent release,
  bundle/content version, backend deployment, iOS/Android/PC Web builds,
  execution window, and verified raw artifacts.
- The one `launch-release-candidate.v1` cohort begins here: every
  release-applicable canonical-service and registered formal gate report is
  re-executed or otherwise proven eligible by its active type-specific semantic
  contract against this exact cohort. Earlier `CP-CS` scenario cohorts and
  checkpoint acceptance cannot be inherited or combined into the launch cohort.
- Receiver-owned production-like staging or production execution is available;
  personal development environments and repository simulations are ineligible.

### Exit

- Every required registered launch/runtime/operational/external-capability
  evidence type passes its semantic validator for the same release-candidate
  cohort.
- The release coverage-closure validator recomputes the complete required
  platform/state/forced-combination set from owner sources, verifies every
  parent scope and exact evidence pointer, validates every authority-backed
  `not_applicable_with_authority` result, and returns zero missing, blocked,
  partial, expired, unowned-N/A, or carried-gap cells.
- Outer reports and repository raw artifacts are tracked regular files whose
  size and SHA-256 are revalidated. Remote large evidence enters only through a
  repository manifest already verified by the evidence-archive gate.
- An unregistered or generic evidence type without type-specific measurement
  semantics fails closed even when its JSON shape, path, or hash is valid.
- Required load, availability, backup/restore, penetration, rollback,
  distribution/signing, payment, compliance, content, store, and deployment
  conditions pass without lowering the active policy threshold.
- Operator/verifier separation and protected product-owner approval pass.
- Leadership material describes the exact accepted product/build and retains
  every residual risk, non-claim, and rollback condition.

### May claim

- Release readiness and leadership readiness only for the exact formally
  accepted launch release candidate, full owner-required platform/state/forced
  combination scope, target release, evidence window, and distribution scope,
  with zero carried blocker or unresolved applicable gap.

### Must not claim

- A repository-local pass, simulation, path/hash-only artifact, PR text,
  browser/native subset, external capability observation, or self-attestation
  cannot satisfy or replace the formal launch gate.

## Non-promotable native evidence build

An optional native evidence carrier may be used only for feasibility work when
the product owner explicitly authorizes it. Its evidence class is
`native_feasibility_only`; it can never satisfy `CP-NFA` or `CP-RLR`.

### Preferred path

Wait for an accepted `CP-VA` artifact and implementation mapping, then collect
native evidence from the actual mapped candidate build. This avoids creating a
second, visually unauthoritative native product.

### Earlier feasibility path

If native feasibility must be tested before `CP-VA`, all conditions below are
required:

1. A separate design-only evidence-carrier artifact and exact scenario list are
   explicitly accepted for test use. The grayscale v5 proof is not that visual
   authority.
2. The build uses a separate scheme/flavor and non-production bundle/application
   identity, signing material, distribution channel, backend environment,
   analytics namespace, store sandbox, and test accounts.
3. Compile-time checks fail closed if production signing, production endpoints,
   production store identifiers, production content keys, or release channels
   are present.
4. Distribution is limited to the named internal device lab/test group and an
   explicit expiry. It is never uploaded to a production store channel or shared
   as a leadership/product build.
5. Test instrumentation, state selectors, logs, and reviewer controls remain
   outside the learner surface. The learner surface still obeys metadata-leak
   rules.
6. The evidence manifest records `gate_eligible=false` for `CP-NFA` and
   `CP-RLR`, exact source/build hashes, devices, service cohort, test accounts by
   non-secret reference, execution window, operator, verifier, and teardown.
7. Findings may change the architecture hypothesis or test plan, but no code,
   geometry, component, or interaction from the evidence build becomes product
   authority without the normal design, mapping, implementation, and review
   gates.

Store, private-audio, entitlement, and external-service observations from this
build remain sandbox/feasibility evidence. Final native acceptance must be
re-run on the exact mapped candidate build.

## Fail-closed and invalidation rules

1. Missing owner, evidence, exact pointer, manifest field, independent verifier,
   required state, or required device/environment keeps the checkpoint
   `blocked`.
2. A state may change from blocked only through evidence of the correct class.
   Browser/presentation evidence cannot fill canonical service, PC Web, native,
   or release cells.
3. Shared access-profile evidence cannot be copied into platform cells. Formal
   commerce and receiver-managed access never substitute for one another.
4. A local timer, in-memory adapter, source availability, unit test, simulator,
   or file existence never proves external acknowledgement, durability,
   production capability, or real-device behavior.
5. A source, state contract, accepted design, mapping, implementation, service
   deployment, content release, build, policy, target matrix, or evidence-window
   change invalidates the affected cohort unless an owner-defined semantic
   validator proves exact compatibility.
6. An expired exception or evidence window fails closed. Release evidence uses
   the active policy validity window and cannot borrow an earlier campaign.
7. Rejection or revocation at any layer invalidates dependent checkpoint
   acceptance; previously collected raw evidence remains historical only.
8. Product-owner acceptance is never inferred from author identity, PR body,
   commit message, reviewer text, or repository metadata.
9. `technically_passed` and `accepted` must name scope. Neither term may be used
   without the checkpoint ID, subject cohort, and remaining blockers.
10. Quality thresholds are never reduced to make a date or checkpoint pass; the
    schedule moves instead.
11. `CP-RLR` has no partial, carried-blocker, residual-gap, or scoped-subset
    promotion path. If any owner-required release target, device class, state,
    forced combination, capability, parent scope, or formal evidence type is not
    closed by eligible evidence or an exact owner-backed
    `not_applicable_with_authority` result, `CP-RLR` remains `blocked` and cannot
    claim release or leadership readiness.

## Current status under this proposal

- `CP-BA`: `partial_verified` for the exact strict-4 browser base plus the
  independently reviewed strict-5 Flip-focus delta only. The strict-5 delta
  corrects and replays the affected focus path; it does not silently migrate
  untouched strict-4 ledger cells into a new cohort.
- `CP-CS`: `blocked`.
- `CP-WEB`: `blocked`.
- `CP-VA`: `blocked` and not started under an accepted architecture decision.
- `CP-NFA`: `blocked`.
- `CP-RLR`: `blocked`.

These labels are descriptive proposal outputs, not accepted checkpoint records.
The active repository decision remains the v5 blocked status until an explicit
product-owner decision is recorded through the proper authority path.
