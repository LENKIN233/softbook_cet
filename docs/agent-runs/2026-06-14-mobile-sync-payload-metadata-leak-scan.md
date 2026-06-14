# Agent Run Record: mobile sync payload metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/mobile-sync-payload-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw auth, learning-state sync, progress sync, and space-state sync payload field names cannot be rendered as learner-visible text or rendered element identifiers.

## Referenced specs

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
- `spec/account-sync-contract.json` requires authentication before learning, phone/SMS login, learning state sync, physical space state sync, membership entitlement sync, and daily-level minimum consistency.
- `spec/runtime-boundaries.json` requires authenticated entry before learning and daily-level progress sync while keeping exact endpoint/database schema details outside product truth.
- `spec/harness-architecture.json` places scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile metadata scanner already rejected raw card, source, interaction, answer-key, result/session, and interaction-state metadata keys. It now also rejects exact snake_case remote auth/sync payload fields when they appear in visible text, accessibility copy props, or rendered element identifiers.
- The added keys are exact backend payload names only, such as `auth_token`, `phone_number`, `used_hint`, `is_favorited`, `is_sleeping`, and progress count fields. Broad terms such as `phase`, `outcome`, `states`, and camelCase UI state fields were intentionally left out to avoid false positives in legitimate learner-facing mappings.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/auth/authRepository.ts`, `apps/mobile/src/sync/learningStateRepository.ts`, `apps/mobile/src/sync/progressSyncRepository.ts`, `apps/mobile/src/space/spaceStateRepository.ts`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact snake_case auth/sync payload fields to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and negative fixtures for sync payload visible text, accessibility copy prop, and rendered prop leakage.
- `docs/agent-runs/2026-06-14-mobile-sync-payload-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/mobile-sync-payload-metadata-leak-scan origin/main` -> success.
- Temporary TSX fixture probe before the fix -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after scanner patch -> `PASS: No metadata leaks detected in visible text.`
- Temporary TSX fixture probe after the fix -> scanner failed as expected and reported `SyncPayloadMetadataLeakProbe.tsx`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local mobile metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- Whitespace validation: pass.
- PR body design gate validation: pending PR body.
- Agent review body validation: pending PR body.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally; PR body validation pending.
- Blocking findings: none.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, reference HTML, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The guard is limited to exact snake_case auth/sync payload keys and avoided broader terms that could collide with legitimate user-facing copy.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
