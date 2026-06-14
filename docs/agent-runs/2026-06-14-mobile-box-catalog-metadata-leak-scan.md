# Agent Run Record: mobile box-catalog metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/mobile-box-catalog-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw box-catalog field names cannot appear in visible mobile text, accessibility copy props, or rendered element props.

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
- `spec/visual-language.json` defines user-visible metadata leakage in implementation mappings or visual artifacts as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected raw card, interaction, answer-key, and auto-scoring metadata field names. It now also rejects raw box-catalog metadata field names and camelCase variants when they are rendered through visible text, accessibility copy props, or rendered element props.

## Workspace boundary and read scope

- Active truth/source read: `spec/box-catalog.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added box-catalog raw field names and camelCase variants to mobile raw metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and mobile negative fixtures for box-catalog metadata leaks.
- `docs/agent-runs/2026-06-14-mobile-box-catalog-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/mobile-box-catalog-metadata-leak-scan origin/main` -> success.
- Temporary TSX fixture probe before the fix in `apps/mobile/src/learning/BoxCatalogMetadataLeakProbe.tsx` -> scanner incorrectly passed.
- Temporary TSX fixture probe after the fix -> scanner failed as expected and reported raw metadata leaks in Text, accessibility copy prop, and rendered element prop surfaces.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mobile_box_catalog_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-14-mobile-box-catalog-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mobile_box_catalog_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile scanner validation: pass.
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

- No known blocking risk. The added fields are exact box-catalog machine keys and current mobile UI code contains no box-catalog field-name occurrences in visible surfaces.

## Follow-up

- Open a PR, run required checks, and merge after checks are green.
