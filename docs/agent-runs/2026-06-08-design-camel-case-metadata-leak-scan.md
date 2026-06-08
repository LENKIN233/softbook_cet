# Agent Run Record: design camelCase metadata leak scan

## Task summary

- Date: 2026-06-08
- Branch: `infra/design-camel-case-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design visual metadata scanner so user-visible camelCase internal process terms and metadata field names are blocked in rendered design proofs.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/visual-language.json` defines user-visible metadata leakage in design artifacts and implementation mappings as a delivery blocker.
- `spec/authority-map.json` assigns visual-language authority to `spec/visual-language.json` and delivery governance to `spec/repo-delivery-contract.json` / `spec/agent-harness.json`.

## Implementation hypothesis changed

- The design scanner now treats camelCase and PascalCase process terms as equivalent to visible internal process wording after a normalization pass.
- The scanner now treats camelCase metadata field names such as `sourceLabel`, `boxRef`, `spaceMetadata`, `knowledgeRef`, and `sourceId` as raw metadata field leaks.

## Workspace boundary and read scope

- Active truth/source read: `spec/authority-map.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `spec/visual-language.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `docs/agent-runs/TEMPLATE.md`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added camelCase normalization for visible process terms and camelCase metadata field detection.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures and snippet assertions for camelCase process and metadata leak coverage.
- `docs/agent-runs/2026-06-08-design-camel-case-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary fixture probe before the fix for `runtimeDebugPayload` -> scanner incorrectly passed.
- Temporary fixture probe before the fix for `sourceLabel` / `boxRef` -> scanner incorrectly passed.
- Temporary fixture probe after the fix for `runtimeDebugPayload`, `sourceLabel`, `boxRef`, and CSS generated `sourceLabel` -> scanner failed as expected and reported the fixture files.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: pending PR agent review.
- Status: pending.
- Blocking findings: none known locally.

## User-visible UI impact

- None. This changes guardrails and harness fixtures only; no screen, mock, runtime UI, copy, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The change avoids broad short-token matching by normalizing camelCase text before applying the existing process-term boundary rule.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
