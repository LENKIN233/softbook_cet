# Agent Run Record: launch evidence contract

## Task summary

- Date: 2026-07-31
- Branch: `infra/launch-evidence-contract`
- PR: pending
- Summary: Added fail-closed, typed launch-evidence validation for learning runtimes, release operations, and external provider capabilities; added a non-gate-eligible blank-receiver simulation and kept the tracked launch baseline honestly not ready. The external `card make` repository was security-audited before its requested Public visibility change.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/doc-manifest.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Launch readiness is not a self-attested checklist: passed gates require immutable, repository-verifiable evidence for the exact reachable release-candidate cohort.
- Learning-event and learning-session readiness must prove canonical cross-device convergence, offline replay, membership/access boundaries, exact scheduler identity, and receiver-deployed execution.
- Release operations must prove receiver-owned load, availability, backup/restore, penetration, and rollback behavior without deleting learning data.
- External provider/account control is authenticated only by the protected product-owner approval environment; capability evidence is metadata and cannot replace runtime, payment, distribution, compliance, or security launch gates.
- Quality gates move the release date when necessary; they are not weakened to meet a date.

## Implementation hypothesis changed

- Added `release-operational-policy.v1` as the versioned minimum for one coherent release campaign, including explicit thresholds, validity windows, execution modes, operator/verifier separation, and per-report semantic requirements.
- Added strict JSON parsing that rejects invalid UTF-8, BOMs, duplicate keys, malformed escapes/control characters, excessive depth, invalid numbers, trailing content, and prototype-shaped keys as object structure.
- Formal raw evidence is limited to tracked regular `repo://` files with exact size and SHA-256 verification. Large or remote evidence must be represented by a repository-verified evidence-archive manifest.
- Added `launch-release-candidate.v1` cohort binding across commit, profile, environment, release, parent release, bundle, content, backend, iOS, Android, and PC Web identities.
- Added typed `external-capability-evidence.v1` validation for every declared provider capability, with `capability_eligible=true` and `gate_eligible=false`.
- Availability now binds aggregate observations to exact per-route probes; backup/restore requires every required source dataset to be nonempty; rollback requires distinct retained/verified A/B releases and nonempty preserved learning data.
- Added an injected in-memory blank-receiver A → B → rollback A simulation using the real publisher, receiver adapter, and rollback orchestration. It explicitly declares `simulation=true`, `execution_mode=repository_in_memory`, and `gate_eligible=false`.
- The tracked readiness record now reserves a `release_candidate` slot but remains `null` until an actual candidate and formal evidence exist.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, task-relevant harness and workflow code, launch-readiness records, CloudBase receiver/release code, runtime contracts, and their tests.
- Generated/dependency/cache/archive read: installed dependency trees were used only to execute tests; no generated, dependency, cache, or archive content was used as product truth.
- External workspace read: `/Users/lenkin/programing/card make` and its GitHub repository were read for repository-wide secret/history audit, public-visibility readiness, workflow status, and PR #108 scope. No candidate card payload, approval, or content-production artifact was created or modified.

## Files changed

- `spec/release-operational-policy.json`: versioned non-regressing operational thresholds and evidence rules.
- `scripts/lib/strict_json.mjs`: strict, prototype-safe JSON parser.
- `scripts/lib/launch_evidence_contract.mjs`: typed learning, release-operation, and external-capability evidence semantics.
- `scripts/validate_launch_readiness.mjs`: candidate-cohort, repository artifact, policy, evidence-reuse, and cross-report validation.
- `scripts/test_validate_launch_readiness.mjs`: positive fixtures and fail-closed mutation/regression coverage.
- `scripts/classify_formal_approval_scope.mjs`, `scripts/test_classify_formal_approval_scope.mjs`: protect evidence policy, semantic parsers, truth mirrors, readiness records, and workflow changes behind formal product-owner approval.
- `infra/cloudbase/release-blank-environment-simulation.mjs`, `infra/cloudbase/functions/softbook-api/test/release-blank-environment-simulation.test.js`: repository-only nonformal publish/verify/rollback simulation and destructive-surface regressions.
- `infra/cloudbase/cloudbase-receiver-adapter.mjs`, `infra/cloudbase/functions/softbook-api/test/cloudbase-receiver-adapter.test.js`: require rollback targets to be both retained and verified.
- `infra/cloudbase/learning-events-v2-runtime-contract.md`, `infra/cloudbase/learning-session-v1-runtime-contract.md`, `infra/cloudbase/release-bundle-v1-runtime-contract.md`: formal evidence and simulation boundaries.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/evals.json`: external truth authority, runtime status, anti-patterns, and golden-task coverage.
- `spec/authority-map.json`, `spec/doc-manifest.json`, `AGENTS.md`, `docs/release/README.md`: register policy ownership, read order, operator guidance, and hard boundaries.
- `scripts/harness_validator/sections/prelude.py`, `scripts/harness_validator/sections/product_contract_mirrors.py`, `scripts/harness_validator/sections/truth_mirrors.py`: exact policy/runtime/eval mirrors and workflow/classifier anti-drift guards.
- `.github/workflows/pr-gates.yml`: run launch contract tests and validation with full Git history.
- `docs/release/launch-readiness.v1.json`: declare the absent release-candidate slot without claiming readiness.
- `docs/agent-runs/2026-07-31-launch-evidence-contract.md`: preserve task scope, evidence, review, validation, and unresolved launch boundaries outside chat history.

## Commands run

- External `card make`: full-history Gitleaks v8.30.1 scan across 216 commits and approximately 22.83 MB -> 0 leaks.
- External `card make`: current-tree sensitive filename, token, and private-key pattern audit -> no findings.
- External `card make`: GitHub visibility update and read-back -> `PUBLIC`.
- External `card make`: enabled GitHub Secret Scanning and Push Protection; open secret-scanning alerts -> 0.
- External `card make`: PR #108 checks -> 5/5 passed; scope audit -> harness/tooling/docs/templates and contract specs only; squash merge -> `6dfa3b2736e9e8b4ec8d47d444dba6c5e3e4b5e4`.
- `node --test scripts/test_validate_launch_readiness.mjs` -> 36/36 passed.
- `node --test scripts/test_classify_formal_approval_scope.mjs` -> 10/10 passed.
- `python3 scripts/validate_harness.py --mode local --format text` -> 15/15 selected sections passed; local completeness remains partial by contract.
- `python3 scripts/test_validate_harness_runner.py` -> 21/21 passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 18/18 passed.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH ./scripts/run_local_gates --profile dev --verbose` -> 20/20 passed; report `exports/local-gates/20260731T074516Z-baf9a8d2-dev-21740/report.json`.
- `git diff --check` -> passed.

## Validation results

- The final `dev` profile passed all 20 local gates, including toolchain/network isolation, harness tests, launch contract tests, launch validator, mobile metadata/design scans, mobile lint/typecheck/Jest, CloudBase backend tests, and dependency checks.
- CloudBase backend suite passed 176/176, including the blank-receiver A/B/rollback simulation.
- Mobile Jest passed 43 suites / 399 tests; lint and typecheck passed.
- Launch validation reports `ok=true`, `ready=false`, with 5 pending gates, 5 blocked gates, and 0 passed gates. No simulation or external capability metadata is counted as launch-gate evidence.
- Independent semantic review found and prompted fixes for three P1 issues: unverified HTTPS raw evidence, empty backup datasets, and aggregate availability hiding unprobed routes. The corrected contract and targeted negative tests pass.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: `final_semantic_review` (McClintock)
- Status: Passed
- Blocking findings: none; final review found no remaining P0/P1.
- Reviewer: `final_harness_review` (Pascal)
- Status: Passed
- Blocking findings: none; the full-history checkout anti-drift guard and this run record were both rechecked.

## User-visible UI impact

- N/A. No screen, visual token, copy, interaction, motion, physical-space presentation, or platform chrome changed.

## Card make external workspace impact

- `LENKIN233/card-make` changed from Private to Public only after a clean full-history secret scan and current-tree sensitive-material audit.
- GitHub Secret Scanning and Push Protection are enabled; there are no open secret-scanning alerts.
- PR #108 passed all five checks and was squash-merged. It changes harness/tooling/docs/templates and contract specs only.
- No candidate card content, audio, approval decision, payload import, or formal content quantity was created or altered.

## Risks and open questions

- No receiver-owned environment was provisioned or deployed, so no formal learning-runtime or release-operation evidence was created.
- The repository-only blank-environment simulation is deliberately nonformal and cannot satisfy a launch gate.
- The tracked launch baseline remains not ready until a concrete reachable release candidate and all receiver-owned evidence exist.
- PR #460 still requires human approval in the protected `formal-product-owner-approval` environment before its Android release/signing governance can merge; this approval cannot be self-issued.
- Remote/large raw evidence must use an immutable archive plus a tracked, rehashed repository manifest; direct HTTPS raw artifacts are rejected.
- External portal observations remain human-authenticated metadata under protected product-owner approval, not machine-asserted provider truth.

## Follow-up

- Complete the final harness review, commit and push this branch, then open a Draft PR to `main`.
- After PR #460 is human-approved and merged, update this branch, run required CI, record passed Agent review in the PR description, and merge only when all required checks are green.
- For an actual release candidate, run receiver-owned learning and operational campaigns, archive raw evidence through tracked manifests, and update readiness only after every formal validator passes.
