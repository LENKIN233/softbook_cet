# Agent Run Record: Mobile UX Batch 1 registry preparation

## Task summary

- Date: 2026-08-10
- Branch: `cross/mobile-ux-architecture-v5`
- PR: draft `#484`, targeting `main`
- Summary: verified the historical protected Batch 0 activation on exact head
  `ac7e124f0385cf100b74a6b24e44ad3b3dad1ec8`, then prepared a structurally
  validated and execution-ineligible registry bundle for `CP-BA`, `CP-CS`, and
  `CP-WEB`.
- Authority boundary: Batch 0 is only the preparation basis. This change also
  changes the protected classifier, so current bytes require a new exact-head
  protected preparation decision. No manifest freeze, provisioning, evidence
  collection, visual exploration, product UI implementation, native
  acceptance, release action, or merge was performed.

## Referenced specs

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
- Learning remains a system-sequenced single-current-card CET4/6 flow; the top
  navigation order and five interaction-family meanings remain unchanged.
- Space remains `library → group → box → card`; favorite and reversible
  sleep/wake retain their existing semantics.
- Canonical authentication, completion, check-in, mutation, membership,
  purchase/restore, managed access, and content/audio truth cannot be replaced
  by local browser state or registry text.
- Formal commerce and receiver-managed access remain physically and
  semantically separate.
- Learner UI must not expose internal governance, runtime, test, prompt,
  environment, or implementation language.

## Implementation hypothesis changed

- Added one common preparation bundle and three checkpoint-isolated child
  registries.
- Bound a 173-obligation source universe without claiming a complete
  state-to-lane partition. Exact CP-BA, CP-CS, and CP-WEB partitions remain
  unresolved.
- Split CP-BA into one four-target platform-browser scenario and two shared
  access-profile scenarios. Shared results cannot fill platform cells; phone
  landscape is explicit.
- Registered 12 isolated CP-CS scenarios, including all required Space action
  selectors `TOOL-05..11`, with separate formal iOS/Android/Web commerce and
  receiver-managed access lanes.
- Registered all 12 existing PC Web `PW-*` requirements and bound target,
  environment, account, build, content, window, and compatibility dimensions.
- Reserved 33 future manifest identities and collision-free normalized paths;
  every manifest file must remain absent.
- Added an exact-schema validator and a 61-test adversarial suite. Schema v1 is
  intrinsically `ineligible_preparation_schema`; it cannot be promoted in
  place to a freeze candidate.
- Apart from historical protected decision-owner provenance, stored no
  candidate execution-role collaborator identity, workstation/browser
  fingerprint, personal device identifier, account identifier, credential, or
  secret.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, decision, checkpoint
  contract, ledger, PC Web mapping, release governance, delivery/harness code,
  PR `#484` metadata, and protected workflow/deployment metadata.
- Machine-local and remote discovery was used only to establish absence or
  unresolved status. Discovered personal, collaborator, workstation, browser,
  device, account, and credential-like values were not retained as registry
  assignments or evidence.
- Generated/dependency/cache/archive data was not used as product truth.
- The sibling external `card make` workspace was not read or changed.

## Files changed

- `.github/workflows/pr-gates.yml`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/README.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/README.md`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v1.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-ba.registry.v1.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-cs.registry.v1.json`
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-web.registry.v1.json`
- `scripts/classify_formal_approval_scope.mjs`
- `scripts/test_classify_formal_approval_scope.mjs`
- `scripts/validate_mobile_ux_batch1_registry.mjs`
- `scripts/test_validate_mobile_ux_batch1_registry.mjs`
- `scripts/harness_validator/context.py`
- `scripts/harness_validator/sections/delivery_runtime.py`
- `scripts/harness_validator/sections/governance_contracts.py`
- `scripts/harness_validator/sections/product_contract_mirrors.py`
- `scripts/test_harness_module_boundaries.py`
- `docs/agent-runs/2026-08-10-mobile-ux-batch1-preparation.md`

## Commands run

- `node scripts/validate_mobile_ux_batch1_registry.mjs --json` -> structural
  preparation validation passed; authority remained false.
- `node --test scripts/test_validate_mobile_ux_batch1_registry.mjs` -> 61/61
  adversarial tests passed.
- `node --test scripts/test_classify_formal_approval_scope.mjs` -> 37/37
  classifier tests passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 19/19 boundary tests
  passed.
- `node --check` for both Batch 1 JavaScript files and classifier plus
  `python3 -m py_compile` for modified harness modules -> passed.
- `jq -e .` / `jq -S .` for all four registry JSON files -> passed.
- `git diff HEAD --check` and scoped stale-claim/privacy scans -> passed.
- `node scripts/validate_mobile_ux_batch1_registry.mjs --require-tracked --json`,
  the full local harness, and remote checks -> pending the exact commit.

## Validation results

- Historical Batch 0 activation: workflow run `31322774545`, environment
  `18348068326`, deployment `5820417644`, protected review, and aggregate
  `formal-approval` succeeded for exact head `ac7e124f…`. It does not authorize
  the changed classifier or current Batch 1 bytes.
- Preparation validator: `artifact_valid=true`; registry semantic digest
  `e53e55fe097c823d192c23219895abdc1092a60304d10150e7fdeadeff3a94ea`;
  registry file SHA-256
  `f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982`;
  88 unresolved inputs; `current_authority_state` requires a new exact-head
  protected preparation decision; `next_stage_readiness=blocked_unresolved_inputs`;
  `freeze_readiness=ineligible_preparation_schema`;
  `manifest_freeze_eligible=false`; `decision_status=not_evaluated`;
  `gate_effect=none`; all authority flags false.
- Batch 1 adversarial validator tests: 61/61 passed.
- Classifier and harness boundary tests passed on the working tree and will be
  re-run with exact tracked-mode validation and the full local harness after
  the exact commit. Exact frozen reviews, remote required checks, and protected
  preparation approval remain pending.

## Agent review status

- Reviewer: independent harness/records, semantic-authority, and adversarial
  precommit reviewers; final exact-head reviewers pending.
- Status: precommit review passed; blocked pending exact commit, final
  exact-head reviews, remote checks, and protected preparation approval.
- Preliminary record/harness review: CI and harness wiring passed after exact
  argument allowlisting; record-shape and README-mirror findings were corrected.
- Preliminary semantic review: failed because the first draft reused the Batch
  0 activation after classifier drift, blended shared access results into
  platform cells, mixed owners, overclaimed 173-state completion, and left
  scenario/cohort gaps. The registry and prose were rewritten fail-closed.
- Preliminary adversarial review: failed on loose mappings, missing cohort
  dimensions and selectors, weak provenance/tracked-file checks, symlink/path
  escape, misleading consumer tests, and privacy leakage. Exact bindings,
  cohort dimensions, path/HEAD checks, privacy rejection, and adversarial tests
  were added.
- Remediation re-reviews: semantic authority
  `PASS_PRECOMMIT_SEMANTIC`, harness/records `PASS_PRECOMMIT`, and adversarial
  security `PASS_PRECOMMIT`; each reported P0=0 and P1=0. The adversarial
  reviewer also reported P2=0 after duplicate-page fail-closed hardening.
- Final exact-head semantic and adversarial reviews: pending.

## Binary evidence

- Evidence manifest: N/A; this phase forbids evidence collection.
- Archive: N/A.

## User-visible UI impact

- No visual artifact, palette, component, learner copy, navigation,
  application source, or runtime behavior changed.

## Card make external workspace impact

- No card content was produced, approved, imported, or counted; the external
  `card make` workspace was untouched.

## Risks and open questions

- Current exact bytes have no protected preparation authority.
- The source-universe binding is not an exact state-to-lane registry.
- Actual role confirmations, physical devices, receiver/provider environments,
  non-secret account references, signed builds/deployments, approved
  content/audio subjects, execution windows, membership stages, intended
  origins, compatibility keys, and type-specific manifest validators remain
  unresolved.
- Schema v1 cannot become freeze-ready by filling fields. A separately reviewed
  successor schema and separate protected freeze decision are required.
- `CP-VA`, user-visible implementation, `CP-NFA`, `CP-RLR`, release, merge, and
  leadership-readiness claims remain blocked.

## Follow-up

1. Create an exact commit, run tracked validation and the full local harness,
   and obtain independent exact-byte semantic and adversarial reviews.
2. Obtain a fresh protected preparation-only decision for that exact head.
3. Build a separate freeze-candidate schema with exact state-to-lane
   partitions and privacy-safe confirmed cohort references.
4. Only after a separate protected freeze decision may isolated evidence
   manifests be created or evidence collection begin.
