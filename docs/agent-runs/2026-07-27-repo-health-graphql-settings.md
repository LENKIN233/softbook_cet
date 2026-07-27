# Agent Run Record: Repository health GraphQL settings

## Task summary

- Date: 2026-07-27
- Branch: `fix/repo-health-graphql-settings`
- PR: https://github.com/LENKIN233/softbook_cet/pull/450
- Summary: Restore trusted scheduled repository-health checks by reading all required repository settings from one authenticated GraphQL repository snapshot.

## Referenced specs

- `spec/authority-map.json`
- `spec/repo-delivery-contract.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change is delivery governance only and does not alter CET product behavior, content approval, runtime deployment, or launch readiness.

## Implementation hypothesis changed

- The repository-scoped fine-grained `REPO_HEALTH_TOKEN` can read branch protection and the protected approval Environment, but GitHub's REST repository response may omit merge-automation fields and return them as unavailable.
- The same token exposes `autoMergeAllowed`, merged-branch deletion, the default branch, and all merge methods through the GraphQL Repository object. Remote health must read those six settings atomically from that GraphQL node and continue to fail closed on missing or malformed data.

## Workspace boundary and read scope

- Active truth/source read: the referenced governance specs, the remote repository-health validator and tests, the trusted workflow wiring, active release documentation, and the two run records that introduced the protected credential and repository-setting guard.
- Generated/dependency/cache/archive read: GitHub Actions logs for trusted scheduled run `30243339812`; no generated output was used as product truth and no tracked report was created.
- External workspace read: none. `/Users/lenkin/programing/card make` was not accessed or changed.

## Files changed

- `scripts/report_repo_health.mjs`: read all required repository settings through one parameterized GraphQL repository query and reject malformed repository identity or payloads.
- `scripts/test_report_repo_health.mjs`: model the GraphQL response, preserve all drift regressions, and fail if the validator falls back to the incomplete REST repository endpoint.
- `docs/agent-runs/2026-07-27-repo-health-graphql-settings.md`: preserve the observed failure, fix boundary, validation, and non-claims.

## Commands run

- `gh api repos/LENKIN233/softbook_cet/actions/jobs/89904964725/logs` -> scheduled trusted-main health failed only with `remote_repository_settings_unavailable`; branch protection, signatures, required checks, and the approval Environment remained readable.
- `gh api graphql ... RepositoryHealthSettings` -> returned `main`, auto-merge enabled, merged-branch deletion enabled, and squash-only merge methods for the current repository.
- `node scripts/test_report_repo_health.mjs` -> passed oversized historical blob, repository/approval drift, REST fallback rejection, worktree, stash, upstream, and stale-branch regressions.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `node scripts/report_repo_health.mjs --full-tree --remote --strict --allow-dirty ...` -> passed with all six repository settings present; the only warning was the expected missing upstream before first push.
- `scripts/run_local_gates --profile dev` with Node 22.13.0 and Ruby 3.3 -> 18/18 passed.

## Validation results

- JavaScript syntax checks, `git diff --check`, repository-health regressions, and complete Harness validation passed.
- Live remote health using the local authenticated GitHub CLI token returned zero errors and the exact required settings: default `main`, auto-merge enabled, merged-branch deletion enabled, squash enabled, merge commits disabled, and rebase merge disabled.
- Exact-toolchain dev gates passed 18/18; ignored report: `exports/local-gates/repo-health-graphql-settings-dev.json`.
- Strict PR profile and GitHub required checks remain pending until the branch is pushed and the draft PR exists.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: checked GraphQL variable binding, repository identity validation, null and type handling, all six camelCase-to-contract mappings, fail-closed behavior, preservation of every existing drift finding, REST fallback rejection, and report compatibility.

## User-visible UI impact

- N/A. No UI, interaction, design artifact, or product copy changes.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not accessed or changed.

## Risks and open questions

- The validator still fails closed when GraphQL is unavailable, malformed, points at a different repository, or omits any required setting.
- A local broad GitHub CLI token can prove query shape but cannot prove the Actions fine-grained token path. Final acceptance requires a trusted `main` workflow dispatch using `REPO_HEALTH_TOKEN`.
- Green repository health cannot establish product, content, production deployment, or launch readiness.

## Follow-up

- Merge only after strict local PR gates and all GitHub required checks pass, then manually dispatch the trusted `main` workflow and require `repo-health` to pass before resuming CloudBase deployment.
