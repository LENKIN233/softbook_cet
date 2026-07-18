# Agent Run Record: Formal approval activation

## Task summary

- Date: 2026-07-18
- Branch: `infra/activate-formal-approval-gate`
- PR: Pending creation
- Summary: Activate the trusted formal product-owner approval status as a required `main` check and make both the full Harness and repository-health workflow fail closed when the protected GitHub Environment drifts.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change does not alter product scope, UI, content, membership, interactions, or runtime behavior.
- `docs/release/launch-readiness.v1.json` remains `not_ready`; a protected deployment approval is a governance event, not product launch approval or launch readiness.

## Implementation hypothesis changed

- `formal-approval` becomes an explicit required pull-request status in the delivery contract and GitHub branch protection.
- The full delivery Harness reads the protected Environment and verifies its fixed reviewer, administrator bypass policy, and self-review policy.
- Weekly remote repository health verifies the same Environment and exact required-status set, with negative tests for unavailable or weakened settings.
- The trusted-base sensitive-path classifier protects the repository-health implementation and governance contract validator from unapproved weakening.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, formal approval workflow/classifier/tests, delivery Harness sections, repository-health implementation/tests, release governance documentation, live branch protection, and live GitHub Environment configuration.
- Generated/dependency/cache/archive read: none used as authority; generated local-gate reports remain ignored.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `spec/repo-delivery-contract.json`, `spec/agent-harness.json`, and `spec/evals.json`: make formal approval and remote Environment drift detection explicit contracts.
- `scripts/harness_validator/sections/governance_contracts.py` and `delivery_runtime.py`: mirror the contract and verify live Environment settings in full mode.
- `scripts/report_repo_health.mjs` and its tests: require the exact status set and fail closed on formal approval Environment drift.
- `scripts/classify_formal_approval_scope.mjs` and its tests: protect the new enforcement surfaces with trusted default-branch classification.
- `.github/workflows/pr-gates.yml`: make manual dispatch execute the same remote repository-health path as the weekly schedule so its credentials can be proven before merge.
- `docs/release/README.md`: clarify that branch protection, full Harness, and weekly health independently enforce the gate.

## Commands run

- `node --test scripts/test_classify_formal_approval_scope.mjs` -> 10 tests passed.
- `node scripts/test_report_repo_health.mjs` -> oversized-history, workspace-hygiene, and formal-Environment drift regressions passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 18 tests passed.
- `python3 scripts/validate_harness.py --mode local` -> complete local Harness passed with remote guard intentionally omitted.
- `node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs` -> 18 tests passed; tracked launch state remains valid and `ready=false`.
- Remaining full local/remote validation and exact PR-head GitHub checks: pending.

## Validation results

- Repository health rejects administrator bypass, a missing required reviewer, and an unavailable formal approval Environment.
- Remote settings failures remain fail closed but are reported separately from policies that are explicitly disabled.
- The scheduled remote path is also reachable by manual workflow dispatch for pre-merge credential and API verification.
- Manual dispatch `29628252198` proved that the built-in Actions token receives HTTP 403 from branch protection; the workflow now requires a repository-scoped `REPO_HEALTH_TOKEN` and forbids that fallback.
- The trusted classifier includes every enforcement surface changed by this activation PR.
- Local Harness remains complete for local mode; full mode is intentionally pending until the remote required-status list is atomically activated for this PR.
- No local or CI result changed formal content approval, Agent review, or launch readiness.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Pending
- Blocking findings: Review and exact-head required checks are not complete.
- Review summary: Pending final diff review after remote gate activation.

## User-visible UI impact

- N/A. No screen, component, copy, interaction, navigation, or visual artifact changed.

## Card make external workspace impact

- N/A. No candidate content, audio, review, approval, or import payload changed.

## Risks and open questions

- `prevent_self_review` remains explicitly false because `github:LENKIN233` is both the sole repository owner and the sole protected Environment reviewer. The approval is authenticated and manually recorded, but it is not independent two-person review.
- `REPO_HEALTH_TOKEN` must be created as a fine-grained token scoped only to `LENKIN233/softbook_cet`, with `Administration: read` and `Actions: read`; the broad local GitHub CLI OAuth token must not be copied into Actions.
- Enabling the new required status before a PR run emits it would deadlock the transition. Branch protection will be updated only after this PR exists and the trusted default-branch workflow has started.

## Follow-up

- Create the activation PR, add `formal-approval` to remote branch protection, run the full Harness against the live configuration, complete Agent review, and obtain the protected Environment approval on the final reviewed head.
