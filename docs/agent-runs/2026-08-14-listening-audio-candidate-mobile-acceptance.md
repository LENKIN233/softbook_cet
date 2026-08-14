# Agent Run Record: listening audio candidate mobile acceptance

## Task summary

- Date: 2026-08-14
- Branch: `cross/listening-candidate-mobile-acceptance`
- PR: pending
- Summary: Added a fail-closed, opt-in product acceptance command that takes one external unpublished audio-bundle candidate through the real mobile card parser, card/asset binding, every card's owned completion semantics, representative Learning UI completion, analysis detail, audio-control rendering, and runtime metadata-leak checks without claiming signed-manifest, perceptual-QC, receiver, device, deployment, or launch evidence.

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

- Softbook CET remains a system-sequenced single-card CET4/6 product; the five owned interaction families remain flip, multiple choice, lock, elimination, and swipe.
- Audio is attached front content for listening cards, not an interaction family. It remains explicitly user-triggered and does not autoplay.
- Candidate content authority, formal approval, and human perceptual audio QC remain in the external `card make` workspace. A product-side candidate acceptance report cannot create or replace any of them.
- An unpublished candidate, a simulated local manifest, and a repository test do not prove signed private delivery, a persistent receiver, real-device playback, deployment, or launch readiness.

## Implementation hypothesis changed

- `scripts/run_audio_bundle_candidate_mobile_acceptance.mjs` accepts one exact external `audio-bundle-candidate` payload, revalidates it with the release-bundle and active box-catalog contracts, and requires `release=null`, listening-only scope, audio on every card, and one asset per card.
- The runner hashes the exact input bytes, writes only a mode-`0600` fixture under a mode-`0700` temporary directory, invokes a dedicated mobile acceptance suite, reconstructs a strict content-free report, removes the fixture, and verifies that the repository worktree did not change.
- The mobile acceptance uses the real parser, evaluator, Learning surface, result detail, and audio control. It constructs a synthetic local manifest only to exercise the existing UI binding and therefore always reports that a signed manifest was not verified.

## Workspace boundary and read scope

- Active repository truth read: the listed specs/contracts, the existing card-source validators, Learning parser/evaluator, content-manifest card binding, Learning surface, and the established controlled-pilot acceptance pattern.
- External workspace read: five exact candidate heads were combined read-only in `/private/tmp/card-make-listening-60-combined-20260814`; no external card, review, approval, audit, or audio file was modified.
- Generated/dependency/cache read: the combined technical audit and candidate payload remained under `/private/tmp`; installed lockfile-matching backend/mobile dependencies were linked only for execution and are not semantic authority or tracked changes.

## Files changed

- `scripts/run_audio_bundle_candidate_mobile_acceptance.mjs`: external-input validation, private fixture lifecycle, Jest orchestration, strict safe-report reconstruction, and explicit non-gate boundaries.
- `apps/mobile/acceptance/audioBundleCandidate.mobileAcceptance.tsx`: dynamic all-card parser/evaluator/audio binding plus one real Learning UI completion per represented interaction family.
- `apps/mobile/jest.audio-bundle-candidate-acceptance.config.js`: dedicated opt-in acceptance selection that does not join ordinary or controlled-pilot Jest runs.
- `apps/mobile/package.json`: explicit acceptance test command.
- `infra/cloudbase/functions/softbook-api/test/audio-bundle-candidate-mobile-acceptance-runner.test.js`: safe-report reconstruction and fail-closed drift regressions.
- `infra/cloudbase/mobile-runtime-contract.md`: command, semantics, temporary-data handling, and non-approval/non-QC/non-deployment boundary.
- `docs/agent-runs/2026-08-14-listening-audio-candidate-mobile-acceptance.md`: this record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed in the isolated product worktree.
- `node scripts/audit_audio_technical.mjs --track cet4 --probe afinfo ...` in the temporary combined card snapshot -> 301/301 current CET4 audio references passed, 0 errors.
- `node scripts/build_card_make_runtime_payload.mjs --payload-mode audio-bundle-candidate ...` for the five exact candidate heads combined -> 60 cards / 60 assets, content version `sha256:346c16623a5dd4db76adc39d66c7fd46481b07aa3b6fac96f7d06644362e8b62`.
- `node --check scripts/run_audio_bundle_candidate_mobile_acceptance.mjs` -> passed.
- `node --test test/audio-bundle-candidate-mobile-acceptance-runner.test.js` -> 2/2 passed.
- `npm run typecheck -- --pretty false` in `apps/mobile` -> passed.
- changed-file ESLint for the acceptance TSX and Jest config -> passed.
- both acceptance configs with Jest `--listTests` -> each selected exactly its own one-file suite; the new dynamic candidate suite does not join the existing fixed controlled-pilot suite.
- `node scripts/run_audio_bundle_candidate_mobile_acceptance.mjs --candidate-payload ... --checked-at 2026-08-14T09:02:08.000Z` -> passed.
- `npm test -- --runInBand --no-watchman` in `apps/mobile` -> 46 suites / 512 tests passed; expected negative-path console warnings only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 272/272 passed.
- `python3 scripts/validate_harness.py --mode local` -> passed all 15 local semantic sections with the expected partial-completeness marker.
- `python3 scripts/validate_harness.py` -> local sections passed, but the aggregate command failed only because the current `gh` session could not read repository settings, `main` protection, or the `formal-product-owner-approval` environment; those remote controls remain required PR checks and are not claimed as passed locally.
- `git diff --check` -> passed.

## Validation results

- Exact candidate payload SHA-256: `sha256:762bfc7f82e046dcd190921e52d3f4b20a0da4363fd5aa653fd7287235e25de1`.
- Exact candidate content version: `sha256:346c16623a5dd4db76adc39d66c7fd46481b07aa3b6fac96f7d06644362e8b62`.
- 60/60 cards parsed; 60/60 cards bound one matching audio asset by ID, SHA-256, and duration; all 60 completed through their owned Learning semantics.
- Interaction distribution: 45 multiple-choice cards and 15 flip cards. Representative cards `001204` and `001201` completed through the actual Learning UI, exposed the accessible `播放听力` control, opened result detail, preserved analysis fields, and did not render internal IDs, source labels, content version, release ID, or download URL.
- The report truthfully retained `signed_manifest_verified=false`, `human_audio_qc_verified=false`, `persistent_receiver_verified=false`, `real_device_verified=false`, and `gate_eligible=false`.

## Agent review status

- Reviewer: Codex self-review under the user's standing review authorization.
- Status: passed locally; GitHub required checks remain pending until PR creation.
- Findings resolved during review: prevented the new acceptance file from joining the existing controlled-pilot Jest glob; changed download-URL leak checking to bind the current representative card rather than the first manifest asset; retained exact safe-report keys and false-only external evidence fields.
- Blocking findings: none in the repository implementation.

## User-visible UI impact

- None. No production screen, component, copy, interaction, color, layout, or motion implementation changed.
- The acceptance suite renders the already-accepted Learning UI only as verification, so no new design artifact or implementation mapping is introduced.

## Risks and open questions

- The 60-card candidate was assembled from five exact user-authorized heads, not rebuilt from an authoritative merged `card make` main snapshot. That final rebuild remains required after content approvals and merges.
- Human perceptual audio QC remains incomplete and cannot be signed by the agent.
- No receiver-owned CloudBase profile or credentials are available, so signed private delivery, deployment, and real-device learning remain unverified.

## Follow-up

- Finish the five content approval/merge flows, rebuild the same 60-card scope from merged `card make` main, and rerun this command to prove the authoritative content version.
- After identified-human audio QC and receiver-owned profile/credentials exist, build the formal bundle, publish privately, and repeat the learning flow on real iOS and Android devices.
