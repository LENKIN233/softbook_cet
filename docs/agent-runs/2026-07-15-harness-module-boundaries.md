# Agent Run Record: Harness module boundaries

## Task summary

- Date: 2026-07-15
- Branch: `infra/harness-module-boundaries`
- PR: https://github.com/LENKIN233/softbook_cet/pull/415
- Summary: Replace the shared Harness execution environment for nine non-design sections with explicit `validate(context)` modules, one bounded worker process per section, least-privilege contexts, and AST-enforced capability boundaries. Preserve the existing design-governance checks behind one declared transitional adapter for the next serial PR.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change is repository-governance truth only. It does not change product scope, UI, membership, runtime behavior, card content, formal approval, or launch readiness.

## Implementation hypothesis changed

- Nine non-design sections now export `validate(context)` and run in independent Python workers with a default 30-second timeout. Exceptions, worker startup/protocol failures, capability violations, and timeouts are attributed to the owning layer and section without suppressing later diagnostics.
- Read-only sections receive no command, network, remote-guard, or temporary-directory capability. AST validation rejects non-allowlisted imports, mutating calls, executable top-level statements, and definition-time decorators/defaults before execution.
- Only `delivery_runtime` receives a capability context. Its Git reads are exact-command allowlisted, GitHub access is one simple GET, the local selector validator is path allowlisted, and temporary files are isolated.
- `design_governance` remains byte-for-byte in its existing section and is the only declared `exec` adapter. The adapter is transitional, forbids obvious remote imports/commands, and must be deleted after the design split and Agent-review regression move in the next PR.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, Harness runner/sections/tests, PR workflow/template, branching strategy, and run-record conventions.
- Generated/dependency/cache/archive read: installed mobile/backend dependencies for required tests; ignored iOS generated code, Pods, `/tmp` DerivedData/archive, and temporary Harness JSON parity artifacts.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `scripts/harness_validator/context.py`, `capability_ast.py`, `section_worker.py`, and `legacy.py`: define explicit contexts, AST guards, isolated worker protocol, and the single transitional design adapter.
- `scripts/harness_validator/runner.py`: replace shared `exec` execution with section workers, timeout/process-group termination, structured worker failures, and stable remote-guard aggregation.
- `scripts/harness_validator/sections/{prelude,truth_mirrors,harness_architecture,product_contract_mirrors,visual_language,workspace_boundary,governance_contracts,agent_run_record,delivery_runtime}.py`: migrate nine sections to explicit module entrypoints without changing their check outcomes.
- `scripts/test_validate_harness_runner.py` and `scripts/test_harness_module_boundaries.py`: cover worker/error/timeout isolation, stable JSON, capability enforcement, every layer's ownership boundary, exact contexts, and the lone legacy `exec` path.
- `spec/harness-architecture.json`, `spec/agent-harness.json`, and `spec/evals.json`: own and mirror the vnext-3 module, worker, timeout, context, capability, and transitional-adapter contracts.
- `scripts/harness_validator/sections/harness_architecture.py`: enforce the vnext-3 contract and its implementation/test anchors.
- `.github/workflows/pr-gates.yml`, `.github/pull_request_template.md`, `docs/branching-strategy.md`, and delivery-governance mirrors: make the module-boundary test part of CI and normal PR validation.

## Commands run

- `python3 scripts/test_validate_harness_runner.py` -> 17 tests passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 9 tests passed, including an intentional owner-contract break for every Harness layer.
- `python3 scripts/validate_harness.py --mode local` -> passed, 10/10 sections, explicitly partial with no remote access.
- `python3 scripts/validate_harness.py --format json` -> passed, 10/10 sections, complete with a live GitHub protection read and no leaked worker-protocol fields.
- Each migrated section selected independently in local mode -> normalized old/new status, selection, completeness, and findings parity passed 9/9 against base `84239f033f9992d27e571ba7f0cae4510b866018`.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- Launch-readiness tests and validator -> 17 tests passed; contract valid and intentionally not ready: 5 pending, 5 blocked, 0 passed.
- Agent-run-evidence tests -> 4 tests passed; local evidence index validation passed with 391 indexed files.
- Remote evidence archive verification -> not completed locally. The 162,388,780-byte public Release asset was reachable, but local throughput was approximately 40-50 KB/s and the bounded download restarted; the attempt was terminated and remains required in the GitHub `evidence-archive` job.
- Dependency policy/normalization/repository-health tests -> passed. The report still exposes the existing CloudBase `lodash.set` high-severity exception (3 high findings), not zero vulnerabilities.
- Mobile lint, typecheck, metadata scans, and Jest -> passed; 29 suites and 187 tests.
- Development CloudBase API `npm test` -> 14 tests passed.
- `bundle exec pod install --project-directory=ios --deployment` -> passed with no lock drift.
- Release simulator build and unsigned device archive -> `BUILD SUCCEEDED` and `ARCHIVE SUCCEEDED`; outputs were written under `/tmp`.
- `git lfs fsck` -> passed. `git fsck --full` -> no corruption; only existing unreachable objects were reported.
- JSON parsing, Python compilation, `git diff --check`, and tracked-worktree pollution checks -> passed.

## Validation results

- The pre-change local/full and per-section baselines were captured before migration. After migration, all nine non-design selected results match after removing timestamps and durations; design behavior remains on the unchanged legacy section.
- A timed-out section has its whole process group terminated, receives a `timeout` finding, and does not suppress a later section finding.
- Section errors are no longer shared. A section starts with an empty finding list and cannot clear or replace another section's diagnostics.
- Worker startup, nonzero exit, malformed JSON protocol, raised exception, and static capability failure each have distinct structured finding types.
- The result remains complete only when all ten sections run and `delivery_runtime` actually attempts the full-mode remote guard. Internal worker fields never appear in `harness-result.v1` output.
- Local Python is 3.12.13. Shell validation used Node 25.9.0 and Ruby 2.6.10; Xcode selected the configured Node 24.15.0. Exact Node 22.13.0 and Ruby 3.3 reproduction remains a required GitHub CI result.

## Binary evidence

- Evidence manifest: N/A; no repository binary evidence was created.
- Archive: N/A.

## Agent review status

- Reviewer: Pending
- Status: Pending
- Blocking findings: Pending fresh review and required GitHub checks.

## User-visible UI impact

- N/A. No screen, copy, component, interaction, navigation, design artifact, or visible state changed.

## Card make external workspace impact

- N/A. No card JSON, audio, candidate PR, QC record, or formal approval record changed.

## Risks and open questions

- `design_governance` remains the only legacy `exec` section and still owns temporary design fixtures plus Agent-review regressions. Its split and concurrent fixture isolation are intentionally the next serial PR; this PR does not claim that work complete.
- AST enforcement is a repository policy guard, not an operating-system sandbox. Worker process isolation, context omission, exact command allowlists, and timeout termination provide the runtime boundaries for this phase.
- Local Node/Ruby versions differ from CI; GitHub must run all technical jobs before review can pass.
- The 154.9 MiB evidence archive could not be fully rehashed over the current local link. GitHub `evidence-archive` must pass on the final commit.
- The existing CloudBase dependency exception remains visible and expires on 2026-08-10; this Harness PR does not resolve or conceal it.

## Follow-up

- Open the PR with review status Pending. Require all eight technical jobs to pass, perform a fresh final-diff review, update this record and the PR body to Passed, then require all nine checks on the final SHA before squash merge.
- After merge, start the next serial PR to split `design_governance`, move Agent-review regressions to delivery governance, isolate every design fixture, and delete `scripts/harness_validator/legacy.py`.
