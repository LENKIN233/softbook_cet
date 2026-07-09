# Agent Run Record: Candidate Content Gap Delta

## Task summary

- Date: 2026-07-09
- Branch: codex/infra/candidate-content-gap-delta-20260709
- PR: https://github.com/LENKIN233/softbook_cet/pull/400
- Summary: Extended the release content gap report so validated candidate `card-source` payloads can be supplied as dry-run handoff inputs and reported as projected catalog gap deltas. Refreshed the tracked baseline report while keeping candidate content outside the active repository development source.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- External workspace references: `/Users/lenkin/programing/card make/AGENTS.md`

## Product truth used

- `product_truth`: Softbook CET is a CET4/6 exam-prep product with single-card learning flow and physical space hierarchy.
- `product_truth`: Public release content must map to active `spec/box-catalog.json` prefixes and satisfy mobile card-source runtime contract fields before import.
- `product_truth`: Candidate content production and formal approval remain in `/Users/lenkin/programing/card make`; this repository consumes exported payloads, dry-run/import evidence, audit evidence, runtime smoke, and release content gap deltas only.
- `product_truth`: Passing candidate validators, runtime payload conversion, dry-run import, or a release gap delta projection is not formal card approval and does not create `reviews/approved_batches/`.

## Implementation hypothesis changed

- `scripts/report_release_content_gap.mjs` now accepts repeatable `--candidate-card-source <json>` inputs.
- Candidate sources are validated through `validateCardSourceForImport` and `validateCardSourceCatalogMapping` before they are counted.
- The report now emits `candidate_handoff_delta` in JSON and a `Candidate Handoff Delta` section in Markdown when candidate sources are provided.
- Candidate deltas are projections only: they quantify how validated candidate payloads would reduce mapped catalog gaps without changing the repository development card source, applying production imports, or proving Apple release readiness.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/workspace-boundary.json`, `spec/agent-run-record.json`, `spec/repo-delivery-contract.json`, `spec/evals.json`, `spec/product-core.json`, `spec/card-system.json`, `spec/box-catalog.json`, `spec/membership.json`, `spec/platform-contract.json`, `infra/cloudbase/mobile-runtime-contract.md`, `scripts/report_release_content_gap.mjs`, `scripts/build_card_make_runtime_payload.mjs`, `infra/cloudbase/card-source-catalog.mjs`, `infra/cloudbase/functions/softbook-api/index.js`, `docs/release/content-gap-report.md`.
- Generated/dependency/cache/archive read: none. Existing local `exports/` remains untracked workspace state and was not used as semantic authority.
- External workspace read: `/Users/lenkin/programing/card make` through the already merged runtime payload bridge, scoped to PR #50 candidate card IDs. No files were modified in the external workspace.

## Files changed

- `scripts/report_release_content_gap.mjs`: Adds validated candidate card-source inputs and JSON/Markdown delta reporting.
- `docs/release/content-gap-report.md`: Refreshes the baseline report and clarifies that candidate handoff deltas do not prove approval, import application, or App Store readiness.
- `docs/agent-runs/2026-07-09-candidate-content-gap-delta.md`: This run record.

## Commands run

- `node scripts/build_card_make_runtime_payload.mjs --scope-card-ids 050206,150101,150102,150103,150104,150105,150106,150107,150108,150109,150110,150111,150112 --output-dir /tmp/softbook-card-make-runtime-payloads-delta-final-20260709 --source-id card-make-pr50-20260709-vocabulary --source-label "Card make PR50 2026-07-09 vocabulary candidates"` -> passed; generated 1 CET4 card-source card and 12 CET6 card-source cards.
- `node --check scripts/report_release_content_gap.mjs` -> passed.
- `node scripts/report_release_content_gap.mjs --format json --output /tmp/softbook-content-gap-delta-final-20260709.json --candidate-card-source /tmp/softbook-card-make-runtime-payloads-delta-final-20260709/card-make-pr50-20260709-vocabulary-cet4-card-source.json --candidate-card-source /tmp/softbook-card-make-runtime-payloads-delta-final-20260709/card-make-pr50-20260709-vocabulary-cet6-card-source.json` -> passed.
- `node scripts/report_release_content_gap.mjs --output /tmp/softbook-content-gap-delta-final-20260709.md --candidate-card-source /tmp/softbook-card-make-runtime-payloads-delta-final-20260709/card-make-pr50-20260709-vocabulary-cet4-card-source.json --candidate-card-source /tmp/softbook-card-make-runtime-payloads-delta-final-20260709/card-make-pr50-20260709-vocabulary-cet6-card-source.json` -> passed.
- `node scripts/report_release_content_gap.mjs --format json --output /tmp/softbook-content-gap-default-final-20260709.json` -> passed; `.candidate_handoff_delta == null`.
- `node scripts/report_release_content_gap.mjs --output docs/release/content-gap-report.md` -> passed.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `git diff --check` -> passed.

## Validation results

- Candidate delta JSON projected CET4: 1 candidate card, 1 new mapped card, full gap delta 1, projected full gap 1174, free-target gap delta 1, projected free-target gap 584.
- Candidate delta JSON projected CET6: 12 candidate cards, 12 new mapped cards, full gap delta 12, projected full gap 1217, free-target gap delta 12, projected free-target gap 600.
- Default report mode remains baseline-only and does not emit `candidate_handoff_delta`.
- Current release content gap remains a blocker for Apple public release content sufficiency: CET4 still needs 584 projected free-target cards after this candidate delta and CET6 still needs 600 projected free-target cards after this candidate delta.
- CI validation: pending PR.

## Agent review status

- Reviewer: codex
- Status: Passed local review; PR checks pending
- Blocking findings: none identified in the scoped report/delta path

## User-visible UI impact

- N/A. This change updates a command-line report and release evidence only. It does not change React Native UI, navigation, visual design, interaction semantics, screenshots, or motion.

## Card make external workspace impact

- Read-only. The candidate payloads used for verification were generated under `/tmp/softbook-card-make-runtime-payloads-delta-final-20260709`.
- No candidate cards, reviews, approvals, audio records, or `reviews/approved_batches/` were modified in `card make`.
- The delta projection validates runtime and catalog compatibility only; it is not formal content approval and does not imply production import readiness.

## Risks and open questions

- Apple release content sufficiency remains unachieved because the projected free-target gaps are still large: CET4 584 and CET6 600.
- Candidate payloads are intentionally not committed because they are candidate handoff artifacts, not active product truth.

## Follow-up

- Continue reducing the release content gap through approved card batches and dry-run/import evidence.
- Keep PR #50 candidate status separate from formal approval until `card make` records user-approved batches.
