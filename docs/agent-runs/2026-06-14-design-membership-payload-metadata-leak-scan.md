# Agent Run Record: design membership payload metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-membership-payload-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw membership entitlement payload field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/authority-map.json` assigns authentication, sync, and purchase truth to `spec/account-sync-contract.json`, membership access truth to `spec/membership.json`, and visual-language ownership to `spec/visual-language.json`.
- `spec/account-sync-contract.json` requires membership entitlement sync and defines server entitlement as the default membership sync authority.
- `spec/membership.json` defines trial, free, and premium access rules plus the trial start and purchase recovery expectations.
- `spec/runtime-boundaries.json` requires trial and membership access rules to be enforced while keeping exact endpoint/database schema details outside product truth.
- `spec/visual-language.json` treats user-visible metadata, runtime, mock, prototype, debug, repo path, or TODO leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/harness-architecture.json` places design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design metadata scanner already rejected raw card, source, interaction, answer-key, result/session, interaction-state, auth/sync, and progress payload keys. It now also rejects exact membership entitlement payload fields in scanned design visual artifacts.
- The added keys are exact snake_case membership payload names: `counted_entry_count`, `last_experience_ended_by`, `recovery_prompt_visible`, `trial_duration_days`, and `trial_started_at_entry_count`.
- Broad terms such as `stage`, `mode`, `entitlement`, and camelCase UI state fields remain out of scope to avoid false positives in legitimate membership design copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/visual-language.json`, `spec/agent-run-record.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact snake_case membership entitlement payload fields to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for membership payload visible design artifact leakage.
- `docs/agent-runs/2026-06-14-design-membership-payload-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-membership-payload-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture probe before the fix -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary design HTML fixture probe after the fix -> scanner failed as expected and reported `membership-payload-metadata-visible-leak.html`.
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

- No known blocking risk. The guard is limited to exact snake_case membership entitlement payload keys and avoided broader terms that could collide with legitimate membership design copy.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
