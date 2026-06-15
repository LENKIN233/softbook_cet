# Agent Run Record: design backend default constant metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/design-backend-default-constant-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so backend default/runtime source constants cannot leak through design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps CloudBase runtime and backend defaults as implementation hypothesis, not product truth.
- `infra/cloudbase/functions/softbook-api/index.js` defines backend default/source constants: `DEFAULT_SMS_CODE`, `DEFAULT_TRIAL_DURATION_DAYS`, `DEFAULT_TOKEN_TTL_SECONDS`, `DEFAULT_CARD_SOURCE`, and `CLOUDBASE_COLLECTIONS`.
- `spec/harness-architecture.json` places design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-run-record.json` and `spec/repo-delivery-contract.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The design scanner now treats `DEFAULT_SMS_CODE`, `DEFAULT_TRIAL_DURATION_DAYS`, `DEFAULT_TOKEN_TTL_SECONDS`, `DEFAULT_CARD_SOURCE`, and `CLOUDBASE_COLLECTIONS` as exact raw backend default/source names when they appear in design visual artifacts.
- The mobile scanner already covered these exact keys, so this change is scoped to design visual artifacts and harness coverage.
- Broad words such as `default`, `trial`, `duration`, `token`, `card`, `source`, and `collections` remain out of scope to avoid false positives.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `infra/cloudbase/functions/softbook-api/index.js`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact backend default/source constants to design visual artifact raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a temporary design negative fixture for backend default/source constant leakage.
- `docs/agent-runs/2026-06-15-design-backend-default-constant-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-backend-default-constant-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- Removed temporary fixture.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_backend_default_constant_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-design-backend-default-constant-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_backend_default_constant_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local design metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection is covered by harness fixture.
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

- No known blocking risk. The guard is limited to exact backend default/source constant names and does not scan broad default/trial/duration/token/card/source/collections words.

## Follow-up

- Open a PR, run required checks, and merge after checks are green.
