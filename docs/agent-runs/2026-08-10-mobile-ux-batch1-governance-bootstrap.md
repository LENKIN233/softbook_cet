# Agent Run Record: Mobile UX Batch 1 trusted governance bootstrap

## Task summary

- Date: 2026-08-10
- Branch: `cross/mobile-ux-governance-bootstrap-v1`
- PR: Pending publication at record freeze; the protected PR will link this tracked record.
- Summary: Install the trusted-base classifier, validator, remote GitHub evidence reader, successor and recovery contracts, pinned read-only workflow wiring, self-contained exact-byte fixtures, and regression coverage needed to evaluate later Mobile UX Batch 1 governance decisions. This bootstrap is deliberately inactive and grants no governance, product, visual, implementation, native, release, or leadership-readiness authority.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`

## Product truth used

- N/A. This change does not alter CET4/6 Learning, Space, membership, platform, interaction, content, runtime, visual, native, or release behavior.

## Implementation hypothesis changed

- A `pull_request_target` workflow can classify untrusted changed paths and validate every scope/add-only/rename/copy decision only with code loaded from the exact verified base SHA and a full-tree Git diff to the exact event head. The live pull-request files API is only a current-filename completeness cross-check; its status and previous-filename metadata never become semantic truth. Unknown, mixed, incomplete, raced, expired, or unverifiable governance state fails closed.
- The protected result can succeed only after code from that same verified base re-fetches and binds the current workflow run ID, exact PR/head, environment, reviewer, first run attempt, and exact canonical approval comment `approve <decision_class> PR #<number> head <40sha>` without trimming, case folding, or whitespace normalization. A failed run requires a new pull-request event run and new approval; a rerun cannot reuse attempt-1 approval.
- A closed recovery envelope can derive `inactive_bootstrap_installed`, `active`, and `revoked` only from trusted-base Git and remotely verified materialization lineage, preserve an essential eleven-path kernel, and admit protected maintenance, revocation, and same-policy rebootstrap without giving any product or downstream authority.
- The installed bootstrap has `bootstrap_authority=none` and remains inactive until a later, separate protected activation PR is validated by this already-merged base code, approved through the protected environment, reviewed, gated, and merged.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs; `.github/workflows/formal-approval.yml`; `.github/workflows/pr-gates.yml`; the formal-approval classifier and tests; harness validator sections; current Mobile UX architecture proposal artifacts only as unmerged, digest-pinned review input.
- Generated/dependency/cache/archive read: none used as semantic authority.
- External workspace read: none. `/Users/lenkin/programing/card make` was not accessed or changed.

## Files changed

- `.github/workflows/formal-approval.yml`: add full-commit-pinned, read-only, base-only trusted validation before protected approval; revalidate the exact current run after release without checking out or executing PR-head code.
- `.github/workflows/pr-gates.yml`: add syntax and regression gates for the bootstrap, successor, and recovery modules.
- `scripts/classify_formal_approval_scope.mjs` and `scripts/test_classify_formal_approval_scope.mjs`: add exact decision classes, rename-aware fail-closed classification, and bypass regressions.
- `scripts/lib/mobile_ux_batch1_governance_contract.mjs` and `scripts/test_mobile_ux_batch1_governance_contract.mjs`: add strict decision, event, receipt, ancestry, validity, privacy, legacy dual-chain, and zero-authority contracts.
- `scripts/lib/mobile_ux_batch1_github_event_reader.mjs` and `scripts/test_mobile_ux_batch1_github_event_reader.mjs`: add immutable GitHub event and Git-object revalidation with truncation and identity checks.
- `scripts/lib/mobile_ux_batch1_successor_contract.mjs`, `scripts/validate_mobile_ux_batch1_successor.mjs`, and `scripts/test_mobile_ux_batch1_successor_contract.mjs`: add schema/R0/B2 successor validation without activating a successor stage.
- `scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs`, `scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs`, and `spec/mobile-ux-batch1-governance-recovery-decision.schema.json`: add the data-only four-state maintenance, revocation, and same-policy rebootstrap envelope, exact lineage proof, permanent audit-record integrity, essential-kernel survival rules, and zero-authority schema.
- `scripts/validate_mobile_ux_batch1_governance.mjs` and `scripts/test_validate_mobile_ux_batch1_governance.mjs`: add trusted-base PR validation and exact change-scope regressions.
- `scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/`: add bounded strict-base64/gzip exact-byte vectors for historical and Batch 1 subjects so tests do not depend on another worktree, untracked activation files, or unavailable commits.
- `scripts/harness_validator/sections/governance_contracts.py`, `scripts/harness_validator/sections/delivery_runtime.py`, and `scripts/harness_validator/sections/harness_architecture.py`: mirror and validate the inactive bootstrap contract, exact workflow bytes, recovery kernel, and harness-layer boundaries.
- `spec/repo-delivery-contract.json`, `spec/harness-architecture.json`, and `spec/evals.json`: register the code-only bootstrap, its tests, and its explicit inactive/no-authority boundary.
- `docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-bootstrap.md`: preserve this run's scope, evidence, review, and handoff.

## Commands run

- Exact Node `22.13.0` syntax checks over all Batch 1 JavaScript modules and CLIs.
- Exact Node `22.13.0` regression suites for classifier, governance, GitHub reader, recovery, successor, and end-to-end trusted-base PR validation.
- `python3 scripts/test_harness_module_boundaries.py`.
- `python3 scripts/test_validate_harness_runner.py`.
- `python3 scripts/test_run_local_gates.py`.
- `python3 scripts/validate_harness.py --mode local`.
- `python3 scripts/validate_harness.py`.
- The same exact Node suites plus local/full harness validation in a fresh Git snapshot containing only the PR-A allowlist and physically excluding the four canonical PR-B activation files.
- Live read-only replay of the pinned historical GitHub approval event and remote Git blob through the same reader used by the validator.
- Live read-only verification of the official `actions/checkout@v7` and `actions/setup-node@v7` commit targets and GitHub verification state.
- `git diff --check`.

## Validation results

- Exact Node `22.13.0` workspace suites: `300/300` passed; zero failed, cancelled, skipped, or todo.
- Exact Node `22.13.0` clean-snapshot suites: `300/300` passed with the same frozen bytes.
- Python harness module boundaries: `18/18` passed. Harness runner: `21/21` passed. Local-gate runner regressions: `29/29` passed.
- `python3 scripts/validate_harness.py --mode local`: passed with the expected `PARTIAL` result and `selected=15`; `python3 scripts/validate_harness.py`: passed.
- Fresh frozen PR-A Git snapshot `/tmp/softbook-clean-pra-frozen.PID9or`: hooks installed, local/full harness passed, Git status clean, and the four canonical PR-B activation files were physically absent.
- Production JavaScript syntax checks, strict JSON parsing, ESLint `no-undef`, and `git diff --check`: passed.
- Exact workflow SHA-256: `formal-approval.yml` = `13e67dede95f30de747155552e43b0ef758059bd375612d59eedbe24685d2de2`; `pr-gates.yml` = `f1bcaa0b168646b85a21da89102b7a0540c323fe9652719557d68131485ea549`. All workflow `uses:` references are immutable full commit SHAs.
- The pinned historical approval replay resolved the exact PR, workflow run, deployment, waiting/success statuses, environment/reviewer, approval-review digest, authority-event digest, and tracked `100644` subject blob without treating later deployment inactivity as revocation.
- Independent frozen-snapshot review found `P0=0` and `P1=0` in code/runtime. GitHub required checks, final index-scope review, and protected human product-owner approval remain authoritative external gates; this record does not substitute for any of them.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.

## Agent review status

- Reviewer: independent Codex sub-agent plus primary-agent security review.
- Status: frozen unstaged code/security review passed; `P0=0`, `P1=0`.
- Blocking findings: none in the frozen PR-A implementation. Exact index-scope review is required after allowlist staging; protected human approval and GitHub required checks remain external pre-merge gates.

## User-visible UI impact

- N/A. No user-visible UI, copy, interaction, color, layout, or runtime surface is changed.

## Card make external workspace impact

- N/A. No candidate card content is produced, approved, imported, or counted.

## Risks and open questions

- The bootstrap cannot validate its own introduction because its base does not contain the new validator. It therefore remains inactive and is governed by the already-active base workflow. A separate activation PR is required after this bootstrap is merged.
- Trusted-base maintenance validation proves the approval/scope/artifact/lineage envelope and essential-kernel survival; it does not prove that new candidate code is semantically correct, safe, or future-operable. Independent review and protected-owner judgment remain required.
- Protected environment approval must be performed by the configured human reviewer; no repository artifact or agent action can fabricate or replace it.
- PR-A itself is still governed by the pre-bootstrap base workflow and cannot claim that the new verifier validated its own introduction. After PR-A is merged, every subsequent run using the installed current-run gate requires the reviewer to enter exactly `approve <decision_class> PR #<number> head <40sha>` using that run's workflow classification, decimal PR number, and lowercase 40-character event-head SHA. Any byte difference fails closed.

## Follow-up

- After this bootstrap is independently reviewed, green, protected-approved, and merged, open a separate exact-scope activation PR containing the governance policy, activation decision, resolved-requirement schema, authority/harness mirrors, and its own run record. Only then proceed through legacy receipt migration, preparation receipt, R0, D1, B2, and F3 as distinct protected stages.
