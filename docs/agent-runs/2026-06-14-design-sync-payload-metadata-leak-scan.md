# Agent Run Record: design sync payload metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-sync-payload-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw auth, learning-state sync, progress sync, and space-state sync payload field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/authority-map.json` assigns authentication, sync, and purchase truth to `spec/account-sync-contract.json`; visual-language ownership stays with `spec/visual-language.json`.
- `spec/account-sync-contract.json` requires authenticated learning, phone/SMS login, learning state sync, physical space state sync, membership entitlement sync, and daily-level minimum consistency.
- `spec/runtime-boundaries.json` keeps exact endpoint and database schema details as implementation hypotheses while requiring authenticated entry and daily-level progress sync.
- `spec/visual-language.json` treats user-visible metadata, runtime, mock, prototype, debug, repo path, or TODO leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/harness-architecture.json` places design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design metadata scanner already rejected raw card, source, interaction, answer-key, result/session, and interaction-state metadata keys. It now also rejects exact snake_case remote auth/sync payload fields in scanned design visual artifacts.
- The added terms are exact payload names only, such as `auth_token`, `phone_number`, `used_hint`, `is_favorited`, `is_sleeping`, and progress count fields. Broad terms such as `phase`, `outcome`, `states`, and camelCase UI state fields remain out of scope to avoid false positives in legitimate learner-facing design copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/visual-language.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact snake_case auth/sync payload fields to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for sync payload visible design artifact leakage.
- `docs/agent-runs/2026-06-14-design-sync-payload-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-sync-payload-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture probe before the fix -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary design HTML fixture probe after the fix -> scanner failed as expected and reported `sync-payload-metadata-visible-leak.html`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local design metadata scanner validation: pass.
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

- No known blocking risk. The guard is limited to exact snake_case auth/sync payload keys and avoided broader terms that could collide with legitimate design copy.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
