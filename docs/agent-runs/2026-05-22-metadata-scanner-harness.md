---
date: 2026-05-22
task: metadata-scanner-harness
branch: infra/metadata-scanner-harness
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

# Metadata scanner harness guard

## product_truth

User-visible Learning copy must not regress to internal group/deck/batch language after cleanup. Guardrails should be durable enough that removing a scanner rule or App-level visible-copy assertion becomes a harness failure.

## implementation_hypothesis

The mobile metadata scanner and App integration leakage guard already contain the old Learning group/deck phrases. Adding a harness self-check in the design governance layer makes those exact protections part of the repository-level validator without changing runtime UI.

## changed_files

- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-22-metadata-scanner-harness.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_metadata_scanner_harness_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_metadata_scanner_harness_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is harness/test governance only. It does not change runtime UI, scanner policy, mobile app behavior, card payloads, learning state, layout, or interaction behavior.

## local_follow_up

Initial harness wording assumed the mobile scanner would contain every old phrase literally. The scanner intentionally uses the broader `卡组` guard for deck wording, while App integration guard keeps the full old phrase set. The harness now checks those two guard styles separately.
