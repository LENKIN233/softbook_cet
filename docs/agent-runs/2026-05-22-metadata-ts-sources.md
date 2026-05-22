---
date: 2026-05-22
task: metadata-ts-sources
branch: infra/metadata-ts-sources
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

# Metadata scanner visible TS source coverage

## product_truth

Visible copy is not limited to TSX. Shared metadata label helpers and learning model labels also feed user-facing UI, so metadata leakage guardrails should cover those TS sources explicitly.

## implementation_hypothesis

The mobile metadata scanner already covers TSX render code and local seed card copy. Extending its visible-copy source list to include `src/learning/model.ts` and `src/shared/uiMetadata/displayMetadata.ts` closes the obvious non-TSX visible-label gap. Adding harness checks for the source list keeps that coverage from being removed silently.

## changed_files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-22-metadata-ts-sources.md`

## validation

Local gates before PR:

- `git diff --check` passed.
- `npm --prefix apps/mobile run metadata-leak-scan` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY="$(cat /tmp/softbook_metadata_ts_sources_pr_body.md)" python3 scripts/validate_agent_review.py` passed after validation records were normalized.
- `PR_BODY="$(cat /tmp/softbook_metadata_ts_sources_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.

## agent_review

This change is scanner/harness governance only. It does not change visible UI, runtime behavior, card payloads, learning state, layout, or interaction behavior.
