---
date: 2026-05-22
task: learning-progress-copy
branch: module/learning-progress-copy-v2
spec_refs:
  - spec/requirement-memory.json
  - spec/authority-map.json
  - spec/product-core.json
  - spec/visual-language.json
  - spec/agent-harness.json
  - spec/evals.json
  - spec/repo-delivery-contract.json
  - spec/agent-run-record.json
status: ready-for-review
---

# Learning progress copy correction

## product_truth

Learning is a single-card flow. User-visible progress can show where the learner is in the current run, but it should not foreground internal grouping or queue vocabulary.

## implementation_hypothesis

The current top-frame copy `本组第 N/M 张` is too close to internal batch/group metadata. Rephrasing it as `第 N 张 / 共 M 张` keeps useful progress information while removing the internal group frame.

## changed_files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-22-learning-progress-copy.md`

## validation

Planned local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `npm --prefix apps/mobile test -- LearningSurface.test.tsx --runInBand` attempted locally but blocked by missing local `jest`; required remote `mobile-quality` will run the mobile test environment.
- `PR_BODY="$(cat /tmp/softbook_learning_progress_copy_pr_body.md)" python3 scripts/validate_agent_review.py` passed after PR body normalization.
- `PR_BODY="$(cat /tmp/softbook_learning_progress_copy_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is intentionally narrow: it does not alter layout, progress math, session selection, card content, interaction state, or metadata formatting. It only changes one user-visible progress label and the assertion that protects it.

## remote_follow_up

The first PR run found two mechanical issues: the RN test assertion expected a contiguous JSON substring even though `Text` children are segmented, and the PR body AP-22 line did not name concrete evidence. The follow-up adds a non-visible test id for the progress label, asserts joined children exactly, and updates the PR body AP-22 evidence.
