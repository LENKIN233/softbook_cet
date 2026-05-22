---
status: passed
branch: fix/learning-copy-review-findings
pr: pending
referenced_specs:
  - spec/requirement-memory.json
  - spec/product-core.json
  - spec/action-surface.json
  - spec/interactions.json
  - spec/visual-language.json
  - docs/design/single-card-ux-contract.md
  - docs/design/mapping/learning-space-implementation-map-v1.md
  - docs/design/interaction-motion/learning-card-rhythm-v1.md
  - docs/design/mocks/learning-card-rhythm-v1.md
---

# Agent run: learning copy review findings

## Scope

Fix review findings from the #127-#134 Learning visible-copy chain. This PR does not add new subjective copy. It repairs over-broad source-label sanitization, restores clear hint/peek distinction, and corrects an inaccurate prior run record.

## product_truth

Learning remains a guided single-card flow. Internal/system source labels should not leak to learners, but valid learner-facing collection names must not be erased. Hint and peek controls must remain distinguishable.

## implementation_hypothesis

The UI boundary can sanitize clear internal source labels (`系统顺序`, `卡源`, `catalog`) without treating every `卡组` label as metadata. The hint control can use `查看提示` / `收起提示` because the hard constraint is not to make a prompt layer a separate card type, not to ban the word `提示` from a current-card control.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-22-learning-hint-copy.md`
- `docs/agent-runs/2026-05-22-learning-copy-review-findings.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
