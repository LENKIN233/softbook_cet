# Agent Run Record: mobile local runtime features metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/local-runtime-features-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` cannot leak through visible text, accessibility copy, or static rendered metadata props.

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
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps runtime wiring as implementation hypothesis, not product truth.
- `infra/cloudbase/mobile-runtime-contract.md` documents `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` as an optional remote-runtime smoke/profile environment variable.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps generated, dependency, cache, archive, and sibling external workspace material outside default semantic context.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` as an exact raw runtime environment key when it appears in visible text, accessibility copy, or rendered metadata props.
- The mobile scanner now detects exact raw metadata strings inside static rendered metadata props such as `testID="..."`.
- Internal `new Error(...)` expressions are excluded from visible/rendered metadata checks so parser guard messages such as `Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: ...` are not treated as learner-facing copy.
- The design scanner was not changed: a temporary design fixture with `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` already failed under the existing internal process/implementation term guard.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `infra/cloudbase/mobile-runtime-contract.md`, `apps/mobile/src/runtime/appRuntimeConfig.ts`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES`, static rendered prop scanning, and internal error-expression exclusion for visible/rendered metadata checks.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertion, mobile negative fixtures for text/accessibility/static rendered prop leakage, and a no-leak fixture for the internal local-runtime-feature parser error.
- `docs/agent-runs/2026-06-15-mobile-local-runtime-features-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `gh pr view 205 --json number,state,mergeCommit,headRefName,baseRefName,url` -> confirmed PR #205 is merged at `6fedd4c1f5efaab778c09a5472d85f20679ed0b8`.
- `git switch -c infra/local-runtime-features-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture before the scanner patch -> scanner failed under the existing internal process/implementation term guard, so design scanner was not patched.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after adding the exact key -> exposed the existing internal-error false positive on `Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: ...`.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after internal-error exclusion -> `PASS: No metadata leaks detected in visible text.`
- Temporary mobile TSX fixture after the scanner patch -> expected failure on `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` in Text, static `testID`, and `accessibilityLabel`.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_local_runtime_features_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-mobile-local-runtime-features-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_local_runtime_features_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local design metadata scanner validation: pass.
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

- No known blocking risk. The guard is limited to an exact runtime environment key and a static rendered prop scanner path; broad runtime/product terms remain out of scope.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
