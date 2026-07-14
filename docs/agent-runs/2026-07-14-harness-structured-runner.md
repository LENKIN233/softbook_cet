# Agent Run Record: Structured Harness runner

## Task summary

- Date: 2026-07-14
- Branch: `infra/harness-structured-runner`
- PR: https://github.com/LENKIN233/softbook_cet/pull/414
- Summary: Add the first Harness optimization slice: a structured, selectable, timed runner with isolated section diagnostics and machine-readable output, while preserving every existing section check and the no-argument full remote-validation behavior.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change is repository-governance truth only. It does not change product scope, UI, membership, runtime behavior, content, formal approval, or launch readiness.

## Implementation hypothesis changed

- The transitional shared-`exec` runner now parses a formal CLI and records each section's status, duration, findings, and completeness as `harness-result.v1`.
- No-argument execution remains `full`, runs all ten sections, and reads GitHub `main` protection. Local or selected runs are explicitly `partial` and cannot satisfy the PR full-Harness record.
- Explicit `validate(context)` modules, pure-context capability enforcement, section timeouts, and the local quality aggregate remain later PRs; this slice does not mix them into the runner interface change.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, Harness runner and sections, PR review validator, CI workflow, PR template, branching strategy, and run-record conventions.
- Generated/dependency/cache/archive read: existing installed mobile/backend dependencies only for required local tests; ignored `exports/harness-runner/` output for JSON verification.
- External workspace read: read-only status checks performed before implementation; `/Users/lenkin/programing/card make` was not edited and no candidate or approved content was consumed.

## Files changed

- `scripts/harness_validator/runner.py`: add CLI parsing, full/local mode, layer/section selection with declared prerequisites, timing, exception isolation, shared error-list integrity, structured findings, completeness, catalog, profile, JSON, output-file support, and stable exit codes.
- `scripts/harness_validator/sections/prelude.py`: accept the runner-provided remote-guard mode without changing legacy fallback behavior.
- `scripts/test_validate_harness_runner.py`: cover argument errors, compatibility mode, selection, dependencies, exception isolation, error-list replacement, multiple findings, JSON contract, output, no-network local behavior, unavailable-GitHub full behavior, and partial PR-record rejection.
- `scripts/validate_agent_review.py`: prevent `--mode local`, selected, listed, help, compatibility, or uncompleted full-command text from impersonating a completed full Harness validation record.
- `spec/harness-architecture.json`, `spec/agent-harness.json`, and `spec/evals.json`: own and mirror the structured runner and partial-completeness contract.
- `scripts/harness_validator/sections/harness_architecture.py`: enforce the new runner contract and regression coverage.
- `.github/workflows/pr-gates.yml`: pin Python 3.12 and run the runner unit tests in `validate-harness`.
- `.github/pull_request_template.md`, `scripts/harness_validator/sections/delivery_runtime.py`, `scripts/harness_validator/sections/governance_contracts.py`, and `docs/branching-strategy.md`: keep delivery documentation and CI mirrors aligned.

## Commands run

- `python3 scripts/test_validate_harness_runner.py` -> 13 tests passed.
- `python3 scripts/validate_harness.py` -> passed with complete full-mode result and live GitHub protection read.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed and explicitly reported partial completeness.
- Every real section was selected independently in local mode -> all passed; `delivery_runtime` reported its declared `governance_contracts` prerequisite.
- Temporary detached `origin/main` worktree comparison -> old and new full/local baseline results passed; temporary worktree removed and one worktree remained.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `node --test scripts/test_validate_launch_readiness.mjs scripts/test_validate_agent_run_evidence.mjs` -> 21 tests passed.
- `node scripts/validate_launch_readiness.mjs` -> valid and intentionally not ready: 5 pending, 5 blocked, 0 passed.
- `node scripts/validate_agent_run_evidence.mjs` -> passed; 391 pre-cutover index files verified.
- Mobile lint, typecheck, metadata scan, and Jest -> passed; 29 suites and 187 tests.
- Development CloudBase API `npm test` -> 14 tests passed.
- `node scripts/test_validate_dependency_security.mjs && node scripts/validate_dependency_security.mjs` -> policy passed while still reporting the existing CloudBase `lodash.set` high-severity exception.
- Python JSON parse, Ruby YAML parse, and `git diff --check` -> passed.

## Validation results

- Clean baseline behavior is unchanged: old and new no-argument runs both pass, and the compatibility local run still executes all existing local checks.
- Unknown arguments and contradictory remote modes exit 2; check findings exit 1; passing runs exit 0.
- A section exception is attributed by layer/section/type/message and does not suppress later section diagnostics.
- A section cannot replace, clear, or rewrite the shared append-only error list to hide its own finding; collection corruption is itself a structured failure and later diagnostics still run.
- Full output reports `complete` only when all ten sections run and `delivery_runtime` executes the remote guard. Local or selected passes report `partial`.
- A fake `gh` integration test proves local mode does not invoke GitHub; full mode reports GitHub unavailability as a `delivery_runtime` finding.
- A checked partial command plus an unchecked/plain full command cannot satisfy the PR full-Harness validation record.
- GitHub technical validation: [run 29304416322](https://github.com/LENKIN233/softbook_cet/actions/runs/29304416322) on `61427c1a17445d769a4352a01140e4e094ab6ef2` passed all eight technical jobs: design artifact, Harness, mobile, backend, repo health, dependency security, evidence archive, and iOS Release. The Agent review job failed closed only because this record and the PR body were still Pending.

## Binary evidence

- Evidence manifest: N/A; no binary evidence was created.
- Archive: N/A.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None
- Review summary: Fresh post-CI review found no blocking issue in the final 14-file diff. It verified CLI and exit-code semantics, actual remote-guard completeness, section exception and append-only finding isolation, completed-command binding in the PR gate, signed commits, scope boundaries, and the eight successful technical jobs.

## User-visible UI impact

- N/A. No screen, copy, component, interaction, navigation, design artifact, or visible state changed.

## Card make external workspace impact

- N/A. No card JSON, audio, candidate PR, QC record, or formal approval record changed.

## Risks and open questions

- Section code still shares one `exec` environment. This is intentional transitional compatibility and remains the subject of the second Harness PR.
- In-process shared execution cannot safely terminate an arbitrary hung section. Timeout isolation is deferred until sections expose explicit `validate(context)` entrypoints; this PR does not claim timeout coverage.
- Two concurrent Harness processes in the same worktree can still contend over legacy design-governance fixtures. CI executes the runner test and contract serially; fixture isolation remains part of the second Harness PR.
- The existing CloudBase dependency exception remains visible and expires on 2026-08-10; this Harness PR does not resolve or conceal it.

## Follow-up

- Push this review record and require its final SHA to pass all nine required checks before merge; a prior technical run or this review conclusion cannot substitute for the final run.
- After merge, start the second serial PR to replace shared `exec` with explicit `validate(context)` modules and enforce pure-layer capabilities.
