# Agent Run Record: CI action refresh

## Task summary

- Date: 2026-08-03
- Branch: `infra/refresh-ci-actions`
- PR: https://github.com/LENKIN233/softbook_cet/pull/478
- Summary: Consolidate the stale Dependabot workflow updates for `actions/setup-node` and `ruby/setup-ruby` into one governed change with a human-readable review record.

## Referenced specs

- `spec/authority-map.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change does not alter CET4/6 product behavior, content, access, membership, or release readiness.

## Implementation hypothesis changed

- GitHub Actions jobs may use `actions/setup-node@v7` and the immutable `ruby/setup-ruby` v1.321.0 commit while retaining the existing Node 22.13.0, Ruby 3.3, cache, required-check, and fail-closed governance behavior.

## Workspace boundary and read scope

- Active truth/source read: `.github/workflows/pr-gates.yml`, `spec/authority-map.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `.github/workflows/pr-gates.yml`: update all seven Node setup steps to v7 and refresh the immutable Ruby setup commit to v1.321.0.
- `docs/agent-runs/2026-08-03-ci-action-refresh.md`: record scope, verification, and review.

## Commands run

- `python3 scripts/validate_harness.py`
- `node scripts/test_report_repo_health.mjs`
- `git diff --check`

## Validation results

- `python3 scripts/validate_harness.py`: `HARNESS VALIDATION OK`.
- `node scripts/test_report_repo_health.mjs`: all repository-health regression checks passed.
- `git diff --check`: passed.
- GitHub required checks remain authoritative and must pass on the consolidated PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none identified in the dependency-only diff.

## User-visible UI impact

- N/A.

## Card make external workspace impact

- N/A.

## Risks and open questions

- The workflow action updates are intentionally consolidated because the two stale bot PRs edit the same protected file. Formal product-owner approval and all required checks remain mandatory.

## Follow-up

- Close superseded Dependabot PRs #424 and #425 after this governed PR is opened.
