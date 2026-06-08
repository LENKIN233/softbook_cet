# Agent Run Record: mobile optional metadata leak scan

## Task summary

- Date: 2026-06-08
- Branch: `infra/mobile-optional-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw card/source metadata cannot be displayed through Text nodes or visible/accessibility props using optional chaining or destructured metadata variables.

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

- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require PR-bound harness/governance work to be committed on a topic branch with validation, Agent review, and a durable run record.

## Implementation hypothesis changed

- The mobile scanner now treats optional property access (`?.`) and destructured metadata variables as the same raw metadata display surface as direct property access.
- The scanner shares one raw metadata reference pattern across Text-node checks and visible/accessibility copy prop checks.

## Workspace boundary and read scope

- Active truth/source read: `spec/authority-map.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `docs/agent-runs/TEMPLATE.md`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added shared raw metadata reference detection for `.` / `?.` access and bare destructured metadata names.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures and snippet assertions for optional chaining and destructured Text-node metadata leaks.
- `docs/agent-runs/2026-06-08-mobile-optional-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- Temporary fixture probe before the fix for `<Text>{card?.sourceLabel}</Text>` -> scanner incorrectly passed.
- Temporary fixture probe before the fix for `<Text>{sourceLabel}</Text>` -> scanner incorrectly passed.
- Temporary fixture probe before the fix for `accessibilityHint={card.space_metadata?.box_ref}` -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- Temporary fixture probe after the fix for optional Text, bare Text, and optional space metadata accessibility prop -> scanner failed as expected and reported the fixture files.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local mobile scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: pending PR agent review.
- Status: pending.
- Blocking findings: none known locally.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The shared regex narrows to known metadata field names and only flags visible Text/copy surfaces.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
