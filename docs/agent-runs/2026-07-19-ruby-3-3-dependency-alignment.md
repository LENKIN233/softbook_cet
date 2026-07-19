# Agent Run Record: Ruby 3.3 dependency alignment

## Task summary

- Date: 2026-07-19
- Branch: `fix/align-ruby-3-3-dependencies`
- PR: https://github.com/LENKIN233/softbook_cet/pull/422
- Supersedes: Dependabot PR #406 and PR #407 as one compatibility unit
- Summary: Align the mobile Ruby manifest and lock with the required Ruby 3.3 toolchain while upgrading ActiveSupport and concurrent-ruby together so CocoaPods remains executable.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This is mobile build-tool dependency and delivery-governance work only.
- No product behavior, card content, formal content approval, membership state, or launch readiness changes.

## Implementation hypothesis changed

- The mobile `Gemfile`, `Gemfile.lock`, local PR/release profile, and GitHub iOS job must agree on Ruby 3.3.x.
- ActiveSupport 6.1.7.10 cannot safely be combined with concurrent-ruby 1.3.7 in the current CocoaPods process because the latter no longer supplies the implicit Logger load that ActiveSupport 6.1 expects.
- ActiveSupport 7.2.3.1 explicitly depends on `logger` and concurrent-ruby >=1.3.1, so upgrading both dependencies together removes the obsolete `<1.3.4` workaround.
- ActiveSupport remains constrained to the 7.2 patch line instead of allowing an unreviewed future major version.

## Workspace boundary and read scope

- Active source read: the referenced specs, mobile Ruby manifest and lock, delivery Harness section, GitHub PR #406/#407 diffs, and their iOS workflow logs.
- Generated/dependency/cache read: ignored Bundler and CocoaPods outputs were used only for dependency resolution and deployment-lock validation.
- External workspace read: none; `/Users/lenkin/programing/card make` is outside this tooling-only change.

## Files changed

- `apps/mobile/Gemfile`: require Ruby 3.3.x, constrain ActiveSupport to reviewed 7.2 patches, and remove the obsolete concurrent-ruby upper-bound workaround.
- `apps/mobile/Gemfile.lock`: resolve ActiveSupport 7.2.3.1 and concurrent-ruby 1.3.7 under Ruby 3.3.12 while preserving the existing CocoaPods and Xcodeproj locks.
- `scripts/harness_validator/sections/delivery_runtime.py`: reject drift between the required Ruby 3.3 toolchain and the mobile manifest or lock.
- `docs/agent-runs/2026-07-19-ruby-3-3-dependency-alignment.md`: record scope, evidence, validation, and review state.

## Commands run

- RubyGems metadata queries -> confirmed ActiveSupport 7.2.3.1 requires Ruby >=3.1 and concurrent-ruby >=1.3.1; CocoaPods Core 1.15.2 accepts ActiveSupport >=5 and <8.
- PR #407 iOS log review -> reproduced `ActiveSupport::LoggerThreadSafeLevel::Logger (NameError)` with ActiveSupport 6.1.7.10 and concurrent-ruby 1.3.7.
- PR #406 iOS log review -> confirmed ActiveSupport 7.2.3.1 completed the Ruby lock check, Release simulator build, and unsigned archive.
- Ruby 3.3.12 / Bundler 2.4.22 `bundle update --ruby activesupport concurrent-ruby` -> produced the scoped lock update.
- Ruby 3.3.12 / Bundler 2.4.22 `bundle install` -> passed and preserved lock SHA-1 `c0df184f9f48caf7db0072fa2f389841bcf605e3`.
- `bundle check` -> dependencies satisfied.
- Bundled Ruby smoke -> loaded Ruby 3.3.12, ActiveSupport 7.2.3.1, `active_support/logger`, and concurrent-ruby 1.3.7.
- `bundle exec pod install --project-directory=ios --deployment` -> passed with no CocoaPods lock change.
- `python3 scripts/test_validate_harness_runner.py` -> 20 tests passed.
- `python3 scripts/test_harness_module_boundaries.py` -> 18 tests passed.
- `python3 scripts/test_run_local_gates.py` -> 29 tests passed.
- `python3 scripts/validate_harness.py --mode local` -> passed with expected local-only partial completeness.
- `python3 scripts/validate_harness.py --mode full` -> passed, including remote delivery governance.
- Negative `delivery_runtime` fixture with both Ruby anchors reverted to 2.6 -> exited 1 with separate manifest and lock findings; a commented fake Ruby 3.3 declaration did not bypass the line-level check. Both files were restored and the section then passed.
- Exact Node 22.13.0 `scripts/run_local_gates --profile dev` -> 17/17 gates passed; report written only to ignored `exports/local-gates/`.
- Exact Node 22.13.0 and Ruby 3.3.12 `scripts/run_local_gates --profile pr --base origin/main --pr 422` -> 29/29 gates passed; report written only to ignored `exports/local-gates/`.
- Dependabot PR #406 and #407 -> closed only after replacement PR #422 existed, with comments recording their original head SHAs, evidence, and supersession reason.

## Validation results

- Ruby dependency resolution is stable under the required local Ruby 3.3 toolchain.
- ActiveSupport and concurrent-ruby load together, and CocoaPods deployment mode remains valid.
- Harness detects both manifest and lock toolchain drift.
- Runner, module-boundary, local-gate-runner, local/full Harness, negative fixture, `dev`, and strict PR profile validation passed.
- GitHub required checks are pending on the replacement PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None.
- Review summary: The combined update resolves the independently reproduced Logger failure, narrows rather than broadens the supported ActiveSupport range, aligns all Ruby version anchors, and adds non-comment-bypassable drift checks. No app runtime or product behavior changes.

## User-visible UI impact

- N/A. No user-visible screen, copy, interaction, motion, or accessibility behavior changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, or import boundary changes.

## Risks and open questions

- This is an ActiveSupport major-version update, but its repository use is limited to CocoaPods build tooling; clean-runner simulator build and unsigned archive remain mandatory.
- The lock records local Ruby 3.3.12 while GitHub may use another 3.3 patch; `bundle install` must leave the lock unchanged on the clean runner.
- PR #406 and #407 were closed with explicit supersession links after replacement PR #422 was created; neither was merged independently.

## Follow-up

- Require every GitHub check and applicable protected approval before merge, then verify the post-merge `main` run.
