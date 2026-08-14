# Agent Run Record: listening formal-v2 candidate revalidation

## Task summary

- Date: 2026-08-14
- Branch: `cross/listening-formal-v2-candidate-revalidation`
- PR: pending
- Summary: Rebuilt the five-box, 60-card CET4 listening candidate from the latest individually reviewed `formal-v2` card heads, overlaid the 15 replacement TTS drafts only in a detached temporary snapshot, regenerated a strict unpublished audio-bundle candidate, and reran the merged mobile Learning acceptance path. This record preserves candidate-only evidence and does not claim formal content approval, human audio QC, private delivery, deployment, real-device playback, or launch readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`

## Product truth used

- Softbook CET remains a system-sequenced single-card CET4/6 product. The five owned interaction families remain flip, multiple choice, lock, elimination, and swipe; audio remains attached listening content rather than a sixth interaction family.
- Candidate content authority and formal approval remain in the external `/Users/lenkin/programing/card make` workspace. Product-side parsing, completion, and UI checks cannot create content approval.
- Human perceptual audio QC must be performed by an identified human. Decoder, hash, duration, transcript-presence, and UI-control checks cannot replace listening review.
- A detached combined snapshot, local manifest overlay, unpublished candidate payload, and simulator-backed repository test are all `gate_eligible=false` and cannot prove signed private delivery, persistent receiver state, real-device playback, deployment, or launch.

## Implementation hypothesis evaluated

- The already-merged `scripts/build_card_make_runtime_payload.mjs` and `scripts/run_audio_bundle_candidate_mobile_acceptance.mjs` should accept the repaired 60-card content without product code changes.
- Every card should parse, bind exactly one technically matched audio asset, and complete through its owned Learning evaluator.
- Every represented interaction family should complete through the real Learning UI, expose explicit audio controls, preserve result analysis, and avoid visible runtime metadata leakage.

## External candidate inputs

- `0012`: `b2fb4b7396336a9a7ff1d7f75b2ef86a6102501a`
- `0020`: `a7efc8872810ab834933ab1ec791632737d1bf8f`
- `0021`: `70f89058c91c769ca9c15afa0b870c9362245ff3`
- `0022`: `df4292a295ea3002551c6b3032cf3119b92c1c05`
- `0023`: `5c285af4710a4ede23c26fda542b58e763c64cde`
- Detached combined snapshot: `/private/tmp/card-make-listening-60-formal-v2-combined-20260814`
- Generated candidate directory: `/private/tmp/softbook-formal-v2-60-audio-bundle-candidate-20260814`
- The three `0012` replacement MP3s came from green candidate-audio PR `card-make#168`; the twelve `0022`/`0023` replacement MP3s remain local drafts and are not yet LFS PR evidence.

## Commands run

- `node scripts/validate_cards.mjs --report-path /private/tmp/formal-v2-combined-card-validation.json` in the detached card snapshot -> passed with 2,414 cards, 0 errors, and 0 warnings.
- `node scripts/audit_card_quality.mjs --scope-card-ids <60 IDs> --write-scope-report reviews/audit_scopes/20260814-formal-v2-combined-60-card-dry-run.json` -> passed; 60 cards, 0 hard blockers, 0 content risks, 0 review gaps, and 60 disclosed synthetic-source risks.
- `node scripts/audit_audio_technical.mjs --track cet4 --probe ffprobe --report-path /private/tmp/formal-v2-combined-cet4-audio-technical-audit.json` -> passed; 301/301 referenced CET4 assets technically verified, including all 15 replacement drafts.
- `node scripts/build_card_make_runtime_payload.mjs --card-make-root /private/tmp/card-make-listening-60-formal-v2-combined-20260814 --scope-card-ids <60 IDs> --output-dir /private/tmp/softbook-formal-v2-60-audio-bundle-candidate-20260814 --payload-mode audio-bundle-candidate --audio-technical-audit /private/tmp/formal-v2-combined-cet4-audio-technical-audit.json --source-id card-make-listening-formal-v2-candidate --source-label Card-make-listening-formal-v2-candidate` -> passed; 60 cards and 60 assets.
- `node scripts/run_audio_bundle_candidate_mobile_acceptance.mjs --candidate-payload /private/tmp/softbook-formal-v2-60-audio-bundle-candidate-20260814/card-make-listening-formal-v2-candidate-cet4-card-source.json` -> passed.

## Validation results

- Candidate payload SHA-256: `sha256:dea0e3dca2f4fe9b99098f712221122fbb181256339116d388985a67448bea9f`.
- Candidate content version: `sha256:0e15577dc23c493ae4bff353e77382f3f8ab2648f678d9cbfcfaf88ea5bba3f4`.
- Acceptance timestamp: `2026-08-14T12:48:31.543Z`.
- 60/60 cards parsed, 60/60 bound one matching audio asset, and 60/60 completed through their owned Learning semantics.
- Interaction distribution: 45 multiple-choice cards and 15 flip cards. Representative cards `001204` and `001201` completed through the actual Learning UI, exposed audio controls, opened result detail, preserved analysis, and showed no internal IDs, source labels, content version, release ID, or download URL.
- The strict report retained `signed_manifest_verified=false`, `human_audio_qc_verified=false`, `persistent_receiver_verified=false`, `real_device_verified=false`, and `gate_eligible=false`.

## Agent review status

- Reviewer: Codex self-review under the user's standing review authorization.
- Status: passed for candidate payload construction, product parser/evaluator compatibility, mobile Learning completion, audio-control rendering, and visible metadata containment.
- Blocking findings in product code: none.
- External blockers retained: formal content approval timestamp authorization, human perceptual QC for replacement audio, content/audio PR completion in `card make`, receiver-owned CloudBase profile and credentials, signed private delivery, deployment, and real-device verification.

## User-visible UI impact

- None. This PR records a rerun against the already-merged acceptance path and changes no production screen, component, layout, copy, interaction, motion, or design artifact.

## Workspace boundary

- `product_truth`: active product contracts and the merged candidate acceptance implementation in this repository.
- `implementation_hypothesis`: the five external formal-v2 candidate heads can flow through the current product parser, evaluator, audio binder, and Learning UI without additional product changes.
- External card content was read and combined only in `/private/tmp`. No card, review, approval, audit, audio asset, or LFS manifest was committed from this repository.
- The generated card-quality dry-run report and local manifest overlay are temporary non-authoritative artifacts.

## Risks and follow-up

- The 60-card candidate is assembled from five pushed but unmerged content heads, not rebuilt from authoritative merged `card make` main.
- Fifteen replacement TTS assets have technical checks only; twelve are not yet represented in a card-make LFS PR, and all fifteen still require identified-human perceptual QC.
- After the content and audio flows merge, rebuild from one authoritative `card make` main commit, rerun this acceptance command, then use receiver-owned credentials for signed private delivery and real-device iOS/Android learning verification.
