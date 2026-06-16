# Agent Run Record: backend response field metadata leak scan

## Task summary

- Date: 2026-06-16
- Branch: `infra/backend-response-field-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile and design metadata scanners so backend response adapter and auth config field names cannot leak through visible mobile text, accessibility copy, rendered metadata props, or design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps backend adapter response shape and auth config details as implementation hypothesis, not product truth.
- `infra/cloudbase/functions/softbook-api/index.js` defines backend implementation fields: `dev_fixed_code`, `isBase64Encoded`, `tokenSecret`, and `tokenTtlSeconds`.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-run-record.json` and `spec/repo-delivery-contract.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `dev_fixed_code`, `isBase64Encoded`, `tokenSecret`, and `tokenTtlSeconds` as exact raw backend response/auth metadata when they appear in visible surfaces.
- The design scanner now treats `isBase64Encoded`, `tokenSecret`, and `tokenTtlSeconds` as exact raw backend response/auth metadata in design visual artifacts.
- `dev_fixed_code` is already blocked in design artifacts by the existing process-term guard, so the design exact-key fixture intentionally covers only the three proven metadata-pattern gaps.
- Broad words such as `statusCode`, `body`, `data`, `error`, `code`, `message`, `status`, `delivery`, and `stage` remain out of scope to avoid false positives or user-visible UI behavior changes.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `infra/cloudbase/functions/softbook-api/index.js`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact backend response/auth field names to raw metadata detection.
- `scripts/check_design_metadata_leaks.mjs`: added exact backend response/auth field names that were not already covered by the design process-term guard.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile/design negative fixtures for backend response/auth field leakage.
- `docs/agent-runs/2026-06-16-backend-response-field-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git checkout -b infra/backend-response-field-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture containing `dev_fixed_code` before the scanner patch -> scanner failed via existing process-term guard, not via exact metadata pattern.
- Temporary design HTML fixture narrowed to `isBase64Encoded`, `tokenSecret`, and `tokenTtlSeconds` before the scanner patch -> scanner incorrectly passed.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_backend_response_field_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-16-backend-response-field-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_backend_response_field_pr_body.md` -> `AGENT REVIEW GATE OK`

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

- No known blocking risk. `statusCode` was intentionally excluded because current mobile UI interpolates remote HTTP status values into user-visible failure copy; changing that would be a separate UI/copy behavior decision.

## Follow-up

- Open a PR, run required checks, and merge after checks are green.
