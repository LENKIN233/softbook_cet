# Agent Run Record: backend runtime local metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/backend-runtime-local-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so backend runtime env names and CloudBase local config constants cannot leak through visible text, accessibility copy, or rendered metadata props.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps backend runtime, persistence mode, and concrete env wiring as implementation hypothesis, not product truth.
- `infra/cloudbase/functions/softbook-api/index.js`, `infra/cloudbase/README.md`, and `infra/cloudbase/mobile-runtime-contract.md` define backend runtime env names and CloudBase local config constants used for development/runtime validation.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps generated, dependency, cache, archive, and sibling external workspace material outside default semantic context.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `SOFTBOOK_API_KEY`, `SOFTBOOK_SMS_DEV_CODE`, `SOFTBOOK_AUTH_TOKEN_SECRET`, `SOFTBOOK_AUTH_TOKEN_TTL_SECONDS`, `SOFTBOOK_STORE_MODE`, `CLOUDBASE_ENV_ID`, `TCB_ENV`, `SCF_NAMESPACE`, `CLOUDBASE_COLLECTIONS`, `DEFAULT_SMS_CODE`, `DEFAULT_TRIAL_DURATION_DAYS`, `DEFAULT_TOKEN_TTL_SECONDS`, and `DEFAULT_CARD_SOURCE` as exact raw backend runtime metadata names.
- The design scanner was not changed because a temporary design HTML fixture with the same family was already rejected by existing internal process/implementation term detection.
- Broad words such as `api`, `secret`, `token`, `cloudbase`, `env`, or `default` remain out of scope to avoid false positives in legitimate implementation notes or product copy.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `infra/cloudbase/mobile-runtime-contract.md`, `infra/cloudbase/README.md`, `infra/cloudbase/functions/softbook-api/index.js`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact backend runtime env names and CloudBase local config constants to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile negative fixtures for backend runtime local metadata leakage.
- `docs/agent-runs/2026-06-15-backend-runtime-local-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/backend-runtime-local-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture before the scanner patch -> scanner already rejected via existing internal process/implementation term detection.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_backend_runtime_local_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-backend-runtime-local-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_backend_runtime_local_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local design metadata scanner validation: pass.
- Local mobile negative fixture validation: pass, expected scanner rejection is covered by harness fixtures.
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

- No known blocking risk. The guard is limited to exact backend runtime env names and CloudBase local config constants; broad terms remain out of scope.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
