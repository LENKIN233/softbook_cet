---
date: 2026-05-22
task: learning-fallback-label-copy
branch: module/learning-fallback-label-copy
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

# Learning fallback session label cleanup

## product_truth

Learning is a single-card flow. When raw source labels are hidden, the fallback session label should orient the learner to the current round without introducing group/batch wording.

## implementation_hypothesis

The local fallback labels `这一组学习卡` and `这组回看卡` still expose a group/batch frame. Replacing them with `本轮学习卡` and `本轮回看卡` aligns this path with the shared session label correction. Adding a narrow metadata-leak scanner rule prevents those exact fallback strings from returning in visible UI copy.

## changed_files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `docs/agent-runs/2026-05-22-learning-fallback-label-copy.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_learning_fallback_label_copy_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_learning_fallback_label_copy_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is intentionally narrow: it only changes the fallback label used when raw source metadata is suppressed, updates its assertion, and adds a narrow scanner guardrail. It does not change learning state, source selection, card payloads, layout, or interaction behavior.

## remote_follow_up

The first remote design-artifact-gate run passed implementation checks but required more concrete Q1 checklist wording. The PR body now names Law of One current library evidence from `docs/design/decisions/learning-space-direction-decision-v1.md`.
