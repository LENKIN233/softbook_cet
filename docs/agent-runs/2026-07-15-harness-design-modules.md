# Agent Run Record: Harness design modules

## Task summary

- Date: 2026-07-15
- Branch: `infra/harness-design-modules`
- PR: https://github.com/LENKIN233/softbook_cet/pull/416
- Summary: Split the 4,179-line legacy design-governance section into six explicit modules, move Agent-review regressions to delivery governance, isolate fixture capabilities in system temporary directories, and remove the final Harness `exec` adapter.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This is repository-governance truth only. It does not change product scope, UI, membership, runtime behavior, card content, formal approval, or launch readiness.

## Implementation hypothesis changed

- Harness now has 15 explicit `validate(context)` sections. Design contracts, mobile metadata regressions, design metadata regressions, design-search regressions, and PR design-gate regressions are independently attributable; Agent-review regressions belong to delivery governance.
- Fixture sections receive a section-exact validator allowlist, system temporary roots, controlled file-copy/removal helpers, and only the `PR_BODY` environment override. Direct process, network, arbitrary temporary-directory imports, repository-derived writes, and runtime `exec` are rejected.
- `scripts/check_design_metadata_leaks.mjs` accepts an explicit `--root` for isolated fixture tests while preserving repository-root behavior by default. Design-search external fixtures require an internal flag and a `softbook-*` directory under the operating-system temporary root.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, Harness runner/context/sections/tests, local design validators, workflow/template, branching strategy, and prior Agent run record.
- Generated/dependency/cache/archive read: ignored Python bytecode and `/tmp` parity/result artifacts only.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `scripts/harness_validator/sections/*.py`: replace the legacy design section with six explicit modules and move Agent-review regressions to delivery governance.
- `scripts/harness_validator/{runner,section_worker,context,capability_ast}.py`: register 15 sections, remove legacy dispatch, add fixture capabilities, enforce ownership and repository-path boundaries, and reject direct side effects.
- `scripts/harness_validator/legacy.py` and `scripts/harness_validator/sections/design_governance.py`: removed after parity capture.
- `scripts/check_design_metadata_leaks.mjs`, `scripts/test_check_design_metadata_leaks.mjs`, and `scripts/validate_design_search_run.py`: support isolated system fixtures with regression coverage.
- `scripts/test_harness_module_boundaries.py` and `scripts/test_validate_harness_runner.py`: cover explicit modules, every layer owner, fixture capability rejection, timeout/error isolation, local no-network behavior, and zero runtime `exec`.
- `spec/harness-architecture.json`, `spec/agent-harness.json`, `spec/evals.json`, `scripts/harness_validator/sections/harness_architecture.py`, workflow/template, and branching strategy: publish and mirror the vnext-4 architecture.

## Commands run

- Pre-change full and selected design baselines, source SHA-256 values, and six independently executable legacy segment results were captured under `/tmp/softbook-harness-pr2b-baseline/`.
- `python3 scripts/test_validate_harness_runner.py` -> 17 tests passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 16 tests passed, including rejection of repository-derived and unproven fixture writes.
- `node --test scripts/test_check_design_metadata_leaks.mjs` -> 3 tests passed.
- Each of the six explicit replacement modules -> passed independently with no findings or exceptions.
- `python3 scripts/validate_harness.py --mode local --format json` -> passed, 15/15 sections, intentionally partial and no remote guard.
- `python3 scripts/validate_harness.py --mode full --format json` -> passed, 15/15 sections, complete with remote protection read.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- Launch-readiness tests -> 17 tests passed; tracked contracts remain valid and intentionally `ready=false` with 5 pending, 5 blocked, and 0 passed.
- Agent-run-evidence tests -> 4 tests passed; remote verification passed with 391 pre-cutover index files and no errors.
- Dependency policy, React Native podspec normalization, and repository-health tests -> passed. Dependency validation still exposes the existing CloudBase `lodash.set` exception with 3 high findings; it does not report zero vulnerabilities.
- Mobile `npm ci`, lint, metadata scans, typecheck, and Jest -> passed; 29 suites and 187 tests.
- Development CloudBase API `npm ci` and tests -> 14 tests passed; install output independently reported the same 3 high findings.
- `bundle install` and `bundle exec pod install --project-directory=ios --deployment` -> passed with no tracked lock drift.
- Release simulator build and unsigned device archive -> `BUILD SUCCEEDED` and `ARCHIVE SUCCEEDED`; outputs are under `/tmp`.
- `git lfs fsck` -> passed. `git fsck --full` -> no corruption; only existing dangling objects were reported.
- Strict repository health before commit -> expected failure only for the intentional dirty worktree.
- Strict repository health after the signed implementation commit and push -> passed with 1 worktree, 0 dirty worktrees, 0 stashes, 1 active topic branch, 0 missing upstreams, and 0 oversized ordinary Git blobs.
- GitHub Actions technical baseline on signed commit `d2f0b62a140f5f7d11e7c7aa8de7e17ebde0066e` -> all 8 technical jobs passed in run `29426056666`: design artifact gate, Harness, mobile, backend, dependency security, iOS Release, repository health, and evidence archive. The Agent-review job failed as designed while the PR body still recorded `Pending`.

## Validation results

- Old full baseline: 10/10 sections passed with zero findings. New full result: 15/15 sections passed with zero findings; completeness and remote-guard semantics are unchanged.
- Every legacy design segment and corresponding explicit module passed independently. The increased section count changes diagnostic attribution only.
- Fixture paths are outside the repository and are removed on context exit. Tracked repository files are not used as negative-test scratch files.
- Direct fixture writes must be statically proven to derive from an active fixture root; repository-derived and unknown-provenance paths fail before section execution.
- Local Python is 3.12.13. Local Node is 25.9.0 and Ruby is 2.6.10; exact Node 22.13.0 and Ruby 3.3 reproduction remains a required GitHub CI result.
- GitHub CI reproduced the technical checks with the workflow-pinned toolchains, including the Release simulator build and unsigned archive.

## Binary evidence

- Evidence manifest: N/A; no repository binary evidence was created.
- Archive: N/A.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None
- Review summary: The final governance-only diff, old/new result parity, explicit context and AST boundaries, fixture isolation, local validation, and first-round GitHub technical results were reviewed. No blocking defect or semantic weakening was found.

## User-visible UI impact

- N/A. No screen, copy, component, interaction, navigation, design artifact, or visible state changed.

## Card make external workspace impact

- N/A. No card JSON, audio, candidate PR, QC record, or formal approval record changed.

## Risks and open questions

- AST enforcement is a repository policy guard rather than an operating-system sandbox. Worker isolation and least-privilege runtime contexts remain the executable boundary.
- The design and Agent-review validators keep their existing semantics; this PR changes fixture storage and diagnostic ownership only.
- Local Node and Ruby versions differ from CI; the first GitHub technical run passed on the workflow-pinned versions.
- The existing CloudBase dependency exception still contains 3 high-severity `lodash.set` findings. It remains visible and is not represented as zero vulnerabilities.

## Follow-up

- Require all 9 GitHub jobs, including Agent review, to pass on the final signed review commit before merge.
- After merge, start the serial local-quality entrypoint PR; do not mix it into this architecture change.
