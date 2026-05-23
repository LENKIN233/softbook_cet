# Agent Run Record: design metadata scanner fixture

## Task summary

- Date: 2026-05-24
- Branch: `infra/design-metadata-scanner-fixture`
- PR: N/A at record creation
- Summary: Add harness coverage for the design metadata scanner so rendered HTML process-word leaks and canonical visual-reference repo-path leaks are mechanically rejected by `validate_harness.py`.

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`: visual artifacts must not expose internal process, repo path, runtime, mock, prototype, fixture, debug, or TODO language as visible UI.

## Implementation hypothesis changed

- No product implementation hypothesis changed.
- Harness coverage now treats the design metadata scanner behavior as a durable governance invariant.

## Workspace boundary and read scope

- Active truth/source read: `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, `docs/agent-runs/TEMPLATE.md`, and `spec/agent-run-record.json`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/harness_validator/sections/design_governance.py`: add design metadata scanner presence checks and negative fixtures for rendered HTML process wording and visual-reference visible repo paths.
- `docs/agent-runs/2026-05-24-design-metadata-scanner-fixture.md`: record this PR-bound harness work.

## Commands run

- `git status --short --branch` -> current branch state checked.
- `git fetch origin main` -> fetched latest `origin/main`.
- `gh pr list --state open --limit 20 --json number,title,headRefName,isDraft,mergeStateStatus,reviewDecision,url` -> no open PRs.
- `git checkout -b infra/design-metadata-scanner-fixture origin/main` -> created current branch.
- `sed -n '1,240p' scripts/check_design_metadata_leaks.mjs` -> read design metadata scanner.
- `sed -n '1,180p' scripts/harness_validator/sections/design_governance.py && sed -n '900,1080p' scripts/harness_validator/sections/design_governance.py` -> read governance harness fixture context.
- `sed -n '1,200p' docs/agent-runs/TEMPLATE.md` -> read run record template.
- `sed -n '1,220p' spec/agent-run-record.json` -> read run record contract.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.

## Validation results

- `python3 scripts/validate_harness.py` passed locally: `HARNESS VALIDATION OK`.

## Agent review status

- Reviewer: Codex.
- Status: Passed.
- Blocking findings: none.

## User-visible UI impact

- None. This is harness-only and does not change rendered UI or design artifact copy.

## Card make external workspace impact

- None.

## Risks and open questions

- The visual-reference negative fixture temporarily writes a leak into `docs/design/visual-reference.html` during harness execution and restores the original file in a `finally` block.
- The rendered HTML fixture is created in a temporary directory under `docs/design/mocks` so the scanner walks it through the normal production path.

## Follow-up

- Validate locally.
- Open PR with required agent review and run record evidence.
