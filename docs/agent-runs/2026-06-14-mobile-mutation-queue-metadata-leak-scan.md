# Agent Run Record: mobile mutation queue metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/mobile-mutation-queue-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw offline mutation queue operation and storage keys cannot be rendered as learner-visible text or rendered element identifiers.

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
- `spec/account-sync-contract.json` requires learning state sync, physical space state sync, membership entitlement sync, and offline mutation replay after reconnect.
- `spec/runtime-boundaries.json` keeps exact endpoint, scheduling, and state-machine details as implementation hypotheses while requiring confirmed user-facing actions not to be dropped.
- `spec/harness-architecture.json` places scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile metadata scanner already rejected raw card, source, interaction, answer-key, result/session, interaction-state, auth/sync, progress, and membership payload keys. It now also rejects exact offline mutation queue implementation keys when they appear in visible text, accessibility copy props, or rendered element identifiers.
- The added keys are exact operation/storage names: `sync_daily_progress`, `sync_space_state`, `sync_learning_state`, `start_membership_trial`, `refresh_membership`, `__softbook_mutation_queue`, and `retryCount`.
- Broad queue fields such as `id`, `type`, `payload`, and `timestamp` remain out of scope to avoid false positives in legitimate implementation code or visible copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/sync/mutationQueue.ts`, `apps/mobile/src/sync/mutationQueueRepository.ts`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact mutation queue operation and storage keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and negative fixtures for mutation queue visible text, accessibility copy prop, and rendered prop leakage.
- `docs/agent-runs/2026-06-14-mobile-mutation-queue-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/mobile-mutation-queue-metadata-leak-scan origin/main` -> success.
- Temporary TSX fixture probe before the fix -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after scanner patch -> `PASS: No metadata leaks detected in visible text.`
- Temporary TSX fixture probe after the fix -> scanner failed as expected and reported `MutationQueueMetadataLeakProbe.tsx`.
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

- No known blocking risk. The guard is limited to exact mutation queue operation/storage keys and avoided broad queue fields such as `id`, `type`, `payload`, and `timestamp`.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
