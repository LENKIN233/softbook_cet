---
date: 2026-05-22
task: visible-copy-guardrail
branch: infra/visible-copy-guardrail
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

# Visible copy guardrail sync

## product_truth

User-visible Learning copy must not expose internal source, queue, group, deck, or batch framing. Recent cleanup removed the visible strings from implementation; App-level leakage assertions should also block those exact strings from returning anywhere in primary app surfaces.

## implementation_hypothesis

The mobile metadata scanner now blocks the old Learning group/deck phrases, but the App integration leakage regex still lacked those exact phrases. Adding them to the App-level guard creates a second, user-surface-oriented regression check without changing runtime behavior.

## changed_files

- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-22-visible-copy-guardrail.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_visible_copy_guardrail_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_visible_copy_guardrail_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is test-only plus run-record documentation. It does not change visible UI, runtime behavior, card payloads, learning state, layout, or scanner policy.
