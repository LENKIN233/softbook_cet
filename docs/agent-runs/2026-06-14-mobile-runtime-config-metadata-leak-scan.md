# Agent Run Record: mobile runtime config metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/mobile-runtime-config-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw remote runtime config, endpoint, env, and injected-profile keys cannot be rendered as learner-visible text, accessibility copy, or rendered element identifiers.

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
- `spec/harness-architecture.json` places scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile metadata scanner already rejected raw card, source, interaction, answer-key, result/session, interaction-state, auth/sync, progress, membership, and mutation queue payload keys. It now also rejects exact remote runtime config and endpoint keys when they appear in visible text, accessibility copy props, or rendered element identifiers.
- Added exact keys: `apiKey`, `apiKeyHeader`, `baseUrl`, `remoteConfig`, `requestCodeEndpoint`, `verifyCodeEndpoint`, `dismissRecoveryEndpoint`, `entitlementEndpoint`, `purchaseEndpoint`, `startTrialEndpoint`, `trackQueryParam`, `__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__`, `SOFTBOOK_CET_REMOTE_BASE_URL`, `SOFTBOOK_CET_REMOTE_API_KEY`, and `SOFTBOOK_CET_LEARNING_TRACK`.
- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` remains out of scope for this PR because the current scanner treats the internal error template `Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: ${feature}.` as a rendered prop candidate; covering it safely needs a separate scanner false-positive fix and regression.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/runtime/appRuntimeConfig.ts`, `infra/cloudbase/mobile-runtime-contract.md`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact remote runtime config, endpoint, env, and injected-profile keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and negative fixtures for runtime config visible text, accessibility copy prop, and rendered prop leakage.
- `docs/agent-runs/2026-06-14-mobile-runtime-config-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/mobile-runtime-config-metadata-leak-scan origin/main` -> success.
- Temporary TSX fixture probe before the scanner patch -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after scanner patch with temporary TSX fixture -> expected failure on `RuntimeConfigMetadataLeakProbe.tsx`.
- Removed the temporary TSX fixture.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mobile_runtime_config_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-14-mobile-runtime-config-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mobile_runtime_config_pr_body.md` -> `AGENT REVIEW GATE OK`

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
- Blocking findings: none.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, reference HTML, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` is not covered in this PR because of the known scanner false-positive risk on internal error template text. A follow-up can safely cover it by first teaching the scanner to distinguish internal thrown errors from rendered copy props.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
