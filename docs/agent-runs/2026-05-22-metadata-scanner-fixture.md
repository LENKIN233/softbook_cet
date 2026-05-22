---
date: 2026-05-22
task: metadata-scanner-fixture
branch: infra/metadata-scanner-fixture
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

# Metadata scanner visible TS fixture

## product_truth

User-visible Learning copy must not regress to internal group/deck/batch wording through non-TSX visible-copy sources such as shared display labels or model labels.

## implementation_hypothesis

The previous guard checked that visible TS sources are listed in the mobile metadata scanner. A harness negative fixture should also prove behavior: if `model.ts` or `displayMetadata.ts` contains old deck wording, the real scanner must fail and name those files.

## changed_files

- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-22-metadata-scanner-fixture.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_metadata_scanner_fixture_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_metadata_scanner_fixture_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is harness-only. It does not change scanner policy, runtime UI, mobile behavior, card payloads, learning state, layout, or interaction behavior.
