# Agent Run Record: design box-catalog metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-box-catalog-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw box-catalog field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/box-catalog.json` defines box-catalog machine fields such as `template_box_prefix`, `box_id`, `track_availability`, `resolved_box_prefixes`, `card_template`, `card_counts`, and `template_track_placeholder`.
- `spec/visual-language.json` defines user-visible metadata leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The design scanner already rejected raw card, interaction, answer-key, and auto-scoring metadata field names. It now also rejects raw box-catalog metadata field names and camelCase variants in scanned design visual artifacts.

## Workspace boundary and read scope

- Active truth/source read: `spec/box-catalog.json`, `spec/card-system.json`, `spec/visual-language.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added box-catalog raw field names and camelCase variants to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for box-catalog visible design artifact leakage.
- `docs/agent-runs/2026-06-14-design-box-catalog-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-box-catalog-metadata-leak-scan origin/main` -> success.
- `rg -n "track_availability|box_id|template_track_placeholder|..." docs/design apps/mobile scripts spec -g '!archive/**'` -> current hits are active specs and non-visual reporting code, not scanned design artifacts.
- Repo-like temporary fixture probe before the fix using `origin/main:scripts/check_design_metadata_leaks.mjs` -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- Repo-like temporary fixture probe after the fix -> scanner failed as expected and reported `box-catalog-metadata-visible-leak.html`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_box_catalog_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-14-design-box-catalog-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_box_catalog_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local design scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- PR body design gate validation: pass.
- Agent review body validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex.
- Status: Passed.
- Blocking findings: none.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, reference HTML, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The added fields are exact box-catalog machine keys and current scanned design artifacts contain no box-catalog field-name occurrences.

## Follow-up

- Open a PR, run required checks, and merge after checks are green.
