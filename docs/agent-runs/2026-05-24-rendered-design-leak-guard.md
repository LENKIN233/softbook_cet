# Agent Run Record: rendered design leak guard

## Task summary

- Date: 2026-05-24
- Branch: `infra/design-copy-leak-path-guard`
- PR: N/A at record creation
- Summary: Remove visible internal process wording from the Space shelf-desk rendered design proof and extend the design metadata scanner so rendered HTML visible text catches internal process terms and repo paths.

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`: rendered visual output must not expose internal agent, harness, metadata, runtime, mock, prototype, fixture, debug, repo path, or TODO language as visible UI.

## Implementation hypothesis changed

- No product implementation hypothesis changed.
- The rendered Space proof copy is now learner-facing instead of process-facing.

## Workspace boundary and read scope

- Active truth/source read: `scripts/check_design_metadata_leaks.mjs`, `scripts/validate_pr_design_gate.py`, `docs/design/mocks/space-surface-shelf-desk-v1.html`, `docs/design/mocks/space-surface-shelf-desk-v1.md`, `docs/agent-runs/TEMPLATE.md`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: add rendered HTML visible-text leak rules for internal process wording and repo paths.
- `docs/design/mocks/space-surface-shelf-desk-v1.html`: remove visible process/meta wording from the rendered Space design proof.
- `docs/agent-runs/2026-05-24-rendered-design-leak-guard.md`: record this PR-bound design/harness work.

## Commands run

- `git status --short --branch` -> clean branch state checked.
- `git log -1 --oneline --decorate` -> current branch commit checked.
- `gh pr list --state open --limit 20 --json number,title,headRefName,isDraft,mergeStateStatus,reviewDecision,url` -> no open PRs.
- `git fetch origin main` -> fetched latest main.
- `git checkout -b infra/design-copy-leak-path-guard origin/main` -> created current branch.
- `sed -n '1,260p' scripts/validate_pr_design_gate.py` -> read PR design gate.
- `sed -n '1,240p' scripts/check_design_metadata_leaks.mjs` -> read design metadata scanner.
- `rg -n "agent|harness|validator|runtime|mock|prototype|seed|fixture|debug|dev|TODO|API|route|repo|docs/|apps/" docs/design -g '*.html'` -> found visible process wording in rendered Space proof.
- `sed -n '480,610p' docs/design/mocks/space-surface-shelf-desk-v1.html` -> read affected rendered proof section.
- `sed -n '1,120p' docs/design/mocks/space-surface-shelf-desk-v1.md` -> read source design artifact boundary.
- `sed -n '1,200p' docs/agent-runs/TEMPLATE.md` -> read run record template.

## Validation results

- Pending. Full local harness and PR checks must run before merge.

## Agent review status

- Reviewer: pending.
- Status: pending.
- Blocking findings: pending.

## User-visible UI impact

- User-visible app UI: none.
- User-visible rendered design proof: yes. The Space shelf-desk proof now shows learner-facing Chinese copy instead of internal process labels.

## Card make external workspace impact

- None.

## Risks and open questions

- The scanner deliberately applies the new internal-process wording guard to rendered HTML visible text only, not all Markdown design evidence, because design evidence sections legitimately reference specs, artifacts, and paths.
- Existing design source/provenance Markdown remains unchanged.

## Follow-up

- Run full harness.
- Open PR with required design checklist and agent review evidence.
