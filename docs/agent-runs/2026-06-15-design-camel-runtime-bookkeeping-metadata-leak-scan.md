# Agent Run Record: design camel runtime bookkeeping metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/design-camel-runtime-bookkeeping-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so selected camelCase internal runtime bookkeeping fields cannot appear in design visual artifacts.

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
- `spec/account-sync-contract.json` requires authenticated learning, phone SMS login, daily-level sync, shared membership entitlement, and offline mutation replay after reconnect.
- `spec/runtime-boundaries.json` keeps exact runtime wiring and state field details as implementation hypotheses.
- `spec/harness-architecture.json` places design artifact scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design metadata scanner already rejected snake_case auth, sync, progress, space, membership, mutation queue, and runtime config keys. It now also rejects selected camelCase internal runtime bookkeeping keys in visible text, accessibility text, generated content, or source tokens.
- Added exact keys: `authToken`, `acknowledgedAt`, `lastModifiedAt`, `countedEntryCount`, `recoveryPromptVisible`, and `trialStartedAtEntryCount`.
- This mirrors the mobile scanner scope from `docs/agent-runs/2026-06-15-mobile-camel-runtime-bookkeeping-metadata-leak-scan.md` and intentionally avoids broader camelCase state names that are legitimate UI inputs or display values.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/App.tsx`, `apps/mobile/src/auth/authRepository.ts`, `apps/mobile/src/sync/progressSyncRepository.ts`, `apps/mobile/src/sync/learningStateRepository.ts`, `apps/mobile/src/space/spaceStateRepository.ts`, `apps/mobile/src/membership/membershipRepository.ts`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added selected exact camelCase internal runtime bookkeeping keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a temporary design mock negative fixture for camelCase runtime bookkeeping leakage.
- `docs/agent-runs/2026-06-15-design-camel-runtime-bookkeeping-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-camel-runtime-bookkeeping-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch with temporary design HTML fixture -> expected failure on `camel-runtime-bookkeeping-metadata-visible-leak.html`.
- Removed the temporary design HTML fixture.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_camel_runtime_bookkeeping_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-design-camel-runtime-bookkeeping-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_camel_runtime_bookkeeping_pr_body.md` -> `AGENT REVIEW GATE OK`

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

- This guard intentionally does not block broader camelCase state names that are already legitimate mobile UI inputs or display values. Future design scanner coverage should stay aligned with mobile scanner scope.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
