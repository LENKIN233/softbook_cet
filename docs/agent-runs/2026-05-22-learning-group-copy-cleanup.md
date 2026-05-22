---
date: 2026-05-22
task: learning-group-copy-cleanup
branch: module/learning-group-copy-cleanup
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

# Learning group copy cleanup

## product_truth

Learning is a single-card flow. Visible Learning chrome can refer to the current round and current cards, but should not foreground group/batch wording for primary actions or completion text.

## implementation_hypothesis

The remaining visible strings `回看这一组`, `这一组已经按学习节奏走完。`, `再练一轮这一组`, and related completion copy keep an internal group frame alive. Replacing them with round/card-oriented copy preserves user action meaning while removing the batch-management framing. Adding exact old phrases to the metadata leak scanner prevents regression.

## changed_files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `docs/agent-runs/2026-05-22-learning-group-copy-cleanup.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_learning_group_copy_cleanup_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_learning_group_copy_cleanup_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is intentionally narrow: it updates remaining visible group/batch wording in LearningSurface, strengthens a regression assertion, and adds exact scanner guardrails. It does not alter learning state, source loading, card payloads, layout, or interaction behavior.

## remote_follow_up

The first remote mobile-quality run passed metadata scanning but found App integration assertions that still expected the old group/batch copy. The follow-up updates those assertions to `这一轮已经完成，可以重新练这轮卡。`, `重新练这轮卡`, and `本轮回看`.
