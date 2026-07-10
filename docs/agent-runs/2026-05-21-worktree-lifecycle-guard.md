# Agent run record: worktree lifecycle guard

## Task summary

Record and enforce the rule that `origin/main` and GitHub PR merged state are integration authority, while a stale local `main` worktree is workspace hygiene drift.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/agent-run-record.json`

## Product truth used

- `product_truth`: No product behavior changed. The app remains a CET4/6 exam-pass product with single-card flow, core interactions, and physical-space semantics.
- `product_truth`: Card content production and approval remain external to `softbook_cet`.

## Implementation hypothesis changed

- `implementation_hypothesis`: A stale local `main` worktree is not integration truth and must not be used to infer whether a PR merge failed.
- `implementation_hypothesis`: Clean local `main` worktrees may be fast-forwarded to `origin/main`; dirty local main worktrees must be treated as workspace hygiene blockers rather than overwritten.

## Workspace boundary and read scope

- Worktree: `/Users/lenkin/programing/softbook_cet_worktree_lifecycle`.
- Branch: `infra/worktree-lifecycle-guard`.
- Original dirty mobile worktree was not edited.
- Read scope was limited to workspace-boundary, repo-delivery, agent-harness/evals, harness validator sections, and run-record docs.

## Files changed

- `AGENTS.md`
- `docs/branching-strategy.md`
- `docs/agent-runs/2026-05-21-worktree-lifecycle-guard.md`
- `scripts/harness_validator/sections/governance_contracts.py`
- `scripts/harness_validator/sections/workspace_boundary.py`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/repo-delivery-contract.json`
- `spec/workspace-boundary.json`

## Commands run

- `git fetch origin main`
- `git merge --ff-only origin/main` in the clean local `main` worktree
- `./scripts/install_git_hooks.sh`
- `python3 scripts/validate_harness.py`
- `PR_BODY="$(cat /tmp/softbook_worktree_lifecycle_pr_body.md)" python3 scripts/validate_agent_review.py`

## Validation results

- `python3 scripts/validate_harness.py`: `HARNESS VALIDATION OK`.
- `PR_BODY="$(cat /tmp/softbook_worktree_lifecycle_pr_body.md)" python3 scripts/validate_agent_review.py`: `AGENT REVIEW GATE OK`.

## Agent review status

- Reviewer: Codex local worktree-lifecycle review.
- Review status: Passed.
- Blocking findings: No blocking findings.
- Review summary: Governance-only change reviewed for workspace lifecycle ownership, post-merge local sync behavior, harness wiring, and docs mirrors.

## User-visible UI impact

None. This is governance and harness-only work.

## Card make external workspace impact

None.

## Risks and open questions

- The guard is intentionally pure: it validates contract wiring, not the machine's current worktree state, so CI remains deterministic.
- Actual local fast-forward still requires a clean local `main` worktree.

## Follow-up

Use this guard before the next business/UI refactor branch so work starts from current `origin/main` rather than a stale local worktree.
