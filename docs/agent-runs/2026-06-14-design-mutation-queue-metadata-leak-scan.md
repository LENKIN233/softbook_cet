# Agent Run Record: design mutation queue metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-mutation-queue-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw offline mutation queue operation and storage keys cannot appear in design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
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

- `spec/authority-map.json` assigns authentication, sync, and purchase truth to `spec/account-sync-contract.json`; runtime hypotheses remain owned by `spec/runtime-boundaries.json`, and visual-language ownership stays with `spec/visual-language.json`.
- `spec/account-sync-contract.json` requires learning state sync, physical space state sync, membership entitlement sync, and offline mutation replay after reconnect.
- `spec/runtime-boundaries.json` keeps exact endpoint, scheduling, and state-machine details as implementation hypotheses while requiring confirmed user-facing actions not to be dropped.
- `spec/visual-language.json` treats user-visible metadata, runtime, mock, prototype, debug, repo path, or TODO leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/harness-architecture.json` places design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design metadata scanner already rejected raw card, source, interaction, answer-key, result/session, interaction-state, auth/sync, progress, membership payload, and mutation queue keys on the mobile side. It now also rejects exact offline mutation queue operation/storage keys in scanned design visual artifacts.
- The added keys are exact operation/storage names: `sync_daily_progress`, `sync_space_state`, `sync_learning_state`, `start_membership_trial`, `refresh_membership`, `__softbook_mutation_queue`, and `retryCount`.
- Broad queue fields such as `id`, `type`, `payload`, and `timestamp` remain out of scope to avoid false positives in legitimate design copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/visual-language.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact mutation queue operation and storage keys to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for mutation queue visible design artifact leakage.
- `docs/agent-runs/2026-06-14-design-mutation-queue-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-mutation-queue-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture probe before the fix -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary design HTML fixture probe after the fix -> scanner failed as expected and reported `mutation-queue-metadata-visible-leak.html`.
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

- No known blocking risk. The guard is limited to exact mutation queue operation/storage keys and avoided broad queue fields such as `id`, `type`, `payload`, and `timestamp`.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
