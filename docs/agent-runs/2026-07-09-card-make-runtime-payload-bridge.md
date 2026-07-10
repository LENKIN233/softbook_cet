# Agent Run Record: Card Make Runtime Payload Bridge

## Task summary

- Date: 2026-07-09
- Branch: codex/infra/card-make-runtime-payload-20260709
- PR: https://github.com/LENKIN233/softbook_cet/pull/399
- Summary: Added a read-only handoff tool that converts scoped candidate cards from the external `card make` workspace into mobile runtime `card-source` payloads, then validates those payloads with the existing CloudBase import contract. Refreshed the release content gap report so Apple-readiness content coverage evidence is current.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- External workspace references: `/Users/lenkin/programing/card make/AGENTS.md`, `/Users/lenkin/programing/card make/spec/workspace-contract.json`, `/Users/lenkin/programing/card make/spec/content-quality-contract.json`, `/Users/lenkin/programing/card make/spec/review-workflow.json`

## Product truth used

- `product_truth`: Softbook CET is a CET4/6 exam-prep product with a single-card learning flow and physical space hierarchy.
- `product_truth`: Public release content must map to active `spec/box-catalog.json` prefixes and satisfy mobile card-source contract fields before import.
- `product_truth`: Candidate content production and approval remain in `/Users/lenkin/programing/card make`; this repository may consume exported payloads, dry-run/import evidence, audit evidence, runtime smoke, and release content gap deltas only.
- `product_truth`: Passing candidate validators or dry-run import is not formal card approval and does not create `reviews/approved_batches/`.

## Implementation hypothesis changed

- Added `scripts/build_card_make_runtime_payload.mjs` as a handoff helper for scoped candidate cards. It reads external `card make` card JSON, derives mobile `LearningCardRecord` fields, groups records by track, and immediately validates generated payloads through `validateCardSourceForImport` plus `validateCardSourceCatalogMapping`.
- Refreshed `docs/release/content-gap-report.md` with the current generated timestamp. Coverage numbers remain unchanged: CET4 has 5 mapped dev cards out of 1180 planned, and CET6 has 5 mapped dev cards out of 1234 planned.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/agent-run-record.json`, `spec/workspace-boundary.json`, `spec/runtime-boundaries.json`, `spec/repo-delivery-contract.json`, `infra/cloudbase/mobile-runtime-contract.md`, `scripts/report_release_content_gap.mjs`, `infra/cloudbase/import-card-source.mjs`, `infra/cloudbase/audit-card-sources.mjs`, `infra/cloudbase/card-source-catalog.mjs`, `infra/cloudbase/functions/softbook-api/index.js`, `apps/mobile/src/learning/sourceContract.ts`, `apps/mobile/src/learning/model.ts`, `apps/mobile/src/learning/localCardRecords.ts`, `docs/release/content-gap-report.md`.
- Generated/dependency/cache/archive read: none. Existing local `exports/` screenshot package was observed as untracked workspace state but not used as semantic authority.
- External workspace read: `/Users/lenkin/programing/card make/AGENTS.md`, `/Users/lenkin/programing/card make/spec/*` relevant to candidate boundaries, `/Users/lenkin/programing/card make/card_boxes_json/card_boxes_seed_cet4_vocabulary_0502.json`, `/Users/lenkin/programing/card make/card_boxes_json/card_boxes_seed_cet6_vocabulary_1501.json`, and PR #50 scoped evidence for the 2026-07-09 vocabulary candidate repair.

## Files changed

- `scripts/build_card_make_runtime_payload.mjs`: New read-only bridge from scoped external card-make candidates to mobile runtime card-source JSON, with built-in import/catalog validation.
- `docs/release/content-gap-report.md`: Refreshed generated timestamp from the current repository development source.
- `docs/agent-runs/2026-07-09-card-make-runtime-payload-bridge.md`: This run record.

## Commands run

- `git fetch origin --prune` in `softbook_cet` -> passed.
- `git fetch origin --prune` in `card make` -> passed.
- `gh pr view 50 --repo LENKIN233/card-make --json number,title,state,isDraft,mergeStateStatus,url,headRefName,baseRefName,headRefOid,statusCheckRollup,updatedAt` -> PR #50 open draft, head `content/front-leak-candidate-queue`, head `f0a2fbf8ee25284622ff67ad9a9935c15dcf9cc4`, merge state `CLEAN`, no status checks returned.
- `node scripts/report_release_content_gap.mjs --format json --output /tmp/softbook-content-gap-current.json` -> passed; current summary remained CET4 5/1180 mapped, CET6 5/1234 mapped.
- `node scripts/build_card_make_runtime_payload.mjs --scope-card-ids 050206,150101,150102,150103,150104,150105,150106,150107,150108,150109,150110,150111,150112 --output-dir /tmp/softbook-card-make-runtime-payloads-20260709 --source-id card-make-pr50-20260709-vocabulary --source-label "Card make PR50 2026-07-09 vocabulary candidates"` -> passed; generated `/tmp/softbook-card-make-runtime-payloads-20260709/card-make-pr50-20260709-vocabulary-cet4-card-source.json` with 1 CET4 card and `/tmp/softbook-card-make-runtime-payloads-20260709/card-make-pr50-20260709-vocabulary-cet6-card-source.json` with 12 CET6 cards.
- `node infra/cloudbase/import-card-source.mjs --file /tmp/softbook-card-make-runtime-payloads-20260709/card-make-pr50-20260709-vocabulary-cet4-card-source.json --track cet4` -> passed dry-run; validated 1 CET4 lock card and made no CloudBase write.
- `node infra/cloudbase/import-card-source.mjs --file /tmp/softbook-card-make-runtime-payloads-20260709/card-make-pr50-20260709-vocabulary-cet6-card-source.json --track cet6` -> passed dry-run; validated 12 CET6 cards across `flip`, `lock`, and `multiple_choice`, and made no CloudBase write.
- `node scripts/report_release_content_gap.mjs --output docs/release/content-gap-report.md` -> passed; refreshed current release gap report.
- `node --check scripts/build_card_make_runtime_payload.mjs` -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- Final rerun: `node scripts/build_card_make_runtime_payload.mjs --scope-card-ids 050206,150101,150102,150103,150104,150105,150106,150107,150108,150109,150110,150111,150112 --output-dir /tmp/softbook-card-make-runtime-payloads-20260709-final --source-id card-make-pr50-20260709-vocabulary --source-label "Card make PR50 2026-07-09 vocabulary candidates"` -> passed.
- Final rerun: `node infra/cloudbase/import-card-source.mjs --file /tmp/softbook-card-make-runtime-payloads-20260709-final/card-make-pr50-20260709-vocabulary-cet4-card-source.json --track cet4` -> passed dry-run; validated 1 CET4 lock card and made no CloudBase write.
- Final rerun: `node infra/cloudbase/import-card-source.mjs --file /tmp/softbook-card-make-runtime-payloads-20260709-final/card-make-pr50-20260709-vocabulary-cet6-card-source.json --track cet6` -> passed dry-run; validated 12 CET6 cards across `flip`, `lock`, and `multiple_choice`, and made no CloudBase write.

## Validation results

- Runtime payload conversion validated in-process with `validateCardSourceForImport` and `validateCardSourceCatalogMapping`.
- CloudBase import dry-run validated both generated payloads and made no remote writes.
- `python3 scripts/validate_harness.py`, CloudBase function tests, metadata leak scan, design metadata leak scan, `node --check`, and `git diff --check` all passed locally.
- Current release content gap remains a blocker for Apple public release content sufficiency: CET4 still needs 585 more mapped cards to reach the near-half free target, and CET6 still needs 612 more mapped cards to reach the near-half free target.
- CI validation: pending PR.

## Agent review status

- Reviewer: codex
- Status: Passed local review; PR checks pending
- Blocking findings: none identified in the scoped conversion/dry-run path

## User-visible UI impact

- N/A. This change adds a command-line handoff tool and refreshes a release content report only. It does not change React Native UI, navigation, visual design, interaction semantics, or screenshots.

## Card make external workspace impact

- Read-only. The tool consumed card IDs from the pushed PR #50 candidate queue and wrote generated runtime payloads only to `/tmp/softbook-card-make-runtime-payloads-20260709`.
- No candidate cards, reviews, approvals, audio records, or `reviews/approved_batches/` were modified in `card make`.
- Dry-run import validates runtime compatibility only; it is not formal content approval and does not imply production import readiness.

## Risks and open questions

- The bridge derives mobile `front.support`, `front.context`, and analysis summary fields from candidate metadata and analysis. This is acceptable for dry-run validation, but any production import still needs explicit content approval in `card make`.
- The current repository development source still has only 5 mapped cards per track, so Apple release content sufficiency remains unachieved.
- Generated payloads are intentionally not committed because they are candidate handoff artifacts, not active product truth.

## Follow-up

- Use the bridge against the next approved or candidate review scope to produce repeatable dry-run evidence.
- Add a formal export step in `card make` only if the content workspace owners decide candidate-to-runtime payload generation should originate there.
- Do not run `--apply` or claim production content readiness until explicit approval and release import scope are provided.
