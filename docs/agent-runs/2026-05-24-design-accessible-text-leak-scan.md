# Agent Run Record: design accessible text leak scan

## Task summary

- Date: 2026-05-24
- Branch: `infra/design-accessible-text-leak-scan`
- PR: N/A at record creation
- Summary: Extend the design metadata scanner so HTML/SVG accessibility text attributes are scanned for visible metadata leaks.

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`: visual artifacts must not expose internal process, repo path, runtime, mock, prototype, fixture, debug, or TODO language as visible UI.

## Implementation hypothesis changed

- No product implementation hypothesis changed.
- Scanner implementation now treats `aria-label`, `alt`, and `title` attribute values as user-visible/accessibility-facing text for HTML/SVG artifacts.

## Workspace boundary and read scope

- Active truth/source read: `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, and `docs/agent-runs/TEMPLATE.md`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: extract and scan HTML/SVG accessibility text attributes with entity decoding.
- `scripts/harness_validator/sections/design_governance.py`: add HTML and SVG attribute-only leak fixtures.
- `docs/agent-runs/2026-05-24-design-accessible-text-leak-scan.md`: record this PR-bound scanner/harness work.

## Commands run

- `rg -n "aria-label|alt=|title=|accessible|accessibility|metadata leak" /Users/lenkin/.codex/memories/MEMORY.md` -> confirmed this continues the visible metadata leak remediation line.
- `git status --short --branch` -> current branch state checked.
- `git fetch origin main` -> fetched latest `origin/main`.
- `gh pr list --state open --limit 20 --json number,title,headRefName,isDraft,mergeStateStatus,reviewDecision,url` -> no open PRs.
- `git checkout -b infra/design-accessible-text-leak-scan origin/main` -> created current branch.
- `sed -n '1,240p' scripts/check_design_metadata_leaks.mjs` -> read scanner implementation.
- `sed -n '50,185p' scripts/harness_validator/sections/design_governance.py` -> read harness fixture context.
- `rg -n "aria-label|alt=|title=" docs/design -g '*.html' -g '*.svg'` -> confirmed existing design artifacts use accessibility-facing attributes.
- `sed -n '1,200p' docs/agent-runs/TEMPLATE.md` -> read run record template.
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

- The scanner covers direct text-bearing attributes (`aria-label`, `alt`, `title`). It does not resolve `aria-labelledby` references because those point to separate text nodes already covered by visible text scanning.
- Existing design artifacts already contain many semantic `aria-label` values, so this closes a real accessibility-facing leak surface rather than only a theoretical HTML path.

## Follow-up

- Validate locally.
- Open PR with required agent review and run record evidence.
