# Agent Run Record: Governance boundary hardening

## Task summary

- Date: 2026-07-18
- Branch: `infra/harden-governance-boundaries`
- PR: N/A
- Summary: Close three review findings in formal launch approval, read-only Harness capability enforcement, and local gate timeout cleanup without changing product behavior or launch state.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change does not alter product scope, UI, content, membership, interaction, or runtime product truth.
- `docs/release/launch-readiness.v1.json` remains `not_ready`; local or CI validation cannot create launch approval.

## Implementation hypothesis changed

- Read-only Harness sections now combine static AST restrictions with a worker-process audit policy that blocks writes, filesystem mutation, process execution, network access, dynamic code, and non-allowlisted imports.
- Local gate timeout cleanup sends `SIGTERM`, allows a bounded grace period, and then sends `SIGKILL` to the original process group even when its parent process already exited.
- Sensitive launch, evidence, security-report, workflow, and governance changes use a trusted-base `pull_request_target` classifier and a protected GitHub Environment instead of treating repository `verified_by` metadata as approval.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, Harness runner/context/section modules and tests, local gate execution and tests, launch readiness contracts and validators, PR workflows/template, current branch protection, and GitHub Environment configuration.
- Generated/dependency/cache/archive read: ignored `exports/local-gates/` reports were read only to verify the local gate result; no generated output or archive was used as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `scripts/harness_validator/*`, `scripts/test_harness_module_boundaries.py`, and `scripts/test_validate_harness_runner.py`: add AST import allowlisting, read-only runtime audit enforcement, and bypass regressions.
- `scripts/local_gates/execution.py` and `scripts/test_run_local_gates.py`: guarantee descendant cleanup after timeout and test a child that ignores `SIGTERM`.
- `.github/workflows/formal-approval.yml`, `scripts/classify_formal_approval_scope.mjs`, and `scripts/test_classify_formal_approval_scope.mjs`: add trusted-base sensitive-path classification, protected approval, rename handling, malformed input handling, and fail-closed API truncation checks.
- `docs/release/*`, `scripts/validate_launch_readiness.mjs`, and its tests: bind formal launch approval to the protected environment, fixed reviewer, disabled administrator bypass, workflow, and required status name while preserving `not_ready`.
- `spec/harness-architecture.json`, `spec/agent-harness.json`, `spec/evals.json`, delivery Harness mirrors, CI, and the PR template: record and continuously verify the strengthened contracts.

## Commands run

- `python3 scripts/test_harness_module_boundaries.py` -> 18 tests passed.
- `python3 scripts/test_validate_harness_runner.py` -> 20 tests passed.
- `python3 scripts/test_run_local_gates.py` -> 29 tests passed.
- `node --test scripts/test_classify_formal_approval_scope.mjs` -> 10 tests passed.
- `node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs` -> 18 tests passed; the tracked baseline is valid and remains `ready=false`.
- `python3 scripts/validate_harness.py` -> complete remote Harness passed.
- `scripts/run_local_gates --profile dev --output exports/local-gates/governance-boundary-hardening-dev-final.json` -> complete `passed_with_exception`; 16/17 gates passed with only the explicit dev Node 25.9.0 versus 22.13.0 drift, and tracked files remained unchanged.
- `node scripts/validate_launch_readiness.mjs` -> structurally valid and honestly `ready=false` with five pending and five blocked gates.
- GitHub Environment API create/update/read -> `formal-product-owner-approval` requires `github:LENKIN233` and reports `can_admins_bypass=false`.
- Live GitHub pagination probe against PR #408 -> `.changed_files` and the `gh api --paginate --slurp` file count both returned 5.

## Validation results

- Obfuscated built-in file writes, process execution, socket creation, dynamic evaluation, alternate `io.FileIO`, and `asyncio` process imports fail in the owning read-only Harness layer.
- A descendant that ignores `SIGTERM` cannot survive a timed-out local gate after its parent exits.
- Empty, malformed, renamed, sensitive, and API-truncated PR file lists fail closed; workflow regression verifies the classifier is loaded from the base SHA and never from the PR head.
- Local quality output did not update PR review, content approval, or launch readiness.
- `node scripts/report_repo_health.mjs --base origin/main --strict` correctly failed during development because the topic worktree was intentionally dirty and had no upstream; it must be rerun after commit/push.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: pending
- Blocking findings: Full final-diff review, final test rerun, PR checks, and protected-environment activation on the default branch remain pending.

## User-visible UI impact

- N/A. No screen, component, copy, interaction, navigation, or visual artifact changed.

## Card make external workspace impact

- N/A. No candidate content, audio, review, approval, or import payload changed.

## Risks and open questions

- `pull_request_target` intentionally executes only trusted default-branch code and never checks out or evaluates PR code. Future changes to the workflow or classifier are themselves classified as sensitive.
- `prevent_self_review` remains false because the authenticated product owner is the sole environment reviewer and also owns repository automation. Approval is therefore authenticated and manually recorded, but it is not independent two-person review.
- The `formal-approval` context cannot become required until its workflow is merged into `main`; activation must use a second small PR so the bootstrap PR is not deadlocked.

## Follow-up

- Complete final review, commit and merge the bootstrap PR under the existing required checks.
- From updated `main`, add `formal-approval` to the required-check authority and remote branch protection, approve the protected environment deployment, and verify a sensitive PR cannot merge without it.
