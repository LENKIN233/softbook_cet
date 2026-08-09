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

## Required next transition

1. Independently review the exact v2 schema-definition bytes and keep their
   partition digests frozen.
2. Resolve the explicit owner-value, human-role, privacy-safe system-slot,
   external environment/account/build/content, schedule, and compatibility-key
   blockers without creating manifests or collecting checkpoint evidence.
3. Submit a complete, different exact candidate to a future protected manifest
   freeze decision. The current preparation decision cannot satisfy that gate.
4. Only when that later decision explicitly authorizes the relevant action may
   isolated manifest instances be created or evidence collection begin.

`CP-BA` retains only its separately bound historical browser subset;
`CP-CS`, `CP-WEB`, `CP-VA`, `CP-NFA`, and `CP-RLR` remain blocked. The final
goal is still a mature, explicitly accepted CET4/6 product genuinely usable on
iOS, Android, representative tablets, and PC Web—not a registry, grayscale
proof, or green CI report.
