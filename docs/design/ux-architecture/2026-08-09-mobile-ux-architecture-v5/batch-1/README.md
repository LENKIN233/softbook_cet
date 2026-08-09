# Mobile UX Batch 1 registry preparation

## Scope and authority

This directory is a preparation-only schema for `CP-BA`, `CP-CS`, and
`CP-WEB`. It is not an execution manifest, evidence record, checkpoint
decision, design authority, implementation mapping, native result, or release
cohort.

The protected Batch 0 activation on commit
`ac7e124f0385cf100b74a6b24e44ad3b3dad1ec8` is retained only as the historical
preparation basis: workflow run `31322774545`, deployment `5820417644`, and the
aggregate `formal-approval` succeeded for those exact bytes. This Batch 1
change also changes the protected scope classifier, so that activation cannot
authorize the current bytes. A fresh exact-head protected decision must accept
the preparation bundle before any successor schema is proposed.

The authority chain used here is:

- `spec/requirement-memory.json`
- the semantic owners resolved by `spec/authority-map.json`
- `spec/product-core.json`, `spec/platform-contract.json`,
  `spec/account-sync-contract.json`, `spec/action-surface.json`,
  `spec/card-system.json`, `spec/interactions.json`,
  `spec/knowledge-map.json`, `spec/space-operations.json`,
  `spec/box-catalog.json`, `spec/membership.json`, and
  `spec/runtime-boundaries.json`
- the relevant `infra/cloudbase/*-runtime-contract.md` implementation
  boundaries
- `spec/visual-language.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md`
- `docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md`
- `spec/workspace-boundary.json`, `spec/harness-architecture.json`,
  `spec/agent-harness.json`, `spec/agent-run-record.json`,
  `spec/repo-delivery-contract.json`, `spec/evals.json`, and
  `spec/release-operational-policy.json`

The validator always emits `gate_effect=none`; every provisioning, execution,
collection, aggregation, promotion, visual, implementation, native-acceptance,
and release authority flag is fixed to `false`.

## Product truth preserved

- iOS, Android, representative tablets, and separately composed PC Web remain
  required targets.
- Learning remains one system-selected current CET4/6 card; navigation remains
  `学习 / 空间 / 统计 / 我的`.
- Flip, Four-choice, Lock, Elimination, and Swipe remain materially different;
  Flip alone uses `有把握 / 再回看`.
- Space remains `library → group → box → card`; favorite is a tag and
  sleep/wake is reversible.
- Authentication, completion, check-in, Space mutations, membership,
  purchase/restore, private content, and receiver-managed access remain
  canonical-service truths. Formal commerce and managed access never share a
  cohort.
- Learner UI may not expose reviewer, repository, runtime, environment, test,
  prompt, internal-key, or implementation language.

## Implementation hypothesis prepared

The common bundle and three isolated child registries define candidate
requirements and scenario identities without claiming that a resource exists,
that a person accepted a role, or that anything may be operated:

- `registry-set.v1.json` binds 43 exact source files, common unresolved
  target/environment/account/build/content/window/compatibility requirements,
  and exact hashes for the three child registries.
- `cp-ba.registry.v1.json` separates one four-target platform-browser scenario
  from formal-access and managed-access shared-browser scenarios. Shared proof
  cannot fill a platform cell. Phone landscape is explicit, and all 160 source
  states plus 13 forced combinations remain in the source universe.
- `cp-cs.registry.v1.json` defines 12 isolated canonical-service scenario
  lanes. iOS, Android, and Web formal commerce remain separate from
  receiver-managed access; each scenario binds its own target, environment,
  account, build, content, window, compatibility key, operator, verifier, and
  expected selector set.
- `cp-web.registry.v1.json` defines the exact 12 `PW-*` requirements already
  named by the PC Web mapping, including viewport, 200% zoom, keyboard, mouse,
  focus, reduced motion, screen reader, service, commerce, managed access, and
  audio.
- The three registries reserve 33 future scenario/aggregate manifest IDs and
  normalized paths. Those files must remain absent.

The 173 obligations are a bound source universe, not a claim that each state
has already been assigned to an exact execution lane. The exact CP-BA, CP-CS,
and CP-WEB state-to-lane partitions remain unresolved. Manifest shape,
resource assignments, role assignments, membership stage, intended origin,
and execution cohort are also unresolved implementation hypotheses.

Apart from the historical protected decision-owner provenance, no candidate
execution-role collaborator identity, workstation fingerprint, browser
version, device identifier, account identifier, secret, or other personal
inventory is stored in this bundle. Candidate availability discovered outside
the repository is not evidence and cannot become an assignment by being copied
into a registry.

## Current machine result

`node scripts/validate_mobile_ux_batch1_registry.mjs --json` reports:

- `artifact_valid=true`, with registry semantic digest
  `e53e55fe097c823d192c23219895abdc1092a60304d10150e7fdeadeff3a94ea`;
- 173 semantic obligations, 12 CP-CS scenarios, and 12 PC Web rows;
- 88 unresolved authority, partition, identity, resource, role, and window
  inputs;
- `current_authority_state=requires_new_exact_head_protected_preparation_decision`;
- `next_stage_readiness=blocked_unresolved_inputs`;
- `freeze_readiness=ineligible_preparation_schema` and
  `manifest_freeze_eligible=false`;
- `schema_transition_required=true`, `decision_status=not_evaluated`, and
  `gate_effect=none`;
- every execution and promotion authority fixed to `false`.

The 61-test adversarial suite rejects authority-bearing fields, raw evidence,
fake real-device or launch labels, placeholders, PII and credential-like
values, loose source/hash rebinding, matrix shrinkage, shared-to-platform
copying, profile blending, cohort-dimension swaps, missing `TOOL-05..11`
coverage, planned-path collisions and traversal, ancestor symlink escape,
premature manifest creation, resolved assignments, foreign origin URL labels,
index-only state, working-tree drift, and non-regular or non-HEAD targets.

## v2 schema-definition-only successor

The protected preparation decision for exact head
`8f4f82b35b660d9a775d6551e530fe6703c3ac54` succeeded through workflow
`31326457854`, environment `18348068326`, and deployment `5821110397` at
`2026-08-09T17:30:24Z`. Its scope permits this successor schema definition
only. It does not authorize a manifest freeze, provisioning, execution,
evidence, visual exploration, implementation, native acceptance, release, or
merge.

The five `*.v2.proposal.json` / catalog artifacts are deliberately
`schema_definition_only` and `candidate_incomplete`:

- each checkpoint has exactly 173 ordered records, for 519 records total;
  wildcard selectors are forbidden;
- CP-BA keeps the exact Tier-2 ID set blocked for owner decision, binds the
  proposed 91-state managed profile separately, and prevents shared access
  from receiving platform credit;
- CP-CS expands the original 12 selectors, adds isolated Statistics canonical
  read and account-lifecycle lanes, retains exactly 16 owner-backed
  checkpoint exclusions, gives cross-device rows three required iOS/Android/Web
  targets, and adds a separate 91-state managed-access overlay;
- CP-WEB gives every obligation a non-executing semantic-region mapping. All
  12 behavior/accessibility/service/commerce/managed/audio execution-row
  scopes remain explicit owner-value blockers; `COV-13` binds the 12-row
  matrix as an AND condition but cannot satisfy any row's unresolved scope;
- the catalog reserves 35 future manifest paths and defines 12 type-specific
  future contracts. Scenario contracts bind raw evidence, while aggregation
  contracts bind and revalidate exact child manifests without copying raw
  evidence. The entire `execution-manifests/` subtree remains absent;
- all 115 physical v1 unresolved objects are migrated one by one rather than
  hidden behind a unique-token count. Their 88 classification tokens retain
  exact repo-resolvable, machine-local privacy-safe, external resource, human
  confirmation, and protected-decision history. The exact `8f4f82b` decision
  resolves only the historical preparation requirement; a separate current
  requirement registry includes every newly introduced v2 blocker and keeps
  all 145 typed values pending while keeping freeze/downstream authority
  false;
- privacy contracts prohibit credentials, private keys, temporary private
  URLs, raw phone/email/account identity, device serial/UDID/Android ID/MAC/
  hostname/home-path identifiers, and hashes directly derived from device
  identifiers. Physical-device requirements split the future random system
  slot from the independently bound build reference.
- Every checkpoint lane binds resolvable target/profile/provider,
  environment/account/build/content, role, execution-window, and compatibility
  requirements. External resources use subtype-specific contracts rather than
  one generic environment object, and the 16 CP-CS exclusions each bind an
  exact owner source/hash plus an obligation-specific rationale. Every
  repository document used as semantic support, including all 28 CP-CS domain
  anchors, is bound to an exact path, locator, and raw SHA-256; tracked mode
  additionally requires a regular `100644` HEAD blob whose worktree bytes still
  match HEAD.

`node scripts/validate_mobile_ux_batch1_freeze_candidate.mjs --json` validates
the proposal but must continue to report `candidate_incomplete`,
`freeze_readiness=blocked_candidate_incomplete`,
`manifest_freeze_eligible=false`, `decision_status=not_evaluated`, and every
authority flag as `false`. Its domain-separated subject digest and the three
reviewed partition digests protect the exact mappings; they do not prove that
any external resource or human assignment exists.

## Required successor transition: R0 → D1 → B2 → F3

The current exact v2 candidate does not execute this transition. All 145 current
requirements remain `typed_value_pending`, every authority flag remains false,
and the `execution-manifests/` path itself must remain absent.

1. **R0 — resolution successor.** The future materializer must produce different exact bytes that resolve
   exactly 136 requirements while leaving only these nine values pending:
   `build-cp-ba-browser-documents`, the three checkpoint execution windows, and
   the five compatibility keys. R0 has `gate_effect=none`, grants no authority,
   and cannot create a manifest. The resolved-record schema and R0/B2
   materialization validator are currently `not_implemented`, so this contract
   describes the required target but does not authorize producing R0 today.
2. **D1 — protected cohort designation.** Bind a protected decision to the
   pre-existing exact R0 commit and digest. D1 only designates the cohort. Its
   `gate_effect` is `none`; it does not authorize manifest creation or
   reservation activation, provisioning, execution, evidence collection,
   data-manifest population, aggregation, promotion, architecture acceptance, checkpoint coverage/pass,
   visual authority, implementation, native acceptance, release, leadership
   readiness, or final manifest freeze. The decision's exact non-claims repeat
   that full list, and its sole next action is to produce the B2
   designation-bound successor. `designated_cohort_sha256` is not an
   owner-supplied nonce: it is recomputed with the fixed
   `softbook-cet/mobile-ux-batch1-designated-cohort/v1` domain over the exact
   ordered JCS tuple of D1 subject commit, subject digest domain, subject digest,
   and syntax-constrained opaque cohort ID. That regex is only a syntax check,
   not proof of privacy; the protected non-PII classification attestation and
   validator are still `not_implemented`, so D1 use remains blocked.
3. **B2 — post-designation binding successor.** After D1, bind only the nine
   deferred requirements and their mechanically derived summaries. The other
   136 requirement values are immutable; any drift requires a new D1. The
   CP-BA build value is a designation-bound source-closure build: it binds the
   D1 commit, digest domain/digest, designated cohort ID/SHA-256, approval
   instance, exact `100644` source records, source-closure digest, recipe ID and
   raw digest, toolchain-lock digest, output role, and exact build artifact
   path/mode/length/raw SHA-256. The future recipe contract requires complete
   source enumeration and forbids undeclared reads, network, ambient
   environment, wall-clock, and unseeded-random input. It also requires recipe
   and lock membership in the source closure, excludes the output from that
   closure, and starts with no pre-existing output. However, a content-addressed
   builder/runtime identity, OS/architecture/tool versions, locale/timezone,
   and archive-metadata normalization profile are not implemented. Therefore
   this proposal makes no current hermetic or cross-environment reproducibility
   claim. Both the recipe and those builder controls are materializer blockers,
   so B2 remains blocked.

   Each execution window has an exact nine-field UTC-second projection and a
   canonical protected-schedule-event digest. Repository bytes retain only a
   campaign-scoped HMAC principal pseudonym from verified human-role
   confirmation; the real immutable identity and pseudonym mapping remain off
   repository. The protected schedule event must still match exactly, remain
   unrevoked/unexpired, and satisfy issued/decision/start/end/expiry ordering.

   The binding-bundle SHA-256 uses the fixed
   `softbook-cet/mobile-ux-batch1-binding-bundle/v1` domain and an exact ordered
   JCS tuple input. It covers the D1 commit, digest domain/digest, designated
   cohort ID/SHA-256, D1 approval instance, exact CP-BA build, and three exact
   windows while excluding its own digest, every compatibility output, and all
   F3 material. Each of the five compatibility requirements then uses its own
   fixed versioned domain and exact ordered input tuple: designation commit,
   designation digest domain/digest, binding-bundle digest, and requirement ID.
   The result is a lowercase 64-hex SHA-256 value; arbitrary receiver/owner
   keys, synthetic keys, output self-input, missing/reordered inputs, and cached
   values without recomputation are forbidden. A sixth distinct domain derives
   the single CP-BA map from its exact three ordered component outputs. Any
   subject, input, component, algorithm, version, domain, or order drift must
   be recomputed and revalidated. The CP-BA map is a single persisted
   `cp_ba_compatibility_map_digest` in the exact-key B2 binding metadata, not an
   unconsumed prose value; F3 freezes that exact metadata. B2 reaches 145
   resolved / 0 pending in different exact bytes but is still not
   freeze-eligible and still cannot create a manifest.
4. **F3 — final manifest-freeze decision.** Independently review the
   pre-existing exact B2 commit and digest. The F3 approval event must remain
   outside the candidate bytes, so no current or future requirement value may
   self-reference that final decision. Even a valid F3 has the maximum effect
   `batch1_exact_manifest_freeze_and_reservation_activation_only`: it may freeze
   the exact subject, while the verified post-event F3 receipt/gate effect—not
   the frozen catalog—records that the 35 exact reservations are eligible for
   later separately authorized consideration. All five frozen subject artifacts
   remain immutable; catalog mutation is forbidden and any subject drift
   invalidates F3. It does not create the manifest root, files, or instances;
   the root remains absent and the instance count remains zero. It grants no manifest creation, provisioning,
   data-manifest population, execution, evidence collection,
   aggregation, promotion, architecture/checkpoint/visual authority,
   implementation, native acceptance, release, or leadership readiness.
   Manifest creation and population/execution require separate later authority,
   and evidence collection requires separate evidence authority.

All protected decision masks use an exact 16-key authority vocabulary,
including independent `manifest_creation` and `data_manifest_population`
bits. Legacy ten-key current objects resolve the six missing keys explicitly to
`false`. R0, D1, B2, and current/global authority resolve all 16 keys to false;
F3 may set only `freeze` and `reservation_activation`, leaving the other 14
false. Non-claim prose supplements this mask and never substitutes for it.

The protected decision authority path is not implemented today: the current
workflow/classifier reports only a sensitive boolean and cannot distinguish
`schema_definition`, `cohort_designation`, and `manifest_freeze`. Before D1, a
trusted-base validator must enforce the decision class and executable field
types, recompute the exact five-artifact subject, permit one decision class per
approval event, fail closed on a mixed exact-head change set, and verify
distinct D1/F3 heads, subject digests, workflow runs, deployments, approvals,
and authority events.

D1 and F3 each use a preapproval intent and a postapproval receipt. The exact
`100644` non-symlink intent must already be tracked in the approval target head
and may not contain run, deployment, approval, reviewer, decision-time, event,
or receipt-digest fields. The receipt must be absent from that head and from the
same approval subject; only a later descendant commit may materialize it after
the external success event is verified. The receipt binds the intent path and
raw SHA-256, so an approval receipt cannot approve itself.

The receipt's repository is fixed to canonical `LENKIN233/softbook_cet`; HTTPS
or SSH root origins must normalize to `github.com/LENKIN233/softbook_cet`, and
a fork PR/event cannot substitute. Repository, PR, approval target head,
workflow path, trusted base,
run/attempt/conclusion, deployment/state, environment ID/name, approval/state,
event reference, reviewer, and decision time must equal one verified remote
GitHub event chain. The run head equals the approval target head; that head
belongs to the exact repository/PR. `trusted_base_sha` equals that event's
verified `pull_request.base.sha`; the remote chain confirms the base ref was
protected `refs/heads/main`, and the approval target descends from it. Workflow,
classifier, and validator bytes are loaded from those exact base blobs and
their raw digests must match; neither intent nor receipt may self-supply this
trust anchor. A fixed-domain JCS projection, not provider JSON byte order,
derives `authority_event_sha256`.
The approval-instance digest then covers the exact ordered generic projection
plus the exact decision-class-specific projection. D1's projection includes
the canonical cohort ID and recomputed cohort SHA-256.

A child binds the exact staged-parent tuple, including parent approval head,
receipt materialization commit, decision path/raw digest, receipt path/raw
digest, subject domain/digest, run/attempt, deployment, environment, reviewer,
decision time, and recomputed approval-instance digest. Both parent commits
must be ancestors; parent decision/receipt bytes and subject remain unchanged;
all fields and digests recompute. An opaque parent digest is insufficient.

Receipt use is additionally fail closed. The authority owner has not yet
provided the protected per-class maximum-validity and exact invalidation-policy
artifact, and the condition evaluator registry is also `not_implemented`.
Unknown or unimplemented condition IDs fail closed, expiry may never exceed the
owner policy's maximum, and every invalidation condition must be false at use
time. Consequently, D1 and F3 receipt use is currently forbidden rather than
defaulting to an invented TTL.

The historical `8f4f82b` preparation approval had no preapproval intent. The
proposal therefore does not fabricate one or claim a receipt exists. A future
one-time migration requires its own protected authorization and a second event
chain distinct from the historical approval chain; the preparation receipt is
currently `missing`, migration is `not_implemented`, and materialization is
unauthorized. PR separation remains owner-selectable between distinct PRs and
a trusted staged same-PR flow, but that staged flow is also `not_implemented`.

The current preparation approval, any schema-definition approval, and D1 itself
cannot substitute for F3; the current preparation or schema approval also
cannot substitute for D1.

Accordingly, the validator reports four stages, nine post-designation
requirements, `decision_instance_count=0`, `approval_receipt_count=0`,
`preparation_approval_receipt_status=missing`, and
`trusted_staged_same_pr_path_status=not_implemented`. The only allowed current
next action is
`implement_trusted_governance_and_R0_B2_materialization_validators_obtain_protected_validity_policy_and_legacy_receipt_migration_approval`;
the current candidate may not skip ahead to D1, B2, F3, manifest creation, or
execution.

## Machine-checked closure

The reviewed schema-definition candidate is pinned to:

- registry-set raw SHA-256
  `58966c8df9e9f5a5a7f6711a048317b78a2300d3a003e1dd6bdd238c0e928c03`;
- five-artifact subject digest
  `df8d1bb25b4a38b1c23c84fe8ffddc7c4b9013ce4228b6c975dfb3bcb2256793`;
- successor-transition digest
  `c8e697352ec66e58fd48c4f8432c87ba97c869a29a0c45bfa812e5e179c58504`;
- current 145-requirement inventory digest
  `c73e4fa89967298bc01dbdb4476028e462f5d57ab64705c1fcc88d99c4a96dac`;
- reference-contract digest
  `357e6aadaf6c474c4eb0fe89847d3b952604401a3bd95f58e12ef3ca6ee862cb`;
- unresolved-migration digest
  `e35033e32eee9d6042e5a52b110529b430a1c90be35691909d2e5a9418612d94`.

The validator result explicitly surfaces all 16 canonical authority dimensions;
the six dimensions absent from legacy current objects are exported as
`reservation_activation_authorized=false`, `manifest_creation_authorized=false`,
`data_manifest_population_authorized=false`,
`architecture_acceptance_authorized=false`,
`checkpoint_coverage_authorized=false`, and
`leadership_readiness_authorized=false`. Its non-JSON CLI output derives the
same complete 16-dimension non-claim directly from the canonical key list.

With Node `v22.13.0`, the freeze-candidate suite passes `231/231` and the
combined manifest-contract plus freeze-candidate suite passes `259/259`.
Syntax checks for the shared contract, freeze validator, its test, and the
execution-manifest validator also pass, as does `git diff --check`. The current
registry remains exactly `145/145` pending with no positive authority; all
future decision intents/receipts and the complete `execution-manifests/`
subtree remain absent. Eleven exact global blockers remain, including the
trusted decision bootstrap, R0/B2 materializer, protected validity policy and
evaluator, legacy receipt migration authorization, cohort designation,
post-designation bindings, final freeze, and absent execution-manifest root.

`CP-BA` retains only its separately bound historical browser subset;
`CP-CS`, `CP-WEB`, `CP-VA`, `CP-NFA`, and `CP-RLR` remain blocked. The final
goal is still a mature, explicitly accepted CET4/6 product genuinely usable on
iOS, Android, representative tablets, and PC Web—not a registry, grayscale
proof, or green CI report.
