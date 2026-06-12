# Agent Run Record: design interaction_id metadata leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/design-interaction-id-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw `interaction_id` / `interactionId` metadata field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/card-system.json` defines `interaction_id` as a required card interaction contract field.
- `spec/visual-language.json` defines user-visible metadata leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The design scanner already rejected raw metadata field names such as `knowledge_ref`, `card_id`, `sourceLabel`, and `boxRef`. It now also rejects `interaction_id` and `interactionId` in scanned design visual artifacts.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added `interaction_id` and `interactionId` to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for `interaction_id` / `interactionId` visible design artifact leakage.
- `docs/agent-runs/2026-06-12-design-interaction-id-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `rg -n "interaction_id|interactionId" docs/design/...` -> no current scanned design artifact hits.
- Temporary fixture probe before the fix for `interaction_id` / `interactionId` in `docs/design/mocks` HTML -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary fixture probe after the fix -> scanner failed as expected and reported `interaction-id-visible-leak.html`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local design scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: pending PR agent review.
- Status: pending.
- Blocking findings: none known locally.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, reference HTML, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The added terms are exact raw metadata keys and current scanned design artifacts contain no `interaction_id` / `interactionId` occurrences.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
