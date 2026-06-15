# Agent Run Record: smoke endpoint helper metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/smoke-endpoint-helper-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile and design metadata scanners so runtime smoke endpoint helper names cannot leak through visible mobile text, accessibility copy, rendered metadata props, or design visual artifacts.

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
- `spec/runtime-boundaries.json` keeps CloudBase runtime smoke wiring as implementation hypothesis, not product truth.
- `infra/cloudbase/smoke-softbook-api.mjs` defines local endpoint helper names used to exercise remote membership entitlement, learning card-source, and membership mutation endpoints during runtime smoke.
- `apps/mobile/src/auth`, `apps/mobile/src/sync`, `apps/mobile/src/space`, and `apps/mobile/src/membership` contain legitimate repository API names such as `requestSmsCode`, `verifySmsCode`, `syncDailyProgress`, `syncLearningState`, `syncSpaceState`, `startMembershipTrial`, `purchaseMembership`, and `dismissMembershipRecovery`; those names were not added in this run.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps generated, dependency, cache, archive, and sibling external workspace material outside default semantic context.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `loadMembershipEntitlement`, `loadLearningCardSource`, `runMembershipMutation`, and `parseEntitlement` as exact raw runtime smoke endpoint helper names.
- The design scanner now treats the same four exact names as raw metadata in design visual artifacts.
- Broad words such as `load`, `membership`, `source`, `mutation`, `parse`, or endpoint helper names shared with mobile repository APIs remain out of scope to avoid false positives.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `infra/cloudbase/mobile-runtime-contract.md`, `infra/cloudbase/smoke-softbook-api.mjs`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact runtime smoke endpoint helper names to raw metadata detection.
- `scripts/check_design_metadata_leaks.mjs`: added exact runtime smoke endpoint helper names to design visual artifact raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile/design negative fixtures for runtime smoke endpoint helper-name leakage.
- `docs/agent-runs/2026-06-15-smoke-endpoint-helper-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/smoke-endpoint-helper-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_smoke_endpoint_helper_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-smoke-endpoint-helper-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_smoke_endpoint_helper_pr_body.md` -> `AGENT REVIEW GATE OK`

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

- No known blocking risk. The guard is limited to exact runtime smoke endpoint helper names that are not shared with current mobile repository APIs.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
