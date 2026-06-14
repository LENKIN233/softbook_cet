# Agent Run Record: design result/session metadata leak scan

## Task summary

- Date: 2026-06-14
- Branch: `infra/design-result-session-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw learning result/session state field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/card-system.json` defines card identity and interaction metadata as product data, not learner-facing raw field names.
- `spec/visual-language.json` defines user-visible metadata leakage in design artifacts or implementation mappings as a delivery blocker.
- `apps/mobile/src/learning/model.ts` defines `LearningCardResult` and `LearningSession` implementation fields such as `catalogCards`, `completedAt`, `usedHint`, and `usedPeek`; these are implementation state, not visible learner copy.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The design scanner already rejected raw card, source, box-catalog, interaction, answer-key, and auto-scoring metadata field names. It now also rejects raw result/session implementation state fields in scanned design visual artifacts.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/visual-language.json`, `apps/mobile/src/learning/model.ts`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added result/session raw implementation fields to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for result/session visible design artifact leakage.
- `docs/agent-runs/2026-06-14-design-result-session-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-result-session-metadata-leak-scan origin/main` -> success.
- Repo-like temporary fixture probe before the fix using `origin/main:scripts/check_design_metadata_leaks.mjs` -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- Repo-like temporary fixture probe after the fix -> scanner failed as expected and reported `result-session-metadata-visible-leak.html`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_result_session_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-14-design-result-session-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_result_session_pr_body.md` -> `AGENT REVIEW GATE OK`

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

- No known blocking risk. The added fields are exact `LearningCardResult` / `LearningSession` implementation state keys and current scanned design artifacts contain no result/session field-name occurrences.

## Follow-up

- Open a PR, run required checks, and merge after checks are green.
