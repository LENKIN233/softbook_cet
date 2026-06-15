# Agent Run Record: mobile camel runtime bookkeeping metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/mobile-camel-runtime-payload-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so selected camelCase internal runtime bookkeeping fields cannot be rendered as learner-visible text, accessibility copy, or rendered element identifiers.

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
- `spec/harness-architecture.json` places scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile metadata scanner already rejected snake_case auth, sync, progress, space, membership, mutation queue, and runtime config keys. It now also rejects selected camelCase internal bookkeeping keys when they appear in visible text, accessibility copy props, or rendered element identifiers.
- Added exact keys: `authToken`, `acknowledgedAt`, `lastModifiedAt`, `countedEntryCount`, `recoveryPromptVisible`, and `trialStartedAtEntryCount`.
- Deliberately excluded wider camel fields such as `phoneNumber`, `smsCode`, `dayKey`, progress counts, `isFavorited`, `isSleeping`, `trialDurationDays`, and `lastExperienceEndedBy` because the current product UI legitimately uses those values or booleans for visible account input, masked account copy, learning summaries, favorite/sleep labels, trial duration copy, or recovery copy selection.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/App.tsx`, `apps/mobile/src/auth/authRepository.ts`, `apps/mobile/src/sync/progressSyncRepository.ts`, `apps/mobile/src/sync/learningStateRepository.ts`, `apps/mobile/src/space/spaceStateRepository.ts`, `apps/mobile/src/membership/membershipRepository.ts`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added selected exact camelCase internal runtime bookkeeping keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and negative fixtures for camelCase runtime bookkeeping visible text, accessibility copy prop, and rendered prop leakage.
- `docs/agent-runs/2026-06-15-mobile-camel-runtime-bookkeeping-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/mobile-camel-runtime-payload-metadata-leak-scan origin/main` -> success.
- Temporary TSX fixture before the scanner patch -> scanner incorrectly passed.
- Initial broader camelCase key patch -> scanner failed on both the probe and legitimate existing UI state/copy usages, so the scope was narrowed.
- Temporary TSX fixture after the narrowed patch -> scanner failed as expected on the probe without existing UI false positives.
- Removed the temporary TSX fixture.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mobile_camel_runtime_bookkeeping_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-mobile-camel-runtime-bookkeeping-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mobile_camel_runtime_bookkeeping_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- False-positive guard: pass, broader camel UI state fields were excluded after real UI false positives.
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

- This guard intentionally does not block broader camelCase state names that are already legitimate visible UI inputs or display values. Future coverage should stay exact-key and verify against existing UI to avoid turning valid product state rendering into scanner false positives.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
