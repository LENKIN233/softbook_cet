# Agent Run Record: Repository auto-merge guard

## Task summary

- Date: 2026-07-21
- Branch: `infra/guard-auto-merge-setting`
- PR: pending
- Summary: Codify the GitHub repository settings required by the automatic
  delivery path after PR #432 exposed that branch protection required
  auto-merge while the repository-level feature was disabled.

## Referenced specs

- `spec/authority-map.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/harness-architecture.json`
- `spec/workspace-boundary.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This change governs repository delivery and does not alter CET product
  behavior, content, formal approval, or launch readiness.

## Implementation hypothesis changed

- The automatic delivery path now explicitly requires `main` as the default
  branch, enabled GitHub auto-merge, automatic deletion of merged topic
  branches, and squash-only merge methods.
- Full Harness and remote repository health both fail closed when any required
  repository setting is missing or has drifted.

## Workspace boundary and read scope

- Active truth/source read: the referenced governance specs,
  `scripts/report_repo_health.mjs`, its tests, Harness delivery/governance
  sections, workflow wiring, and active delivery documentation.
- Generated/dependency/cache/archive read: ignored local gate and repository
  health reports under `exports/`; no generated artifact was used as truth.
- External workspace read: none.

## Files changed

- `spec/agent-harness.json`: declare required GitHub repository settings.
- `spec/repo-delivery-contract.json`: bind remote health to those settings.
- `spec/evals.json`: require delivery explanations to guard auto-merge.
- `scripts/harness_validator/sections/delivery_runtime.py`: validate live
  repository settings in full Harness mode.
- `scripts/harness_validator/sections/governance_contracts.py`: enforce the
  spec mirrors and evaluation contract.
- `scripts/harness_validator/sections/harness_architecture.py`: preserve the
  full-Harness auto-merge drift regression.
- `scripts/report_repo_health.mjs`: read, report, and validate repository-level
  merge automation settings through the GitHub REST API.
- `scripts/test_report_repo_health.mjs`: cover missing and drifted settings.
- `scripts/test_validate_harness_runner.py`: prove full Harness rejects a
  disabled repository auto-merge setting.
- `docs/branching-strategy.md`: document the enforced delivery prerequisite.
- `docs/release/README.md`: document remote health coverage.
- `docs/agent-runs/2026-07-21-repository-auto-merge-guard.md`: this record.

## Commands run

- `gh api --method PATCH repos/LENKIN233/softbook_cet -F allow_auto_merge=true`
  -> enabled the repository feature after the protected merge path rejected a
  normal merge and auto-merge was unavailable.
- `node scripts/test_report_repo_health.mjs` -> passed all repository-health
  positive and negative cases, including missing, null, and drifted repository
  settings.
- `python3 scripts/test_validate_harness_runner.py` -> passed 21 tests,
  including full-Harness rejection of disabled auto-merge.
- `python3 scripts/validate_harness.py --mode local --profile` -> all 15
  sections passed with partial/local completeness.
- `python3 scripts/validate_harness.py --profile` -> all 15 sections passed,
  including live GitHub repository settings.
- `node scripts/report_repo_health.mjs --full-tree --remote --strict
  --allow-dirty --expected-max-worktrees 1 --expected-max-stashes 0
  --expected-max-topic-branches 1` -> passed; the only warning was the expected
  missing upstream before first push.
- `./scripts/run_local_gates --profile dev` under the interactive shell ->
  `passed_with_exception` because Node 25.9.0 and Ruby 2.6.10 differed from the
  pinned toolchain; this run is not used as complete evidence.
- `PATH="/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH"
  ./scripts/run_local_gates --profile dev` -> 17/17 passed with Python 3.12.13,
  Node 22.13.0, Ruby 3.3.12, and no safe exceptions.

## Validation results

- Static JSON, JavaScript, Python, and diff checks passed.
- Live GitHub settings were read as `main`, auto-merge enabled, merged branch
  deletion enabled, and squash-only merge methods.
- Exact-toolchain dev gates passed 17/17; report:
  `exports/local-gates/20260720T183545Z-ea6c3b4a-dev-90974/report.json`.
- Full Harness passed all 15 sections with the live remote guard executed.
- GitHub required checks: pending PR creation.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none after checking JSON-object handling, remote setting
  completeness, error attribution, test isolation, and repository-report shape.

## User-visible UI impact

- N/A. No mobile or web UI files change.

## Card make external workspace impact

- N/A. No card payload, review state, audio, or external workspace file changes.

## Risks and open questions

- Pull-request and push runs intentionally do not receive the remote-health
  administration token. Live drift is checked by an authenticated full local
  Harness run and by scheduled/manual trusted-main health runs.
- Green governance checks do not approve content or establish launch readiness.

## Follow-up

- After this guard is merged and verified on `main`, define the owner contract
  for idempotent `learning-events.v2` before replacing legacy learning
  snapshots.
