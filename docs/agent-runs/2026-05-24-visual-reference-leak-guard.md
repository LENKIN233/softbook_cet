# Agent Run Record: visual reference leak guard

## Task summary

- Date: 2026-05-24
- Branch: `infra/visual-reference-visible-leak-guard`
- PR: N/A at record creation
- Summary: Add canonical visual reference coverage to the design metadata scanner and remove visible process/path wording from `docs/design/visual-reference.html`.

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`: visual artifacts must not expose internal agent, harness, metadata, runtime, mock, prototype, fixture, debug, repo path, or TODO language as visible UI.

## Implementation hypothesis changed

- Scanner coverage now treats `docs/design/visual-reference.html` as a canonical visible HTML surface for internal process-word and repo-path leak checks.
- The canonical visual anchor still owns token demonstration and design baseline copy; product truth is unchanged.

## Workspace boundary and read scope

- Active truth/source read: `scripts/check_design_metadata_leaks.mjs`, `docs/design/visual-reference.html`, `docs/design/canon.md`, and the design governance harness section.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: add special canonical visual-reference scanning for visible internal process wording and repo paths.
- `docs/design/visual-reference.html`: replace visible process/path wording with visual-baseline copy.
- `docs/agent-runs/2026-05-24-visual-reference-leak-guard.md`: record this PR-bound design/harness work.

## Commands run

- `rg -n "visual-reference|metadata leak|rendered design|visible metadata|design scanner" /Users/lenkin/.codex/memories/MEMORY.md` -> confirmed this continues the visible metadata-leak remediation line.
- `git status --short --branch` -> current branch state checked.
- `git fetch origin main` -> fetched latest `origin/main`.
- `git checkout -b infra/visual-reference-visible-leak-guard origin/main` -> created current branch.
- `sed -n '1,210p' scripts/check_design_metadata_leaks.mjs` -> read design metadata scanner.
- `rg -n "agent|harness|validator|runtime|mock|prototype|seed|fixture|debug|dev|TODO|implementation|repository|repo|pull request|PR|RN|docs/|apps/|scripts/|spec/|product-core|visual-reference|pixel mock" docs/design/visual-reference.html` -> found visible internal process/path terms in the canonical visual anchor.
- `sed -n '600,640p' docs/design/visual-reference.html && sed -n '900,1020p' docs/design/visual-reference.html` -> read affected visual-reference sections.
- `sed -n '1,180p' docs/design/canon.md` -> confirmed zero visible metadata leakage rule.
- `rg -n "check_design_metadata_leaks|visual-reference.html|visible design|metadata scanner|design visual artifacts" scripts/harness_validator/sections/design_governance.py` -> checked existing harness references.
- `sed -n '930,1045p' scripts/harness_validator/sections/design_governance.py` -> checked visual-output gate fixture context.
- `rg -n "check_design_metadata_leaks|design metadata|visual artifacts contain raw metadata|metadata leaks detected in design" scripts/harness_validator/sections/design_governance.py scripts/validate_harness.py` -> confirmed no existing harness fixture owns the scanner behavior.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `python3 scripts/validate_pr_design_gate.py --body-file /private/tmp/softbook-visual-reference-leak-guard-pr.md --changed-file docs/design/visual-reference.html` -> `PR DESIGN GATE OK`.

## Validation results

- `node scripts/check_design_metadata_leaks.mjs` passed locally: `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` passed locally: `HARNESS VALIDATION OK`.
- `python3 scripts/validate_pr_design_gate.py --body-file /private/tmp/softbook-visual-reference-leak-guard-pr.md --changed-file docs/design/visual-reference.html` passed locally: `PR DESIGN GATE OK`.

## Agent review status

- Reviewer: Codex.
- Status: Passed.
- Blocking findings: none.

## User-visible UI impact

- User-visible app UI: none.
- User-visible rendered design artifact: yes. The canonical visual reference now avoids visible process/path wording while preserving design-token demonstration.

## Card make external workspace impact

- None.

## Risks and open questions

- The canonical visual reference legitimately displays library identity colors and labels, so the new scanner path intentionally applies only visible internal-process and repo-path leak rules to that file.

## Follow-up

- Validate locally.
- Open PR with required design checklist and agent review evidence.
