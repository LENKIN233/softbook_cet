# Agent run record: agent run record contract

## Task summary

Add a durable agent-run-record contract so PR-bound governance, harness, user-visible UI, runtime, card handoff, and multi-file refactor work cannot live only in chat history.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/agent-run-record.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/doc-manifest.json`

## Product truth used

- `product_truth`: Softbook CET remains an exam-pass product with single-card flow, high-value interactions, and physical-space knowledge map semantics.
- `product_truth`: Candidate card content production and approval remain outside this repo in `/Users/lenkin/programing/card make`.
- `product_truth`: User-visible UI implementation still requires accepted design artifacts and capability-specific evidence.

## Implementation hypothesis changed

- `implementation_hypothesis`: Durable run records live under `docs/agent-runs/` and are referenced from the PR body through `Run record`.
- `implementation_hypothesis`: The local agent review gate can mechanically reject PR bodies that omit a committed `docs/agent-runs/*.md` reference.

## Workspace boundary and read scope

- Worktree: `/Users/lenkin/programing/softbook_cet_agent_run_records`.
- Branch: `infra/agent-run-records`.
- Original dirty mobile worktree was not edited.
- Read scope was limited to the repo governance specs, harness validator sections, PR body validator, PR template, README/branching mirrors, and the new run-record docs.

## Files changed

- `AGENTS.md`
- `.github/pull_request_template.md`
- `README.md`
- `docs/branching-strategy.md`
- `docs/agent-runs/README.md`
- `docs/agent-runs/TEMPLATE.md`
- `docs/agent-runs/2026-05-21-agent-run-record-contract.md`
- `scripts/validate_agent_review.py`
- `scripts/harness_validator/runner.py`
- `scripts/harness_validator/sections/agent_run_record.py`
- `scripts/harness_validator/sections/design_governance.py`
- `scripts/harness_validator/sections/governance_contracts.py`
- `scripts/harness_validator/sections/prelude.py`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/authority-map.json`
- `spec/doc-manifest.json`
- `spec/evals.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`

## Commands run

- `./scripts/install_git_hooks.sh`
- `python3 scripts/validate_harness.py`
- `PR_BODY="$(cat /tmp/softbook_agent_run_records_pr_body.md)" python3 scripts/validate_agent_review.py`

## Validation results

- `python3 scripts/validate_harness.py`: `HARNESS VALIDATION OK`.
- `PR_BODY="$(cat /tmp/softbook_agent_run_records_pr_body.md)" python3 scripts/validate_agent_review.py`: `AGENT REVIEW GATE OK`.

## Agent review status

- Reviewer: Codex local agent-run-record review.
- Review status: Passed.
- Blocking findings: No blocking findings.
- Review summary: Governance-only change reviewed for spec ownership, harness wiring, PR template enforcement, and docs mirrors.

## User-visible UI impact

None. This PR does not change user-visible UI, visual artifacts, interaction/motion, or physical-space implementation.

## Card make external workspace impact

None. This PR does not produce, approve, import, or smoke-test card content.

## Risks and open questions

- This makes run-record references merge-blocking for PR-bound work; small local-only tasks remain outside this PR contract unless they are prepared for merge.
- The record must stay factual and must not include hidden reasoning, secrets, raw private comments, or unreviewed candidate card content.

## Follow-up

- Apply this record requirement to the next business/refactor PRs so future context survives compaction and PR review.
