# Agent Run Record: design answer_key metadata leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/design-answer-key-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw `answer_key` / `answerKey` and known auto-scoring answer-key child field names cannot appear in design visual artifacts.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/card-system.json` defines `answer_key` as scoring data required for auto-scoring interactions.
- `spec/interactions.json` defines answer-key child fields such as `correct_option`, `lock_pattern`, `correct_items`, and `correct_state`.
- `spec/visual-language.json` defines user-visible metadata leakage in design artifacts or implementation mappings as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The design scanner already rejected raw metadata field names such as `knowledge_ref`, `interaction_id`, `card_id`, `sourceLabel`, and `boxRef`. It now also rejects `answer_key`, `answerKey`, and known answer-key child field names in scanned design visual artifacts.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/interactions.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added `answer_key`, `answerKey`, and known answer-key child keys to design metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a negative fixture for answer-key visible design artifact leakage.
- `docs/agent-runs/2026-06-12-design-answer-key-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- `rg -n "answer_key|answerKey|correct_option|correctOption|lock_pattern|lockPattern|correct_items|correctItems|correct_state|correctState" docs/design/...` -> no current scanned design artifact hits.
- Temporary fixture probe before the fix for answer-key fields in `docs/design/mocks` HTML -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- Temporary fixture probe after the fix -> scanner failed as expected and reported `answer-key-visible-leak.html`.
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

- No known blocking risk. The added fields are exact scoring-data keys and current scanned design artifacts contain no answer-key field occurrences.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
