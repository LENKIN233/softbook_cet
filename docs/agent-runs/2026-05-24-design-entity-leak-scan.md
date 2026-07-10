# Agent Run Record: design entity leak scan

## Task summary

- Date: 2026-05-24
- Branch: `infra/design-entity-leak-scan`
- PR: N/A at record creation
- Summary: Decode HTML/XML entities before scanning rendered design HTML and SVG visible text so encoded internal process words cannot bypass the metadata leak guard.

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`: visual artifacts must not expose internal process, repo path, runtime, mock, prototype, fixture, debug, or TODO language as visible UI.

## Implementation hypothesis changed

- No product implementation hypothesis changed.
- Scanner implementation now normalizes HTML/XML entities before visible-text leak matching.

## Workspace boundary and read scope

- Active truth/source read: `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `docs/agent-runs/TEMPLATE.md`, and `spec/agent-run-record.json`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: add numeric and selected named entity decoding before visible HTML/SVG text scanning.
- `scripts/harness_validator/sections/design_governance.py`: update the design metadata scanner fixture to use entity-encoded process words and require `decodeHtmlEntities` in the scanner.
- `docs/agent-runs/2026-05-24-design-entity-leak-scan.md`: record this PR-bound scanner/harness work.

## Commands run

- `git status --short --branch` -> current branch state checked.
- `git fetch origin main` -> fetched latest `origin/main`.
- `gh pr list --state open --limit 20 --json number,title,headRefName,isDraft,mergeStateStatus,reviewDecision,url` -> no open PRs.
- `git checkout -b infra/design-entity-leak-scan origin/main` -> created current branch.
- `sed -n '1,230p' scripts/check_design_metadata_leaks.mjs` -> read scanner implementation.
- `sed -n '50,175p' scripts/harness_validator/sections/design_governance.py` -> read design metadata scanner fixture.
- `sed -n '1,200p' docs/agent-runs/TEMPLATE.md` -> read run record template.
- `sed -n '1,220p' spec/agent-run-record.json` -> read run record contract.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.

## Validation results

- `node scripts/check_design_metadata_leaks.mjs` passed locally: `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` passed locally: `HARNESS VALIDATION OK`.

## Agent review status

- Reviewer: Codex.
- Status: Passed.
- Blocking findings: none.

## User-visible UI impact

- None. This is scanner/harness-only and does not change rendered app UI or existing design artifact copy.

## Card make external workspace impact

- None.

## Risks and open questions

- Entity decoding is intentionally lightweight and covers numeric entities plus the named entities used or likely to appear in current design artifacts.
- Unknown named entities are preserved unchanged to avoid broad lossy rewriting.

## Follow-up

- Validate locally.
- Open PR with required agent review and run record evidence.
