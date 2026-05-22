---
date: 2026-05-22
task: learning-session-label-copy
branch: module/learning-session-label-copy
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

# Learning session label copy correction

## product_truth

Learning is a single-card flow. User-visible session labels should orient the learner to the current learning or review round without exposing card-deck management vocabulary.

## implementation_hypothesis

The shared labels `本轮学习卡组` and `首轮回看卡组` over-emphasize an internal card-group frame. Replacing them with `本轮学习卡` and `本轮回看卡` preserves the visible learning/review scope while removing the deck/group term.

## changed_files

- `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`
- `apps/mobile/__tests__/spaceMetadataDisplay.test.ts`
- `apps/mobile/__tests__/App.test.tsx`
- `apps/mobile/__tests__/App.remoteFallback.test.tsx`
- `docs/agent-runs/2026-05-22-learning-session-label-copy.md`

## validation

Local gates before PR:

- `git diff --check`
- `npm --prefix apps/mobile run metadata-leak-scan`
- `python3 scripts/validate_harness.py`
- `PR_BODY="$(cat /tmp/softbook_learning_session_label_copy_pr_body.md)" python3 scripts/validate_agent_review.py`
- `PR_BODY="$(cat /tmp/softbook_learning_session_label_copy_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD`

## agent_review

This change is intentionally narrow: it changes the shared session label formatter and assertions that protect the user-visible string. It does not alter card payloads, learning state, space path labels, or interaction behavior.
