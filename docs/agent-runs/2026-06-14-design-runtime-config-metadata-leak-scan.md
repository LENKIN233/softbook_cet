# Agent Run Record: design runtime config metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-runtime-config-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw remote runtime config, endpoint, env, and injected-profile keys cannot appear in design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/authority-map.json` assigns authentication, sync, and purchase truth to `spec/account-sync-contract.json`; runtime hypotheses remain owned by `spec/runtime-boundaries.json`.
- `spec/account-sync-contract.json` requires phone SMS auth, daily-level sync, shared membership entitlement, and purchase recovery behavior, without making exact endpoint names product truth.
- `spec/runtime-boundaries.json` keeps exact REST endpoint design and runtime wiring details as implementation hypotheses.
- `spec/harness-architecture.json` places design artifact scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design metadata scanner already rejected raw card, source, interaction, answer-key, result/session, interaction-state, auth/sync, progress, membership, and mutation queue payload keys in design artifacts. It now also rejects exact remote runtime config and endpoint keys in visible text, accessibility text, generated content, or source tokens.
- Added exact keys: `apiKey`, `apiKeyHeader`, `baseUrl`, `remoteConfig`, `requestCodeEndpoint`, `verifyCodeEndpoint`, `dismissRecoveryEndpoint`, `entitlementEndpoint`, `purchaseEndpoint`, `startTrialEndpoint`, `trackQueryParam`, `__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__`, `SOFTBOOK_CET_REMOTE_BASE_URL`, `SOFTBOOK_CET_REMOTE_API_KEY`, and `SOFTBOOK_CET_LEARNING_TRACK`.
- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` remains out of scope for parity with the mobile scanner PR; covering it safely should happen after the mobile scanner false-positive behavior for internal error template text is addressed.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `apps/mobile/src/runtime/appRuntimeConfig.ts`, `infra/cloudbase/mobile-runtime-contract.md`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact remote runtime config, endpoint, env, and injected-profile keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a temporary design mock negative fixture for runtime config metadata leakage.
- `docs/agent-runs/2026-06-14-design-runtime-config-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-runtime-config-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch with temporary design HTML fixture -> expected failure on `runtime-config-metadata-visible-leak.html`.
- Removed the temporary design HTML fixture.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_runtime_config_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-14-design-runtime-config-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_runtime_config_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

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
- Blocking findings: none.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no accepted design artifact, visual output, screen, copy, reference HTML, or runtime UI changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` is not covered in this PR to keep design scanner coverage aligned with the mobile scanner runtime/config PR and avoid creating asymmetric expectations before the mobile scanner false-positive path is fixed.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
