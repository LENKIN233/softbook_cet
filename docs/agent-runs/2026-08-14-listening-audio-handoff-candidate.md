# Agent Run Record: listening-card audio handoff candidate

## Task summary

- Date: 2026-08-14
- Branch: `cross/listening-card-audio-handoff`
- PR: https://github.com/LENKIN233/softbook_cet/pull/504
- Summary: Extended the external `card make` runtime bridge with a scoped audio-bundle candidate mode, then validated each of the five exact CET4 listening candidate heads as a 12-card/12-audio product payload without publishing, deploying, or claiming perceptual audio quality.

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

- Softbook CET remains an exam-oriented, low-burden, system-sequenced single-card learning product; cards and their five core interaction families are the learning unit.
- Audio is required front content for listening cards, is not a separate interaction family, never autoplays, and carries stable asset identity, SHA-256, duration, and optional back-side transcript without a download URL.
- Candidate production, review, approval, and audio-QC authority remain in the external `/Users/lenkin/programing/card make` workspace. This repository only consumes scoped payloads and validates their catalog/runtime fit.
- Repository validation, technical audio inspection, and product import-candidate generation do not establish human perceptual audio QC or formal launch readiness.

## Implementation hypothesis changed

- `scripts/build_card_make_runtime_payload.mjs` now supports `audio-bundle-candidate` for an explicit listening-card ID scope plus a passing `audio-technical-audit.v1` report.
- The new mode reuses the existing release-bundle validator, copies the exact audited MP3 bytes to safe relative `asset_path` locations, and binds card audio to the audited SHA-256, duration, size, and transcript. It also rejects incomplete verification fields, count drift, invalid or duplicate card IDs, cross-track source paths, track drift, non-listening scopes, and any scoped card without a one-to-one audited asset.
- The mode does not emit CloudBase `storage_file_id` values and cannot be applied with the development importer. It is a local pre-publication integration artifact only.

## Workspace boundary and read scope

- Active truth/source read: the listed specs/contracts, the current runtime payload bridge and tests, card-source validators, import policy, and release-bundle audio schema.
- Generated/dependency/cache/archive read: existing installed backend dependencies were used only to execute committed validation code; no dependency tree or generated artifact was treated as semantic authority. Temporary payloads and audit reports were written under `/private/tmp` and are not repository artifacts.
- External workspace read: the five exact scoped worktrees for candidate heads `0cc72b2dc89365f2359d28ad803049a57201878f`, `44934c381f3f6fb8ef67946bc73ed348fa0e7299`, `c363ca2e945badf595225180cb6eb1c3eef3fd93`, `87835a6f3dfa666a7d05a5083f20aaf8fd156cb9`, and `1c4761f6eddf010ef6bdce2ec896f20e0721628b`; no external card, review, approval, or audio file was modified.

## Files changed

- `scripts/build_card_make_runtime_payload.mjs`: added scoped `audio-bundle-candidate` parsing, technical-audit binding, release-bundle validation routing, and testable exports.
- `scripts/test_build_card_make_runtime_payload.mjs`: added an end-to-end temporary-fixture test for audited audio copying, descriptor binding, content-version validation, missing-audit rejection, incomplete-verification rejection, and missing listening-audio rejection.
- `infra/cloudbase/mobile-runtime-contract.md`: documented the new local-only candidate mode and its non-approval/non-QC/non-deployment boundary.
- `docs/agent-runs/2026-08-14-listening-audio-handoff-candidate.md`: this durable record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed in the isolated product worktree.
- `node --check scripts/build_card_make_runtime_payload.mjs` -> passed.
- `node scripts/test_build_card_make_runtime_payload.mjs` with the repository's installed backend dependency path -> passed.
- `node scripts/audit_audio_technical.mjs --track cet4 --probe afinfo ...` once per exact candidate head -> passed on all five heads; each report covered 301/301 referenced CET4 assets with 0 errors.
- `node scripts/build_card_make_runtime_payload.mjs --payload-mode development ...` once per exact candidate head -> passed for five 12-card payloads.
- `node infra/cloudbase/import-card-source.mjs --file ... --track cet4` in dry-run mode once per development payload -> passed for all five scopes; no CloudBase write occurred.
- `node scripts/build_card_make_runtime_payload.mjs --payload-mode audio-bundle-candidate ...` once per exact candidate head -> passed for five 12-card/12-audio bundles.
- `node scripts/build_card_make_runtime_payload.mjs --payload-mode controlled-pilot-candidate ...` against the preserved 120-card fixture -> passed with 120 cards and 24 audio assets, proving the pre-existing controlled-pilot path remains compatible.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_harness.py` -> passed, including remote delivery-governance checks.
- `git diff --check` -> passed.

## Validation results

- Card/catalog/runtime mapping: 60/60 scoped cards passed the current mobile card-source and active box-catalog validators when tested as five exact 12-card heads.
- Development import dry-run: five of five payloads passed; each remained `release=null` and performed no external write.
- Audio technical binding: every scoped listening card produced one exact MP3 descriptor and one copied asset; all five strict bundle-candidate reruns contain 12 cards and 12 audio assets. Audit totals, five required technical pass fields, explicit non-perceptual boundary fields, unique card IDs, track, per-file hash/size, and per-card duration/transcript bindings were rechecked by the consumer.
- Technical audits: file hash/size, decoder probe, declared duration, transcript presence, format, channel count, sample rate, and bitrate passed; the reports explicitly retain speech-to-transcript and perceptual checks as unverified.
- Final strict candidate versions: 0012 `sha256:23f5d1569b9427ec02bba2c385f965fb1660159d943795f4ec7ebc31ed31c78a`; 0020 `sha256:09cea91ea70370405199479b956d604e60c2fb51cd9bf01940df762cede5859c`; 0021 `sha256:90689fc378080bc7c11e08fcb85cb2d323993c07ff414d65d74250c75e9743e2`; 0022 `sha256:52a65e704ee9404ea854278ff521f610db8b4494d4d8f223c0d7993cab63ffa3`; 0023 `sha256:a7323c81ab0f46e391e019a848010c93e4e0b8ebc9faa9520780f0d743b624b6`.
- Controlled-pilot non-regression: the preserved source fixture still produced 120 cards/24 audio assets with content version `sha256:50fcee0bdbb4fc513875a2ad41c63dcefe3d4ba0f51b41d6b2e13fa627f78053`.
- Combined 60-card payload: not yet asserted because the five user-authorized candidate scopes have not all been merged into one authoritative `card make` main snapshot.

## Agent review status

- Reviewer: Codex self-review under the user's standing review authorization.
- Status: passed for repository implementation and candidate intake boundary.
- Findings resolved during review: the first draft inherited a CET4-only output path, accepted under-specified audit summaries, allowed a listening card to omit audio, and did not forbid mixed-library or cross-track scoped bundles. The final implementation makes each case fail closed and retains a focused regression test.
- Residual review boundary: GitHub required checks still run after the PR is opened; perceptual audio QC, content approval completion, publishing, deployment, and launch remain out of scope.

## User-visible UI impact

- None. No mobile screen, interaction, motion, copy, or layout changes.
- The change only enables a more faithful input artifact for the already-implemented audio-aware Learning runtime.

## Card make external workspace impact

- Read-only. Five exact candidate heads and their MP3 files were consumed through the explicit handoff boundary.
- No candidate card content, self-review, approval record, scoped audit, technical audit authority, perceptual review, or MP3 file was changed in `card make`.
- Temporary technical reports and payload bundles live outside both repositories under `/private/tmp`.

## Risks and open questions

- The five content branches are not yet one merged authoritative corpus snapshot; a final combined 60-card payload and single content version must be generated after those repository merges.
- Human perceptual audio QC remains incomplete. The new mode deliberately cannot turn technical audit evidence into formal audio readiness.
- No CloudBase asset upload, private-object mapping, receiver publish, runtime deployment, real-device playback, or formal launch action occurred.
- Cards `001207`, `001209`, and `001210` retain the already-recorded legacy pronunciation-defect teaching boundary; `002207`–`002212` and `002307`–`002312` remain explicit meta-language diagnostics rather than positive listening examples.

## Follow-up

- Finish and merge the exact card-workspace approval scopes, rebuild one combined 60-card/60-audio candidate from the merged external main snapshot, and run product-level Learning acceptance against that single content version.
- Keep perceptual QC and formal release publication as separate future gates; do not promote this candidate mode or its temporary files to launch evidence.
