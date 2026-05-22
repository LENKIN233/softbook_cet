---
status: passed
branch: infra/learning-copy-governance
pr: pending
referenced_specs:
  - spec/requirement-memory.json
  - spec/product-core.json
  - spec/action-surface.json
  - spec/interactions.json
  - spec/visual-language.json
  - spec/agent-harness.json
  - spec/repo-delivery-contract.json
---

# Agent run: learning copy governance

## Scope

Add a durable PR-body gate for Learning user-visible copy changes after the #127-#135 review cycle showed subjective copy changes could pass as design/harness work.

## product_truth

Learning copy must remain grounded in product truth, accepted design artifacts, or explicit review findings. A passing scanner is not proof that a subjective phrase is product-correct.

## implementation_hypothesis

The design gate can require a `Learning microcopy basis` line for user-facing Learning UI changes, classifying the visible-copy impact as hard leak, spec-backed, design-backed, product correction, or no visible-copy change.

## Changed files

- `.github/pull_request_template.md`
- `scripts/validate_pr_design_gate.py`
- `docs/design/learning-microcopy-rules.md`
- `docs/agent-runs/2026-05-22-learning-copy-governance.md`

## Local verification

- `git diff --check` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --changed-file apps/mobile/src/learning/LearningSurface.tsx` failed without `Learning microcopy basis`.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --changed-file apps/mobile/src/learning/LearningSurface.tsx` passed with `Learning microcopy basis: product correction`.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
