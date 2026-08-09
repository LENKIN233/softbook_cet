# Agent Run Record: Mobile UX Batch 1 v2 schema definition

## Task summary

- Date: 2026-08-10
- Branch: `cross/mobile-ux-architecture-v5`
- PR: draft `#484`, targeting `main`
- Summary: after the exact `8f4f82b35b660d9a775d6551e530fe6703c3ac54`
  preparation-only decision succeeded, define and validate a separate v2
  successor proposal for `CP-BA`, `CP-CS`, and `CP-WEB`. A late independent
  review then found that the original successor instructions were circular;
  this run now also defines a fail-closed `R0 → D1 → B2 → F3` transition
  contract without performing any of those future stages.
- Authority boundary: this run defines schemas and explicit blockers only. It
  does not freeze a manifest, provision an account/device/environment, create
  an execution manifest, collect evidence, accept architecture or visuals,
  modify product UI/runtime, establish native behavior, release, merge, or
  leadership readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md`

## Product truth used

- Required targets remain iOS, Android, representative tablets, and separately
  composed PC Web.
- Learning remains a system-sequenced single-current-card CET4/6 flow with the
  five distinct interaction families and exact two-state Flip semantics.
- Space remains `library → group → box → card`; favorite is a tag and
  sleep/wake reversibly changes Learning eligibility.
- Authentication, completion, check-in, mutation, membership, purchase,
  restore, private content, and managed-access truth remain canonical-service
  concerns. A schema, client, provider response, or shared profile cannot grant
  canonical success by itself.
- Formal commerce and receiver-managed access remain separate subjects.
- Learner UI must not expose reviewer, repository, runtime, test, prompt,
  environment, predicate, internal-key, or implementation language.

## Implementation hypothesis changed

- Added three explicit 173-record partition proposals, 519 records total, with
  no wildcard selectors and no pre-execution coverage credit.
- Kept CP-BA's owner-selected exact Tier-2 set blocked; a 91-state shared
  managed-access proposal remains additional and can never fill a platform
  target.
- Added CP-CS Statistics canonical-read and account-lifecycle lanes, exact
  owner-backed exclusions for 16 non-CP-CS obligations, three-target AND
  bindings for cross-device rows, and a separate 91-state managed-access
  overlay. Membership-stage and intended-origin values remain explicit
  owner-value blockers rather than inferred profile aliases.
- Added a non-executing 173-state PC Web semantic-region mapping. The 12
  behavior/accessibility/service/commerce/managed/audio execution-row scopes
  remain explicit owner-value blockers rather than guessed ID arrays;
  `COV-13` alone requires the 12-row matrix as an AND condition and cannot fill
  any row's unresolved scope.
- Reserved 35 future manifest paths and defined 12 type-specific future
  manifest contracts. No manifest instance or reserved subtree was created.
- Migrated every one of the 115 physical v1 unresolved objects, preserving the
  88 unique classification tokens and exact category counts. The exact
  preparation-only authority resolves only the historical preparation
  requirement; it grants no freeze authority. A separate current-requirement
  registry covers 145 newly introduced v2 blockers, keeps every value pending,
  and gives every lane a typed, resolvable resource/role/window/compatibility
  binding. Privacy-safe machine, external-resource subtypes, human, and
  protected-authority contracts store no real identities or secrets.
- Split future scenario and aggregation contracts: scenarios bind raw evidence;
  aggregations bind exact child paths/hashes and recompute child eligibility,
  compatibility, expiry, coverage, and result without copying raw evidence.
  Added domain-separated subject and partition digests, raw child/catalog
  bindings, a static fail-closed validator, an always-blocked pre-freeze
  execution-manifest validator, adversarial tests, formal-scope protection,
  CI, and Harness integration.
- Replaced the circular "resolve build/compatibility, then freeze" instruction
  with four distinct future subjects: `R0` resolves exactly 136 requirements
  and leaves nine designation-dependent values pending; `D1` externally
  designates that pre-existing cohort with zero downstream authority; `B2`
  changes only those nine values and derived summaries; `F3` may authorize only
  the exact manifest freeze and reservation activation. Activation is an
  eligibility marker in the post-event receipt; it leaves the frozen five files
  and manifest root unchanged. Manifest creation or population, provisioning,
  execution, evidence, aggregation, promotion, architecture,
  visual, implementation, native, release, and leadership authority all remain
  separate and false.
- Added deterministic SHA-256/RFC 8785 compatibility derivation over a
  designation-bound source closure, five per-output identities, and one CP-BA
  compatibility map. The canonical inputs include the digest domain, cohort
  identity and digest, exact build closure, and three execution windows; any
  input drift requires recomputation.
- Defined future D1/F3 pre-approval decision-intent and post-event receipt
  contracts with fixed paths and modes, exact key sets, class-specific canonical
  projections, domain-separated approval-instance digests, full parent tuples,
  ancestor and unchanged-parent requirements, one active decision class per
  event, expiry, and 16-key maximum authority masks. The external chain is bound
  to the canonical `LENKIN233/softbook_cet` repository, its verified protected
  `main` PR base, and workflow/validator bytes loaded from that exact base. The
  existing protected workflow cannot authenticate those semantics, so bootstrap
  is explicitly `not_implemented`, all decision-intent and receipt counts are
  zero, and the preparation receipt is explicitly missing.
- The historical `8f4f82b` approval had no pre-approval Batch 1 intent. Its
  future receipt is therefore a blocked one-time migration that must bind both
  the old schema approval and a new protected migration-authorization event;
  this run neither invents the missing intent nor authorizes materialization.
- Decision-validity owner policy, privacy classification for cohort labels, and
  the R0/B2 materialization validator remain explicitly unimplemented. Build
  source/recipe bindings and canonical window values are defined, but cross-OS
  reproducibility and privacy cannot be inferred from syntax; both remain
  materializer prerequisites rather than passed claims.

## Workspace boundary and read scope

- Read active product, runtime-boundary, design-checkpoint, release-governance,
  delivery, Harness, and PR/protected-workflow metadata needed for this task.
- Did not use generated/dependency/cache/archive material as product truth.
- Did not retain collaborator names, phone/email/account identifiers, device
  serials, workstation/browser fingerprints, credentials, keys, cookies,
  tokens, or private URLs as candidate assignments.
- Did not read or modify the sibling `/Users/lenkin/programing/card make`
  content workspace.

## Files changed

- `.github/workflows/pr-gates.yml`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/README.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/README.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v2.proposal.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-ba.registry.v2.proposal.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-cs.registry.v2.proposal.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-web.registry.v2.proposal.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/manifest-schema-catalog.v1.json`
- `scripts/lib/mobile_ux_batch1_manifest_contract.mjs`
- `scripts/validate_mobile_ux_batch1_freeze_candidate.mjs`
- `scripts/test_validate_mobile_ux_batch1_freeze_candidate.mjs`
- `scripts/validate_mobile_ux_batch1_execution_manifest.mjs`
- `scripts/test_mobile_ux_batch1_manifest_contract.mjs`
- `scripts/classify_formal_approval_scope.mjs`
- `scripts/test_classify_formal_approval_scope.mjs`
- `scripts/harness_validator/context.py`
- `scripts/harness_validator/sections/delivery_runtime.py`
- `scripts/harness_validator/sections/governance_contracts.py`
- `scripts/harness_validator/sections/product_contract_mirrors.py`
- `scripts/test_harness_module_boundaries.py`
- `docs/agent-runs/2026-08-10-mobile-ux-batch1-v2-schema-definition.md`

## Commands run

- `node scripts/validate_mobile_ux_batch1_registry.mjs --require-tracked --json`
  preserved the exact v1 preparation result and all false authority flags.
- `jq -e .`, SHA-256, count, exact-ID, cross-device-target, migration-category,
  manifest-path-absence, and privacy-boundary checks were run while assembling
  the v2 proposal.
- `node --test scripts/test_mobile_ux_batch1_manifest_contract.mjs
  scripts/test_validate_mobile_ux_batch1_freeze_candidate.mjs` passed
  `259/259` (`28` manifest-contract plus `231` freeze-candidate tests),
  including transition-cycle, compatibility-canonicalization,
  decision/receipt digest, parent-chain, single-active-class, and maximum-
  authority attacks.
- The exported v2 validator API passed against the real repository with
  `requireTracked=false` and reviewed-digest enforcement. That pre-commit mode
  is fixture-only and is not counted as tracked or gate evidence.
- All five new JavaScript files passed individual `node --check` runs;
  `node --test scripts/test_classify_formal_approval_scope.mjs` passed `44/44`;
  `python3 scripts/test_harness_module_boundaries.py` passed `19/19`; and
  `git diff --check` passed.
- The exported validator passed against the real root with reviewed-digest
  enforcement; its tracked-mode positive path is also covered by temporary-
  repository commit tests. The real-root tracked run, complete Harness, remote
  approval, and required checks must be repeated on the final clean commit.

## Validation results

- Exact v1 preparation authority: workflow `31326457854`, environment
  `18348068326`, deployment `5821110397`, reviewer
  `github:LENKIN233#113219944`, success at `2026-08-09T17:30:24Z`, exact head
  `8f4f82b35b660d9a775d6551e530fe6703c3ac54`.
- Scope: successor structural schema definition only; no freeze or downstream
  authority was granted.
- The exact `8f4f82b` PR-gates run `31326458771` completed successfully at
  `2026-08-09T18:09:48Z`: iOS Release, Android Release, mobile, Web, backend,
  Harness, design-artifact, agent-review, dependency, repository-health, and
  evidence-archive checks all passed. Those results close the preparation
  checkpoint only and do not establish any product, visual, native, or release
  acceptance.
- The later schema-definition-only approval for exact head
  `1b032e98f783c0f31c2dc9dbc97473b87caf92d1` used workflow run
  `31331114616`, environment `18348068326`, deployment `5821976647`, and
  succeeded at `2026-08-09T19:18:57Z`. PR-gates run `31331115671` completed at
  `2026-08-09T19:56:17Z`; all 12 strict `main` required contexts, including iOS
  and Android release checks, were successful. These results are a superseded
  baseline: the transition defect was found afterwards, and none of these
  events can approve the corrected exact bytes or act as D1/F3 authority.
- Final five-artifact subject digest:
  `df8d1bb25b4a38b1c23c84fe8ffddc7c4b9013ce4228b6c975dfb3bcb2256793`.
  Raw SHA-256 values are root `58966c8df9e9f5a5a7f6711a048317b78a2300d3a003e1dd6bdd238c0e928c03`,
  CP-BA `247ff9d3de23e31f3e37e35e9a53fd0fe1edc24bc2d93ca4468a5a2571338491`,
  CP-CS `8819358f978a1c573067d468531744b2fd900864d3317542e741bffae2f2bdfa`,
  CP-WEB `cc0b4aa3f73b36318d00e28f1514115f10dec78fd21c8948f1c3030d2699da60`,
  and catalog `814088a2b709e0d31a5a1d96d3bc29e17dc47849fdcd44f1785162d452ac5b1b`.
- Independent canonical partition digests are CP-BA `42fdc33b292e...`, CP-CS
  `8584126140ef...`, and CP-WEB `be423c7983e5...`. Current requirements remain
  `145/145` pending with digest `c73e4fa89967...`; historical migration remains
  `115/1/114` with digest `e35033e32eee...`; reference contracts remain
  `357e6aadaf6c...`. The successor transition digest is
  `c8e697352ec66e58fd48c4f8432c87ba97c869a29a0c45bfa812e5e179c58504`.
- Catalog validation fixes exactly 35 reservations, 12 type definitions, 14
  CP-CS domain contracts, and 28 exact domain source anchors across 12 source
  files. The type, reservation, and domain digests are respectively
  `a8baeb8ffa62...`, `fda8c728ee40...`, and `837fd738a074...`.
- The corrected adversarial suites passed `259/259`, classifier tests passed
  `44/44`, Harness boundary tests passed `19/19`, and all five scripts passed
  syntax checks.
- Signed schema commit `f40dbfb85e347684f021a1e8e8eb8500e0b7e67d` passed
  `node scripts/validate_mobile_ux_batch1_freeze_candidate.mjs
  --require-tracked --json`; every candidate and semantic source resolved to a
  regular `100644` HEAD blob with clean worktree bytes. The tracked output
  retained the earlier exact `f08c84f8...` subject and every false authority
  flag. It is now a superseded baseline rather than validation of the corrected
  transition bytes.
- On the same clean commit, `python3 scripts/validate_harness.py
  --skip-remote-guard` passed all 15 selected sections as the expected local
  partial result; the PR-profile runner's full Harness then passed all 15
  sections with `complete=true` and `remote_guard_executed=true`.
  `scripts/test_validate_harness_runner.py` also passed `21/21`.
- The first PR-profile local-gate attempt completed 30 passed gates, one
  dependency exception already allowed by repository policy, two deferred
  review gates, and three environment/context failures. The failures were:
  shell selection used Node `25.9.0` and Ruby `2.6.10` instead of the installed
  Node `22.13.0` / Ruby `3.3.12`; PR `#484` still pointed at the previous remote
  head because this commit had not been pushed; and strict repository health
  observed the shared developer clone's four worktrees and 30 topic branches.
  Mobile lint/typecheck/Jest, backend `206/206`, design/metadata scanners,
  dependency/evidence checks, Git LFS, and both Harness modes passed. No other
  worktree or branch was removed to manufacture a local health pass.
- A corrected-toolchain PR-profile rerun on the superseded `1b032e98` baseline
  produced `34/36` gates with the repository policy exception allowed; the sole
  strict failure was repository health observing the shared clone's four
  worktrees and 30 topic branches. Report:
  `exports/local-gates/20260809T191526Z-1b032e98-pr-31667/report.json`. No user
  worktree or branch was removed to manufacture a local pass.
- For the corrected candidate, the validator reports four future stages, nine
  designation-dependent requirements, bootstrap `not_implemented`, zero
  decision intents, zero approval receipts, missing preparation receipt, and
  same-PR staged validation `not_implemented`. It validates 151 current 16-key
  authority masks as all false, exports every one of those 16 dimensions as an
  explicit non-authorized result, and preserves 11 explicit global blockers.
  The only allowed next action is
  `implement_trusted_governance_and_R0_B2_materialization_validators_obtain_protected_validity_policy_and_legacy_receipt_migration_approval`.
  Exact new-head protected approval and all 12 remote required checks remain
  pending until the final commit and push.

## Agent review status

- Initial semantic review: failed closed with P0 `0`, seven P1 classes, and one
  P2. It found guessed/cross-profile PC Web row scopes, missing lane cohort
  bindings and current blocker inventory, non-fillable typed references,
  aggregation/raw-evidence leakage, generic manifest discriminators, and
  non-exact CP-CS exclusions. None was waived; all are being corrected before
  the final exact-byte review.
- Subsequent fail-closed review found 24 stale migration JSON pointers, four
  non-resolving runtime-document headings, four remaining guessed PC Web
  specialist-row minima, weak current-requirement and aggregate
  self-consistency checks, and an unprotected transitive parser dependency.
  None was waived.
- Corrected five-artifact JSON semantic review: passed with P0 `0`, P1 `0`,
  and P2 `0`. It independently resolved all 718 internal references, verified
  145/145 current requirements have lane consumers, checked all 115 historical
  migration instances, 16 exact CP-CS exclusions, 35 reservations, 12 type
  contracts, 14 CP-CS domain contracts, 155 false authority objects, and the
  absent execution-manifest subtree. This verdict covers only the JSON bytes;
  validator and test closure remains separate.
- The first exact-code adversarial pass then found one P1: the 14 CP-CS domain
  contracts fixed paths/headings but did not bind supporting source bytes.
  The validator was generalized rather than patched locally: every repository
  semantic source now has exact path/locator/raw SHA-256 binding, and tracked
  mode requires a regular `100644` HEAD blob whose worktree bytes equal HEAD.
  New tests reject dirty, index-only, executable, symlink, and untracked
  exact-byte replacement across v1, exclusion, domain, and ledger sources.
- A later exact pass found one P2: an empty `execution-manifests/` directory was
  accepted despite the catalog claiming the subtree was absent. The helper now
  rejects an existing empty directory, file, normal symlink, and dangling
  symlink; only a genuinely absent root passes.
- Baseline pre-commit exact review: P0 `0`, P1 `0`, P2 `0`; independent recounts
  matched 519 obligations, 796 bindings, 31 lanes, three aggregate unions,
  `145/145`, `115/1/114`, `35/12/14/28`, all 12 COV-13-only PC Web row digests,
  and every false authority flag. This is a technical schema verdict only; it
  grants no freeze, evidence, architecture, visual, native, release, or merge
  authority.
- A later successor-transition review found a real P1 circularity: the proposed
  build and five compatibility values depended on a future designation/freeze,
  while that freeze required those values to be complete. The first repair was
  rejected, not waived. Exact review reported P0 `0`, P1 `3` (arbitrary
  compatibility values, incomplete D1 non-claims, and unbounded F3 authority).
  Authority review independently reported P0 `0`, P1 `3`, P2 `2` (declarative
  rather than executable decision schemas, opaque parent linkage, unbounded F3,
  insufficient instance/ancestry attacks, and a misleading next action).
- The final repair closes those findings with the deterministic binding bundle,
  intent/receipt lifecycle, full staged parent tuple, canonical protected-base
  event chain, complete D1 zero-authority mask, F3 freeze-and-reservation-only
  ceiling, and bootstrap-first stop boundary. Final independent exact review:
  P0 `0`, P1 `0`, P2 `0`; it recomputed all six final digests and the exact
  `519 + 31 + 145 = 695` records, verified 11 blockers, 259/259 tests, all 16
  exported authority dimensions false, Harness pins, and documentation truth.
  Final independent authority/transition review: P0 `0`, P1 `0`, P2 `0`; it
  verified canonical repository/protected-base provenance, the external event
  chain, fail-closed legacy migration, validity/materializer blockers, D1/F3
  masks and non-claims, and receipt-only reservation activation without
  manifest creation or frozen-subject mutation.
- Self-review findings already corrected before exact review: unique-token
  counts were expanded to all 115 physical instances; exact mapping digests
  replaced count-only validation; cross-device rows require iOS, Android, and
  Web; membership/origin remain owner-value blockers; the 12 manifest types
  gained type-specific rather than generic contracts.
- Passing review will remain technical and exact-scope only. It cannot accept
  the future candidate or product checkpoints.

## Binary evidence

- Evidence manifest: N/A; evidence collection is forbidden in this phase.
- Archive: N/A.

## User-visible UI impact

- None. No learner screen, style, color, copy, navigation, interaction,
  animation, application source, or runtime behavior changed.

## Card make external workspace impact

- None. No card content was produced, approved, imported, or counted.

## Risks and open questions

- The exact CP-BA Tier-2 ID set still requires owner selection.
- All 12 PC Web execution-row exact state scopes require owner selection; the
  semantic-region mapping and `COV-13` matrix relation do not resolve them.
- Membership-stage and intended-origin values, privacy-safe slots, real
  environments/accounts/builds/content, human role confirmations, schedules,
  and compatibility keys remain unresolved.
- The 145 current blockers classify as 24 strictly repository-semantic values,
  two Tier-2 labels still tied to owner choice, 41 other protected owner
  choices, 16 operator/evidence-owner assignments, 17 independent reviewer or
  verifier assignments, three execution windows, 36 real/external resources,
  one future protected BA build, and five derived compatibility outputs.
- The trusted governance bootstrap and a materialized preparation approval
  receipt do not yet exist. The current sensitive-boolean workflow cannot
  authenticate D1/F3 decision class, exact subject, canonical approval digest,
  or parent chain; therefore R0/D1/B2/F3 execution remains blocked.
- A future complete candidate needs independent exact review and a distinct
  exact protected manifest-freeze event. This preparation/schema decision
  cannot be reused. Even F3 may only freeze and activate reservations; manifest
  creation, population, execution, and evidence still need separate authority.
- `CP-CS`, `CP-WEB`, `CP-VA`, `CP-NFA`, and `CP-RLR` remain blocked; the mature
  iOS/Android/tablet/PC-Web product remains the final goal.

## Follow-up

1. Complete independent exact/authority review, commit this corrected schema
   and run record, push the exact descendant head, rerun the clean tracked
   validator/Harness, and wait for the new schema-definition-only protected
   approval plus all 12 required checks.
2. In a separate governed change, implement the trusted decision-class,
   exact-subject, approval-instance-digest, parent-chain, and R0/B2
   materialization validators; obtain the protected validity/privacy policy and
   a separate legacy-receipt migration approval. Only then may the historical
   preparation receipt be materialized from both verified event chains. Do not
   proceed to R0 or D1 before those controls are approved and loaded from the
   exact protected PR base.
3. Produce R0 by resolving the 136 pre-designation inputs, then obtain a
   distinct D1 cohort-designation event; produce B2 by changing only the nine
   designation-bound requirements and derived summaries.
4. Submit the complete B2 exact subject to a distinct F3 manifest-freeze event.
   Even after F3, manifest creation/population, provision, execution, evidence,
   architecture, visual, native, release, and leadership readiness remain
   separately gated.
