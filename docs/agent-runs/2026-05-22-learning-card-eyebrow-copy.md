---
date: 2026-05-22
task: learning-card-eyebrow-copy
branch: module/learning-card-eyebrow-copy
spec_refs:
  - spec/requirement-memory.json
  - spec/authority-map.json
  - spec/product-core.json
  - spec/card-system.json
  - spec/visual-language.json
  - spec/agent-harness.json
  - spec/evals.json
  - spec/repo-delivery-contract.json
  - spec/agent-run-record.json
status: ready-for-review
---

# Learning card eyebrow copy cleanup

## product_truth

Learning is a single-card flow. Local seed card display text can describe the current exercise, but it should not expose card-deck or batch-management vocabulary as visible copy.

## implementation_hypothesis

The local fallback/dev seed card eyebrow `本轮卡组 | ...` leaks an internal deck/group frame. Replacing it with `这张练习 | ...` preserves the visible exercise category while removing the deck-management wording. Adding `卡组` to the visible card content leak scanner prevents the same wording from returning in local visible seed content.

## changed_files

- `apps/mobile/src/learning/localCardRecords.ts`
- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `docs/agent-runs/2026-05-22-learning-card-eyebrow-copy.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_learning_card_eyebrow_copy_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_learning_card_eyebrow_copy_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is intentionally narrow: it only removes deck/group wording from local fallback card eyebrow text and adds a scanner guardrail. It does not create or approve card candidates, alter card facts, change imported payloads, or modify learning/runtime behavior.
