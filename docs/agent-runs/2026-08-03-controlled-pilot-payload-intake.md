# Agent Run Record: controlled-pilot payload intake

## Task summary

- Date: 2026-08-03
- Branch: `cross/controlled-pilot-payload-intake`
- Parent branch / PR: `infra/controlled-pilot-runtime` / PR #474
- Summary: Extended the existing read-only card-make consumer bridge so one validated sample-confirmation record and its exact expansion reviews deterministically produce a 120-card CET4 controlled-pilot candidate, a stable 60-card all-library free prefix, 24 hash-bound copied audio assets, and a release-bundle-compatible card source without treating candidate evidence as formal approval.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- External card workspace: `spec/workspace-contract.json`, `spec/content-quality-contract.json`, `spec/review-workflow.json`, `spec/audio-generation-contract.json`, `spec/audio-perceptual-worklist.schema.json`, and `reviews/sample_confirmations/20260802-cet4-controlled-pilot-14-boxes.json`.

## Product truth used

- `product_truth`: The controlled pilot contains exactly 120 CET4 cards with distribution 24 listening, 24 careful reading, 16 cloze, 16 writing, 16 translation, 12 vocabulary and 12 grammar.
- `product_truth`: The first 60 cards remain the stable free subset and must cover all seven libraries. This run selects exactly half of each confirmed box and round-robins the 14 boxes before appending the remaining halves.
- `product_truth`: Every selected card must map to the active product-owned box catalog and all five core interactions must appear.
- `product_truth`: Listening content must retain private audio identity, hash, duration and transcript binding. Technical verification cannot be represented as human perceptual QC.
- `product_truth`: Candidate work, dry-runs and local runtime smoke remain `gate_eligible=false` and cannot count as formal content approval, closed-beta evidence or launch readiness.

## Implementation hypothesis changed

- `scripts/build_card_make_runtime_payload.mjs` now accepts one exact `--scope-confirmation` and derives selected IDs from its sample IDs plus one exact target-minus-sample expansion review per box. It refuses missing, duplicate, non-passing, over-target or under-target selection evidence.
- `controlled-pilot-candidate` mode requires a fully passing technical audio audit, rechecks each selected audio file's bytes, copies the 24 assets into a bundle-local path, and emits release-bundle audio/card bindings.
- Candidate validation now enforces 120/60 counts, exact per-library totals, half-distribution in the free prefix, at least two boxes per library, all five interactions, and exactly 24 listening audio assets.
- Boolean swipe IDs are normalized to runtime strings; a null canonical answer remains a hard conversion failure rather than receiving a guessed fallback.
- The candidate selection manifest explicitly records `candidate_not_formally_approved` and `gate_eligible=false`.

## Workspace boundary and read scope

- `softbook_cet` remains the payload consumer, validator and runtime-smoke workspace. It does not author or approve card content in this PR and does not commit candidate card or audio payload bytes.
- The sibling card workspace was read from the latest clean `card-make` main worktree to consume the confirmed 14-box record, reviewed cards and audio technical audit.
- Consumer fail-closed checks exposed two source defects. They were corrected in the external source through card-make PR #146 (null swipe answer) and PR #147 (catalog-path drift), each with scoped review/audit and full required gates, before payload generation was rerun.
- Generated payloads and copied audio remained under `/private/tmp`; they are reproducible local artifacts, not repository evidence or formal release inputs.

## Files changed

- `scripts/build_card_make_runtime_payload.mjs`
- `scripts/test_build_card_make_runtime_payload.mjs`
- `docs/agent-runs/2026-08-03-controlled-pilot-payload-intake.md`

## Commands run

- `node scripts/test_build_card_make_runtime_payload.mjs`
- `node --check scripts/build_card_make_runtime_payload.mjs`
- `node scripts/build_card_make_runtime_payload.mjs --scope-confirmation ... --payload-mode controlled-pilot-candidate --audio-technical-audit ...`
- `node scripts/build_card_make_runtime_payload.mjs --scope-confirmation ... --payload-mode development ...`
- `node infra/cloudbase/import-card-source.mjs --file <generated-development-payload> --track cet4` (dry-run only)
- In-memory API smoke: request/verify v2 auth, fetch exact card source, bootstrap canonical state, and fetch first Learning Session from the generated 120-card development payload.
- Candidate aggregate check: recalculate library, free-library, interaction, box and audio counts and rehash all 24 copied audio files.
- `npm test` in `infra/cloudbase/functions/softbook-api`.
- `python3 scripts/validate_harness.py` and `git diff --check`.
- Card-make validation and PR gates for source corrections #146 and #147.

## Validation results

- Unit tests passed, including 14-box confirmation derivation, exact 120/60 ordering, seven-library free coverage, candidate boundary flags and boolean swipe normalization.
- Release-bundle candidate generation passed with 120 cards, 24 audio cards/assets and content version `sha256:bfa7058fb3be9992ae0372780108c5dc3ef05e1e1da11d09f263775e39012e0e`.
- Full distribution passed: listening 24, careful reading 24, cloze 16, writing 16, translation 16, vocabulary 12 and grammar 12. The first 60 contain exact half-distribution across all seven libraries and all 14 selected boxes are represented.
- Interaction coverage passed: flip 22, multiple choice 59, lock 17, elimination 10 and swipe 12.
- All 24 copied audio files matched the technical audit's SHA-256 and byte size; card bindings also matched duration and transcript.
- Development import dry-run validated all 120 cards, catalog placement and all five interactions without CloudBase writes.
- In-memory runtime smoke returned 200 for v2 authentication, exact card-source read, Bootstrap and Learning Session; the server selected card `000001` from the imported 120-card source.
- Full CloudBase API regression passed: 238/238 tests. Harness validation returned `HARNESS VALIDATION OK` and diff whitespace validation passed.
- The first conversion correctly failed on card `040105`'s null swipe answer. After source PR #146 merged, it correctly failed on stale 0311/0630 catalog labels. After source PR #147 merged, the exact candidate conversion passed without consumer fallback.

## Agent review status

- Reviewer: Codex
- Status: Passed for repository implementation and candidate intake boundary.
- Blocking findings resolved: silent audio omission, boolean swipe serialization, null canonical swipe answer, and two active-catalog path mismatches.
- Boundary finding retained: no human audio perceptual review or formal 120-card approval is represented as complete.

## User-visible UI impact

- None. This PR changes no screen, navigation, copy, design token, animation or mobile interaction implementation.
- The dedicated signed-out login gate remains in stacked mobile PR #475 and is not altered by this intake work.

## Card-make external workspace impact

- Card-make PR #146 merged the source-of-truth `040105` canonical answer correction (`false`) after consumer conversion proved it could not be scored.
- Card-make PR #147 merged active catalog metadata for the exact selected 0311 and 0630 candidate cards after consumer mapping validation rejected historical labels.
- No candidate content was formally approved, no audio QC row was marked passed, and no `reviews/approved_batches` record was created.

## Risks and open questions

- All 24 selected audio assets still require a real human reviewer to complete pronunciation, rhythm, stress, pause, noise/clipping and speech/transcript perceptual checks. The 301-item track worklist remains pending.
- The complete 120-card candidate still requires one explicit formal content approval artifact before `controlled-pilot-bundle.v1` may validate; this run must not manufacture it.
- A receiver-owned profile/environment, signing key, real SMS credentials, private asset upload, receiver deployment, account-deletion drill and real-device evidence remain external gates.
- The generated development payload intentionally omits audio because the development importer requires receiver storage file IDs. The release-bundle candidate is the authoritative audio-bearing artifact and is published only through the controlled-pilot uploader after approval/QC.

## Follow-up

- Complete human perceptual QC for the 24 selected listening assets (and continue the 301-item whole-track worklist without treating automation as a reviewer).
- Record the explicit 120-card approval only after the user reviews the complete candidate scope; then construct and verify the exact controlled-pilot profile/bundle artifacts.
- After the contract/design/runtime/mobile PR stack is merged, run the receiver dry-run, private upload/reread, staged validation, activation-last workflow and iOS/Android device acceptance.
