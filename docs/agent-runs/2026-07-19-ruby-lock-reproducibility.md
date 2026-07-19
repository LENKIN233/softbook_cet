# Agent Run Record: Ruby 3.3 lock reproducibility

## Task summary

- Date: 2026-07-19
- Branch: `fix/ruby-3-3-lock-reproducibility`
- PR: N/A
- Summary: Make the committed Ruby dependency lock reproducible under the required Ruby 3.3 toolchain and fail the iOS CI job when `bundle install` mutates `Gemfile.lock`.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This is dependency-toolchain and delivery-governance work only.
- No product behavior, card content, formal content approval, membership state, or launch readiness changes.

## Implementation hypothesis changed

- Ruby dependencies must resolve without changing the committed lock under the repository-required Ruby 3.3 toolchain.
- The iOS Release job must fail immediately when `bundle install` changes `Gemfile.lock`; a successful build after silent lock mutation is not reproducible evidence.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, `.github/workflows/pr-gates.yml`, `apps/mobile/Gemfile`, `apps/mobile/Gemfile.lock`, local-gate release catalog, Harness delivery validator, and completed iOS workflow logs.
- Generated/dependency/cache/archive read: the ignored `apps/mobile/vendor/bundle` and generated CocoaPods metadata were used only to reproduce Ruby 3.3 resolution and validate the deployment lock.
- External workspace read: none; `/Users/lenkin/programing/card make` is outside this tooling-only change.

## Files changed

- `apps/mobile/Gemfile.lock`: select `CFPropertyList` 3.0.8, the latest locked version compatible with Ruby 3.3 instead of 3.0.9, which requires Ruby `<3.2`.
- `.github/workflows/pr-gates.yml`: verify that `bundle install` leaves `Gemfile.lock` unchanged before native tools and builds run.
- `scripts/harness_validator/sections/delivery_runtime.py`: require the Ruby lock-drift CI step and command.
- `scripts/harness_validator/sections/governance_contracts.py`: keep the fixed delivery-contract expectation synchronized with the stricter iOS Release command.
- `spec/repo-delivery-contract.json`: make Ruby dependency installation and lock-drift rejection explicit in the `ios_release` command contract.
- `docs/agent-runs/2026-07-19-ruby-lock-reproducibility.md`: record scope, evidence, validation, and review state.

## Commands run

- `gem specification CFPropertyList -r -v 3.0.9 required_ruby_version` under Ruby 3.3 -> confirmed the gem requires Ruby `<3.2`.
- `gh run view 29671922382 --job 88152437321 --log | rg ...` -> confirmed main CI fetched and installed 3.0.8 instead of committed 3.0.9 before reporting success.
- `PATH=<Ruby 3.3.12> bundle _2.4.22_ install` -> completed; `Gemfile.lock` hash remained `f7552ec87e69eb5f6149dc774aefc49ae7ad372e` before and after.
- `PATH=<Ruby 3.3.12> bundle _2.4.22_ check` -> dependencies satisfied.
- `PATH=<Ruby 3.3.12> bundle _2.4.22_ exec pod install --project-directory=ios --deployment` -> passed with no CocoaPods lock changes.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-gates.yml')"` -> workflow YAML parsed.
- `jq empty spec/repo-delivery-contract.json` -> contract JSON parsed.
- `python3 scripts/test_validate_harness_runner.py` -> 20 tests passed after synchronizing the fixed delivery-contract expectation.
- `python3 scripts/test_harness_module_boundaries.py` -> 18 tests passed.
- `python3 scripts/test_run_local_gates.py` -> 29 tests passed.
- Initial `python3 scripts/test_validate_harness_runner.py` -> correctly exposed the stale fixed `ios_release` expectation in `governance_contracts.py`; the contract assertion was then synchronized.
- `python3 scripts/validate_harness.py --mode local` -> passed with expected partial completeness for local-only execution.
- `python3 scripts/validate_harness.py --mode full` -> passed, including remote delivery governance.
- Negative `delivery_runtime` validation with the lock-verification step temporarily removed -> exited 1 and reported both the missing step name and missing lock-check command; the workflow was restored afterward.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 -c './scripts/run_local_gates --profile dev'` -> 17/17 gates passed; report written only to ignored `exports/local-gates/`.

## Validation results

- Ruby 3.3.12 and Bundler 2.4.22 resolve the committed Ruby lock without mutation.
- CocoaPods deployment mode accepts the existing pod lock under the corrected Ruby lock.
- Workflow and delivery-contract syntax validation passed.
- Runner, module-boundary, local-gate-runner, local/full Harness, explicit negative lock-drift, and `dev` profile validation passed.
- Local PR profile, GitHub required checks, and the PR iOS Release build are pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None.
- Review summary: The corrected transitive lock is compatible with the required Ruby 3.3 toolchain, the workflow check is scoped to the tracked lock, and both delivery validator layers enforce the new contract. No product truth or runtime behavior changes.

## User-visible UI impact

- N/A. No user-visible screen, copy, interaction, motion, or accessibility behavior changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, or import boundary changes.

## Risks and open questions

- The workflow change is formal-governance-sensitive and must pass the protected product-owner approval path before merge.
- GitHub iOS Release remains authoritative for clean-runner Ruby 3.3 and Xcode verification.

## Follow-up

- Commit, push, open the PR, run the strict PR profile, and require all GitHub checks before merge.
