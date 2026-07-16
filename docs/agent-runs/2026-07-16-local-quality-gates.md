# Agent Run Record: Local quality gates

## Task summary

- Date: 2026-07-16
- Branch: `infra/local-quality-gates`
- PR: `#417`
- Summary: Add an independent `dev` / `pr` / `release` local quality entrypoint with structured reports, staged diagnostics, explicit timeouts, OS-enforced offline gates, redacted logs, strict PR context, visible safety exceptions, and tracked-worktree integrity verification.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change only adds repository quality orchestration. It does not change product scope, UI, membership, runtime behavior, card content, formal approval, or launch readiness.

## Implementation hypothesis changed

- `scripts/run_local_gates` is independent from `validate_harness.py`; it composes existing Harness, mobile, backend, dependency, evidence, repository-health, LFS, CocoaPods, and iOS build commands without moving runtime smoke into a Harness layer.
- `dev` has no network-enabled gates. Every `network=false` command also runs under an operating-system outbound-network boundary; the current macOS implementation uses `sandbox-exec`, and an unsupported platform fails closed.
- `pr` requires one open PR whose base, branch, and remote head SHA match the local checkout. It then evaluates the current PR body, full remote Harness, dependency exceptions, strict local/remote repository health, LFS, and remote evidence.
- A caller-provided `--base` must resolve to the exact GitHub PR `baseRefOid`; malformed GitHub response fields or a stale/different base fail closed before diff-based gates run.
- `release` extends `pr`, requires macOS, and adds Ruby/Bundler, CocoaPods deployment-lock, Release simulator, and unsigned archive gates.
- Results use `local-gate-report.v1`; `passed_with_exception`, `deferred`, and formal-state boundaries are explicit. Reports, logs, and build outputs stay under ignored `exports/local-gates/`.

## Workspace boundary and read scope

- Active truth/source read: the referenced governance specs, existing Harness implementation/tests, workflow, PR template, branching documentation, mobile/backend package commands, dependency validator, repository-health validator, evidence validator, and iOS workflow commands.
- Generated/dependency/cache/archive read: existing installed mobile/backend dependencies only to execute their declared commands; ignored `exports/local-gates/` reports and logs were inspected as runtime evidence.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `scripts/run_local_gates` and `scripts/local_gates/{model,execution,checks,catalog,runner}.py`: executable entrypoint, explicit models, process isolation/redaction, special checks, gate catalog, and report orchestration.
- `scripts/test_run_local_gates.py`: negative and positive runner coverage for arguments, schema, collection, fail-fast, exceptions, timeouts, network denial, redaction, toolchains, PR context, dependency exceptions, strict health delegation, workspace integrity, and module ownership.
- `spec/harness-architecture.json`, `spec/authority-map.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/evals.json`: publish and mirror the local gate contract without changing product truth.
- `scripts/harness_validator/sections/{harness_architecture,governance_contracts,delivery_runtime}.py`: enforce the new contract, CI command, and documentation mirrors.
- `.github/workflows/pr-gates.yml`, `.github/pull_request_template.md`, `AGENTS.md`, `README.md`, and `docs/branching-strategy.md`: run the new unit tests and document the local feedback boundary.

## Commands run

- `python3 scripts/test_run_local_gates.py` and `python3 -X dev scripts/test_run_local_gates.py` -> 29 tests passed after modularization, report-contract validation, GitHub response-shape checks, and base-ref input hardening.
- `python3 -m py_compile scripts/run_local_gates scripts/local_gates/*.py scripts/test_run_local_gates.py` -> passed.
- `python3 scripts/validate_harness.py --mode local` -> passed, 15/15 Harness sections selected, intentionally partial with no remote guard.
- `python3 scripts/validate_harness.py` -> passed, 15/15 sections with the required GitHub protection read.
- `scripts/run_local_gates --profile dev` -> complete `passed_with_exception`; 16 passed gates plus the explicit dev Node-version exception, zero failed/skipped/deferred gates, no remote checks, and tracked worktree unchanged.
- Five final warm `dev` runs -> 5.694 s, 5.773 s, 5.754 s, 5.794 s, and 5.809 s report duration; median 5.773 s.
- An intentional outbound socket attempt under the selected OS isolation mechanism -> denied; the regression is covered by `test_supported_network_isolation_blocks_outbound_socket`.
- Initial OS-isolated Jest run exposed Watchman socket access and failed. The local catalog now uses Jest `--no-watchman`; all test suites still run and the isolated `dev` profile passes.
- Dependency policy tests and `node scripts/validate_dependency_security.mjs` -> passed while explicitly reporting 3 high CloudBase `lodash.set` findings under advisory `GHSA-P6MC-M468-83GW`; mobile reported 0 production vulnerabilities.
- `node scripts/test_report_repo_health.mjs` -> passed oversized historical blob, multi-worktree, stash, and stale-branch negative fixtures.
- Agent evidence tests -> 4 passed; remote evidence verification passed. `git lfs fsck` -> passed.
- `scripts/run_local_gates --profile pr --pr 417 --base origin/main` -> complete failed report with 26/29 passed, one visible dependency exception, and only the expected strict Node/Ruby mismatch plus Pending Agent review failures; PR/base/head context, full Harness, strict repo health, LFS, remote evidence, and tracked-worktree integrity passed.
- `scripts/run_local_gates --profile release --pr 417 --base origin/main` -> complete failed report with 31/34 passed, the same explicit exception/failures, and all five release gates passed: macOS, Bundler, CocoaPods deployment-lock, Release simulator build, and unsigned archive (`ARCHIVE SUCCEEDED`).
- First GitHub run `29479409013` exposed a shallow-checkout dependency in `test_pr_context_rejects_malformed_remote_fields_and_stale_base`: `HEAD~1` was unavailable on CI. The regression now mocks two distinct valid SHA values and tests stale-base semantics without assuming checkout depth.
- Final log review found that credential assignment redaction treated the status prefix `PASS: No ...` as a bare `pass` secret and changed diagnostic meaning. Redaction now preserves the narrow uppercase `PASS: No|OK` status form while still redacting bare `pass=<value>`, with both paths covered by the log regression.

## Validation results

- The local gate package is split by owner: model 85 lines, execution 398, checks 390, catalog 406, and runner 537; unit tests enforce upper bounds and owner markers.
- Unknown arguments return 2. Gate failures return 1. A complete pass or allowlisted `passed_with_exception` returns 0.
- Default execution collects every gate. Exceptions and timeouts are attributed and isolated. Diagnostic `--fail-fast` can never create a complete passing report.
- Logs redact sensitive arguments, environment values, bearer/token patterns, and multiline PR bodies. Raw PR bodies are never persisted.
- The current local toolchain is Python 3.12.13, Node 25.9.0, and Ruby 2.6.10. `dev` reports the compatible Node drift; `pr` and `release` fail strict Node/Ruby matching until run with Node 22.13.0 and Ruby 3.3.x.
- Local release commands still ran after the strict preflight finding: CocoaPods completed in 7.111 s, simulator Release build in 245.191 s, and unsigned archive in 176.374 s. The complete release report took 500.235 s and preserved the tracked worktree.
- GitHub required checks remain authoritative. The local report explicitly sets PR review, content approval, and launch readiness updates to false.

## Binary evidence

- Evidence manifest: N/A; no tracked binary evidence was created.
- Generated reports and build products: ignored under `exports/local-gates/`.

## Agent review status

- Reviewer: Codex
- Status: Pending
- Blocking findings: Pending fixed GitHub technical round and final required checks.
- Review summary: Pending.

## User-visible UI impact

- N/A. No screen, copy, component, interaction, navigation, design artifact, or visible state changed.

## Card make external workspace impact

- N/A. No card JSON, audio, candidate PR, QC record, or formal approval record changed.

## Risks and open questions

- Linux hosts require a usable `bwrap` network namespace; unsupported or unusable isolation fails closed instead of silently running offline gates with network access.
- The current Mac cannot honestly pass strict `pr` or `release` toolchain checks until Node 22.13.0 and Ruby 3.3.x are selected. This is a surfaced environment blocker, not an allowlisted PR exception.
- Dependency-security exceptions are only accepted when the existing policy validator passes; the PR profile must still display advisory severity and vulnerability counts.
- Local reports improve feedback but do not replace GitHub checks or external launch/account/content evidence.

## Follow-up

- Push the shallow-checkout-independent regression fix and require a complete GitHub technical round before changing Agent review from Pending.
- Require all final checks on a signed review commit before merge.
