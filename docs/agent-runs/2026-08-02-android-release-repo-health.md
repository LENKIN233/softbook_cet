# Agent Run Record: Android Release Repository Health Alignment

## Task summary

- Date: 2026-08-02
- Refresh date: 2026-08-10
- Branch: `fix/android-release-repo-health`
- Pull request: `#476`
- Refreshed base: `origin/main@12d04aa836f07ee4bfdb5175dabcc2d760693f2d`
- Summary: Aligned the remote repository-health validator and its regression fixture with the authoritative GitHub required-check contract after the controlled-pilot PR-profile run exposed that `android-release` was incorrectly rejected as an unexpected check.

## Referenced specs

- `AGENTS.md`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- None. This is repository governance truth and does not change the CET4 controlled-pilot product definition, content gates, membership semantics, or release readiness.
- GitHub required checks remain authoritative; a local report cannot replace a remote required check, Agent review, formal approval, content approval, or launch evidence.

## Implementation hypothesis changed

- Added the already-authoritative `android-release` context to the repository-health validator's exact required-check allowlist.
- Updated the fake GitHub protection response used by regression tests and added fail-closed cases for a missing Android check and an unexpected extra check.

## Workspace boundary and read scope

- Active source read: the delivery/harness authority chain and the exact three-file repository-health change.
- Dependency/generated read: the dev gate catalog read repository source and installed dependency metadata, and generated ignored local-gate reports. The helper worktree's three lockfile-bound dependency directories were hydrated with `npm ci`; no dependency manifest or lockfile changed.
- External read: GitHub branch protection and PR metadata were queried read-only. No remote repository setting, review, approval, branch, or external account configuration was modified, and no credential value was read or exposed.
- External content workspace: `/Users/lenkin/programing/card make` was not read or modified.

## Files changed

- `scripts/report_repo_health.mjs`
- `scripts/test_report_repo_health.mjs`
- `docs/agent-runs/2026-08-02-android-release-repo-health.md`

## Commands run

- `node scripts/test_report_repo_health.mjs`
- `python3 scripts/validate_harness.py`
- `node scripts/report_repo_health.mjs --base origin/main --remote --output /tmp/softbook-android-release-repo-health.json`
- `git rebase origin/main`
- `git show --format=email --no-ext-diff --no-renames HEAD -- scripts/report_repo_health.mjs scripts/test_report_repo_health.mjs | git patch-id --stable`
- Exact Node `22.13.0` `npm ci` in `apps/mobile`, `apps/web`, and `infra/cloudbase/functions/softbook-api`.
- Exact Python `3.12.13`, Node `22.13.0`, Ruby `3.3.12`, and Bundler `2.4.22` `./scripts/run_local_gates --profile dev`.
- `git diff --check`

## Validation results

- Focused repository-health regressions passed, including exact failure for a missing `android-release` context and an unexpected additional context.
- Full Harness validation passed: `HARNESS VALIDATION OK`.
- Read-only remote validation observed the authoritative 12-check set, including `android-release`, without any remote governance error. The only reported error was the expected dirty state of this not-yet-committed worktree.
- The 2026-08-10 refresh rebased the exact three-file patch onto the independently merged dependency-security prerequisite at `main@12d04aa836f07ee4bfdb5175dabcc2d760693f2d`. The two implementation/test files retained stable patch ID `7352f557d9495607b43df72504232791cb09f52e`, and the rebased code commit retained a valid Git signature.
- The first dev-profile run found the helper worktree's ignored dependencies absent or incomplete and failed `16/24`; it was not treated as a code pass. After clean lockfile-bound hydration, the final dev profile passed `24/24` with zero exception, failed, skipped, or deferred gates. Report: `exports/local-gates/20260810T061839Z-9de879f3-dev-18884/report.json`.
- The generated dev report is ignored local feedback only. It is not a GitHub required check, protected formal approval, launch evidence, deployment evidence, or release-readiness evidence.
- `git diff --check` passed. Remote settings were not mutated; the validator remains read-only and exact-set based.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.

## Agent review status

- Reviewer: independent Codex sub-agent `repo_health_merge_prep` plus primary-agent governance review.
- Status: Passed.
- Blocking findings: none.
- Review summary: The post-#490 final three-file snapshot passed independent review with P0=0 and P1=0. The reviewer verified the stable implementation/test patch, exact 12-check contract, dependency hydration and local-report disclosures, full validation results, product/UI non-claims, and approved exact staging followed by a signed single-commit amend.

## User-visible UI impact

- None.

## Card make external workspace impact

- None.

## Risks and open questions

- Existing shared local workspace counts still cause strict local repository-health runs configured for one worktree/topic branch to fail; this change intentionally does not weaken those limits.
- The protected `formal-approval` check remains independent and cannot be bypassed by this validator update.

## Follow-up

- Complete the post-rebase frozen-snapshot review, update the existing PR #476 with an exact force-with-lease, and merge only after the refreshed head's required checks and protected product-owner approval pass. Old checks and approval must not be reused.
