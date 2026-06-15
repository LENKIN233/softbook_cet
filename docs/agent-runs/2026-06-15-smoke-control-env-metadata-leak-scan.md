# Agent Run Record: smoke control env metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/smoke-control-env-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile and design metadata scanners so smoke control and expected-stage environment keys cannot leak through visible text, accessibility copy, or rendered metadata props.

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
- `spec/runtime-boundaries.json` keeps runtime wiring and smoke controls as implementation hypothesis, not product truth.
- `infra/cloudbase/mobile-runtime-contract.md`, `infra/cloudbase/smoke-softbook-api.mjs`, and `infra/cloudbase/smoke-ios-runtime.sh` document smoke control and expected-stage environment keys used for backend/runtime validation.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps generated, dependency, cache, archive, and sibling external workspace material outside default semantic context.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `SOFTBOOK_CET_SMOKE_ISOLATED_PHONE`, `SOFTBOOK_CET_SMOKE_WRITE`, `SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS`, `SOFTBOOK_CET_EXPECT_INITIAL_STAGE`, `SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE`, and `SOFTBOOK_CET_EXPECT_PURCHASE_STAGE` as exact raw smoke control or expected-stage environment keys.
- The design scanner now treats the same six exact keys as raw metadata in design visual artifacts.
- Broad words such as `smoke`, `expect`, `stage`, `write`, or `membership` remain out of scope to avoid false positives in legitimate implementation notes or product copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `infra/cloudbase/mobile-runtime-contract.md`, `infra/cloudbase/smoke-softbook-api.mjs`, `infra/cloudbase/smoke-ios-runtime.sh`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact smoke control and expected-stage environment keys to raw metadata detection.
- `scripts/check_design_metadata_leaks.mjs`: added exact smoke control and expected-stage environment keys to design visual artifact raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile/design negative fixtures for smoke control env key leakage.
- `docs/agent-runs/2026-06-15-smoke-control-env-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `gh pr view 208 --json number,state,mergeCommit,headRefName,baseRefName,url` -> confirmed PR #208 is merged at `d2c3c4651f0a238dc236dfb6085661bc113f44b9`.
- `git switch -c infra/smoke-control-env-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_smoke_control_env_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-smoke-control-env-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_smoke_control_env_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local design metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection is covered by harness fixtures.
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

- No known blocking risk. The guard is limited to exact smoke control and expected-stage environment keys; broad terms remain out of scope.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
