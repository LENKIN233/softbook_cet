# Agent Run Record: mobile runtime profile metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/mobile-runtime-profile-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so remote runtime profile keys cannot leak into visible text, accessibility copy, or rendered metadata props.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps runtime wiring as implementation hypothesis, not product truth.
- `spec/harness-architecture.json` places mobile/design metadata scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps generated, dependency, cache, archive, and sibling external workspace material outside default semantic context.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `featureModes`, `learningTrack`, `learningSource`, `progressSync`, `spaceState`, and `learningState` as exact raw runtime profile keys when they are rendered into visible text, accessibility copy, or rendered metadata props.
- The visible-copy prop assignment detector now excludes comparison operators such as `value === ...` and arrow function parameter forms, so runtime guards using a variable named `value` are not treated as visible copy assignments.
- Broad terms such as `membership`, `mode`, `state`, `status`, `source`, `data`, and `cards` remain out of scope to avoid false positives in legitimate product copy or implementation code.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `apps/mobile/src/runtime/appRuntimeConfig.ts`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact runtime profile keys and tightened visible-copy prop assignment detection to avoid comparison false positives.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile negative fixtures for runtime profile key leakage.
- `docs/agent-runs/2026-06-15-mobile-runtime-profile-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `gh pr view 203 --json number,state,mergeCommit,headRefName,baseRefName,url` -> confirmed PR #203 is merged at `fe681bf378e1370b57b3b4069082c0b5a6019333`.
- `git switch -c infra/mobile-runtime-profile-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after scanner patch before prop regex fix -> expected false-positive check exposed `value === ...` comparison matches in `appRuntimeConfig.ts`.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after prop regex fix -> `PASS: No metadata leaks detected in visible text.`
- Temporary mobile TSX fixture after the scanner patch -> expected failure on runtime profile key leakage in text, `testID`, `accessibilityHint`, and `accessibilityLabel`.
- Removed the temporary mobile TSX fixture.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mobile_runtime_profile_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-mobile-runtime-profile-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mobile_runtime_profile_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- Whitespace validation: pass.
- PR body design gate validation: pass.
- Agent review body validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally; PR body validation passed.
- Blocking findings: none known.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no accepted design artifact, visual output, screen, copy, reference HTML, or runtime UI changed.

## Card make external workspace impact

- N/A. No sibling external workspace read or content approval action occurred.

## Risks and open questions

- No known blocking risk. The guard is limited to exact runtime profile keys and explicitly excludes broader product/runtime terms that could be legitimate non-leak copy.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
