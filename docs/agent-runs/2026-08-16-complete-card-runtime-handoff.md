# Agent Run Record: Complete Card Runtime Handoff

## Task summary

- Date: 2026-08-16
- Branch: `cross/complete-card-runtime-handoff-v1`
- PR: pending
- Summary: Closed the remaining runtime-shape gaps in the complete CET4/CET6 candidate corpus, extended the product handoff bridge to normalize supported legacy option fields and canonical box metadata, generated 2,414 runtime cards, passed both import dry-runs, and exercised both full tracks through the local Softbook API smoke flow.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- External workspace: `/Users/lenkin/programing/card make/AGENTS.md`, `spec/authority-map.json`, `spec/workspace-contract.json`, `spec/content-quality-contract.json`, `spec/review-workflow.json`, `spec/card-metadata.schema.json`, and `spec/card-quality-audit.json`

## Product truth used

- `product_truth`: Softbook CET is a CET4/6 exam-prep product built around a single-card learning flow and the authoritative library/group/box hierarchy in `spec/box-catalog.json`.
- `product_truth`: `softbook_cet` consumes exported card payloads from the external `card make` workspace; it does not produce or formally approve candidate content.
- `product_truth`: Runtime card sources must satisfy the import contract, use canonical catalog paths, and cover the supported interaction families without silently accepting unknown box references or contradictory answer truth.
- `product_truth`: Candidate payload, dry-run import, and local runtime smoke are repository evidence only. They do not authorize a CloudBase write, production deployment, formal content approval, or launch.

## Implementation hypothesis changed

- The runtime payload bridge now consumes both canonical `options` and legacy `form_options`, preserving four-option order and converting option text or a unique `is_correct` flag into the runtime option ID.
- Contradictory `answer_key.correct_option` and `is_correct` values fail closed instead of selecting one silently.
- Runtime `space_metadata` is derived from the product-owned `box-catalog` by track and box prefix. External display-label drift is normalized; unknown prefixes fail closed.
- The local mock API can load validated CET4/CET6 card-source JSON through explicit environment variables, allowing the existing auth/bootstrap/session/card-source smoke to run against the complete corpus without a CloudBase write.

## Workspace boundary and read scope

- Product workspace read: the listed specs, the runtime bridge and tests, card-source catalog/import validation, mock API, smoke client, runtime contract, and prior runtime-bridge run record.
- External content workspace read and changed only on dedicated candidate branches: card JSON, scoped quality audits, agent self-review evidence, and Git handoff evidence for CET4 PR #182 and CET6 PR #184.
- Generated payloads and combined overlays were written only under `/private/tmp`; they are not active product truth and are not committed.
- Existing unrelated worktrees and untracked fixtures were preserved.

## Files changed

- `scripts/build_card_make_runtime_payload.mjs`: canonical catalog mapping, legacy form-option conversion, and fail-closed answer normalization.
- `scripts/test_build_card_make_runtime_payload.mjs`: regressions for boolean swipe IDs, both legacy form-option shapes, text-valued answers, answer conflicts, and catalog mapping.
- `infra/cloudbase/mock-softbook-api.mjs`: optional validated full-corpus payload injection for local smoke.
- `infra/cloudbase/README.md`: documents full-corpus mock inputs.
- `infra/cloudbase/mobile-runtime-contract.md`: records the local-only evidence boundary for injected payload smoke.
- `docs/agent-runs/2026-08-16-complete-card-runtime-handoff.md`: this run record.

## Commands run

- External combined validation: `node scripts/validate_cards.mjs` -> passed; 2,414 cards across 218 files, 0 errors, 0 warnings.
- External quality audit: `node scripts/audit_card_quality.mjs --report-path /private/tmp/final-overlay-quality-v3.json --max-examples 20` -> passed; `hard_blocker=0`, `content_risk=0`, `review_gap=0`; 2,336 disclosed synthetic-source risks remain non-launch source disclosures.
- External integrity tests: `node --test scripts/test_card_integrity.mjs` -> passed; 19/19.
- Product per-card runtime preflight -> passed; 2,414/2,414 cards build, every multiple-choice answer resolves to an emitted option, and every box prefix maps to the product catalog.
- `node scripts/test_build_card_make_runtime_payload.mjs` -> passed.
- Full payload build -> passed; CET4 1,180 cards (`sha256:6b9cc26d6d546df1507a4eb82338e47dd02104330570e0d72fbc2327366a3b41`) and CET6 1,234 cards (`sha256:080b7da0aece8ab1ac46222021a6668752e4b21223d2f8df3f6e33ab383a9153`).
- CET4 import dry-run -> passed; 1,180 cards, all five interactions, no CloudBase write.
- CET6 import dry-run -> passed; 1,234 cards, all five interactions, no CloudBase write.
- Local mock + `smoke-softbook-api.mjs`, CET4 -> passed auth rotation, bootstrap version, `trial_available` membership, 1,180-card source, all five interactions, and logout.
- Local mock + `smoke-softbook-api.mjs`, CET6 -> passed auth rotation, bootstrap version, `trial_available` membership, 1,234-card source, all five interactions, and logout.
- `node --check infra/cloudbase/mock-softbook-api.mjs` -> passed.
- `git diff --check` -> passed.
- `python3 scripts/validate_harness.py` -> passed; `HARNESS VALIDATION OK`.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed; 272/272.
- Mobile metadata and design-metadata scans -> passed.
- `npm ci` in `apps/mobile` and `apps/web` -> installed worktree-local dependencies after the first local-gate attempt reported missing `eslint`, `tsc`, and `vitest` binaries.
- `./scripts/run_local_gates --profile dev --verbose` final rerun -> `PASSED_WITH_EXCEPTION`; 23 passed, 0 failed, and one documented dev-only toolchain exception because Node 24.15.0 differs from the pinned Node 22.13.0.

## Validation results

- Complete product-shaped payload count is 2,414: CET4 1,180 and CET6 1,234. The previous 60-card quantity is only the controlled-pilot free subset and is not the corpus total.
- Five interactions are present in each validated track payload: `elimination`, `flip`, `lock`, `multiple_choice`, and `swipe`.
- The full payloads pass both in-process import/catalog validation and the standalone CloudBase import dry-run.
- The local API serves each full track consistently through bootstrap and card-source endpoints.
- Harness, 272 backend tests, 512 mobile tests, web lint/typecheck/12 tests/build, metadata scanners, and other local dev-profile gates pass; the only exception is the repository-defined dev Node-version drift allowance.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex
- Status: local review passed; required PR checks pending
- Blocking findings fixed during review: 19 missing flip backs, 60 missing CET6 group labels, 3 contradictory CET4 answer keys, legacy `form_options`, text-valued correct answers, and external catalog-label drift.
- Remaining blocking findings in the scoped repository implementation: none identified.

## User-visible UI impact

- None. This change affects card-source conversion and local runtime validation only. It does not change React Native UI, interaction semantics, visual design, or navigation.

## Card make external workspace impact

- CET4 candidate branch: all 1,180 track cards are covered; the final payload commit additionally corrects three stale answer keys and one missing flip back, with refreshed per-box audit and self-review evidence.
- CET6 candidate branch: all 1,234 track cards are covered; the final payload commit additionally fills 18 missing flip backs and canonical group metadata for 60 cards, with refreshed per-box audit and self-review evidence.
- The branches remain candidate content in draft PR #182 and draft PR #184. This run does not create formal approved-batch evidence and does not claim launch approval.

## Risks and open questions

- 2,336 cards are explicitly disclosed as synthetic preparation material; 78 are exam rewrites or partial-source items. This disclosure is intentional and must not be presented as true-exam provenance.
- Development payloads contain no audio assets. Listening audio delivery, independent perceptual QC, receiver-environment verification, formal release bundle, and launch gates remain separate.
- No `--apply` import or remote deployment was run because repository merge authority is not formal product-launch authority.

## Follow-up

- Push the two refreshed external candidate branches and leave their PRs draft under the content-approval boundary.
- Open the product PR, complete Agent review and required checks, and merge when repository gates pass.
- A later explicitly authorized release workflow may promote an approved content bundle and perform receiver-environment import/deployment; this record must not be reused as that authority.
