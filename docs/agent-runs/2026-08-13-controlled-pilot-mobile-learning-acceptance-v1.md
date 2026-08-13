# Agent Run Record: controlled-pilot mobile Learning acceptance v1

## Task summary

- Date: 2026-08-13
- Branch: `cross/controlled-pilot-mobile-payload-smoke-v1`
- PR: [#503](https://github.com/LENKIN233/softbook_cet/pull/503)
- Summary: Connected the exact approved CET4 120-card controlled-pilot payload to the real mobile card-source, Learning Session, signed content-manifest, Bootstrap, evaluator and rendered Learning paths; fixed the pilot wire-contract mismatches and added a repeatable content-safe acceptance command.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product truth used

- Softbook CET is a system-sequenced single-card CET4/6 preparation product. The five core interaction families are `flip`, `multiple_choice`, `lock`, `elimination`, and `swipe`; audio remains an attached card resource rather than an interaction family.
- Candidate content production and approval stay in the external `card make` workspace. This repository consumes only the exact exported and approved payload plus its review, approval and audit bindings.
- The approved controlled-pilot scope is exactly 120 CET4 cards with a stable 60-card free prefix, 24 referenced audio assets, content version `sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36`, and payload SHA-256 `sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3`.
- Controlled-pilot artifacts and repository smokes remain `gate_eligible=false`. They do not replace complete identified-human audio QC, persistent receiver execution, real-device evidence, formal closed-beta evidence, or the later final 1,180-card CET4 approval.

## Implementation hypothesis changed

- Mobile content-manifest parsing now models formal and `controlled_pilot` manifests as exact mutually exclusive variants. The pilot variant retains signed pilot identity, dual-platform minimum versions, canonical expiry and literal `gate_eligible=false` instead of being rejected or projected into the formal shape.
- Mobile Bootstrap parsing now models its exact nine-field controlled-pilot content projection separately from the existing seven-field development/formal projection.
- Shared runtime release authority now revalidates exact Android/iOS semantic versions, pilot and release identifiers, canonical activation/expiry timestamps, strict time ordering, 120/60 scope and literal false gate state on every controlled-pilot read.
- Pilot private-download expiry is capped at the signed release expiry, and mobile independently rejects a download that outlives it.
- The backend smoke can expose real response envelopes and an ephemeral public key only through an explicit in-process callback. The product-level acceptance runner writes these responses to a private temporary file, runs the opt-in mobile suite, verifies a clean worktree delta, and deletes the fixture before returning a content-free report.
- Learning no longer trusts a server/card-source label for user-visible session copy. It uses the accepted fixed `本轮学习卡` / `本轮回看卡` product label, and completion copy no longer exposes “卡源”. This is a metadata-safety repair within the accepted Learning design, not a new layout or interaction direction.

## Workspace boundary and read scope

- Active truth/source read: the listed specs and contracts, current mobile Learning/card-source/manifest/Bootstrap implementations and tests, CloudBase release/manifest/smoke implementations and tests, and accepted Learning design/mapping artifacts.
- Generated/dependency/cache/archive read: mobile and CloudBase dependencies were installed from committed lockfiles only in the isolated topic worktree; no archive or generated card payload was treated as product truth.
- External workspace read: read-only consumption of `/private/tmp/card-make-pilot-approval.1mhOrx/` exports derived from `/Users/lenkin/programing/card make`. Raw card content crossed only the existing backend in-memory smoke and a private temporary acceptance fixture; it was not copied into this repository or retained in reports.

## Files changed

- `apps/mobile/src/audio/contentManifestRepository.ts` and tests: exact formal/pilot manifest union, signed pilot expiry/gate/minimum-version parsing, and download-expiry cap enforcement.
- `apps/mobile/src/bootstrap/accountBootstrapRepository.ts` and tests: exact development/formal/pilot Bootstrap content union with canonical pilot expiry and dual-platform semantic versions.
- `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/learning/learningRepository.ts`, `apps/mobile/scripts/check-metadata-leaks.mjs`, and tests: fixed Learning session labels and completion copy so internal source metadata cannot reach the visible UI, and passed the acceptance fixture's explicit clock through the real remote manifest repository.
- `apps/mobile/acceptance/controlledPilotApprovedPayload.acceptance.tsx`, `apps/mobile/jest.controlled-pilot-acceptance.config.js`, and `apps/mobile/package.json`: opt-in 120-card/repository/signature/Bootstrap/five-interaction rendered acceptance suite.
- `infra/cloudbase/functions/softbook-api/content-release-runtime.js`, `content-manifest-v1.js`, and tests: fail-closed pilot descriptor revalidation and download-expiry clamp.
- `infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs` and tests: explicit mobile-acceptance response capture with public key only and no private key, access token, or phone number.
- `scripts/run_controlled_pilot_mobile_acceptance.mjs` and `infra/cloudbase/functions/softbook-api/test/controlled-pilot-mobile-acceptance-runner.test.js`: exact approved-artifact binding, outside-repository input enforcement, private temporary fixture lifecycle, opt-in Jest orchestration, worktree immutability check, exact backend/mobile safe-report reconstruction and unknown-field rejection inside the regular backend gate.
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`, `infra/cloudbase/content-manifest-v1-runtime-contract.md`, `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`, `infra/cloudbase/mobile-runtime-contract.md`, and `spec/runtime-boundaries.json`: exact variant, expiry, acceptance and explicit incomplete-capability boundaries.
- `infra/cloudbase/functions/softbook-api/test/controlled-pilot-round-v1.test.js`: aligns the existing controlled-pilot fixture with the already-owned exact dual-platform minimum-version contract.
- `docs/agent-runs/2026-08-13-controlled-pilot-mobile-learning-acceptance-v1.md`: this durable run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed before implementation in the isolated worktree.
- `npm ci --ignore-scripts` in `apps/mobile`, followed by `npm run postinstall` and `npm run test:brace-expansion-compat` -> dependency install and repository compatibility normalization passed.
- `npm ci --ignore-scripts` in `infra/cloudbase/functions/softbook-api` -> committed-lockfile backend dependencies installed.
- `npm run typecheck` in `apps/mobile` -> passed.
- Targeted mobile Jest for manifest, Bootstrap, hydration and Learning surface -> passed, 89/89.
- `npx eslint` on every changed mobile TS/TSX source/test -> 0 errors; 6 pre-existing `LearningSurface` inline-style warnings.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --no-watchman` in `apps/mobile` -> passed, 46 suites and 512 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 270/270.
- Web `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, and `npm run build` -> passed; 12/12 tests and the production bundle excludes development card content.
- Bundled Python 3.12 `scripts/validate_harness.py --mode local` -> passed the 15 local semantic sections in partial/local mode.
- Full `scripts/validate_harness.py` -> passed with the fixed Node 22, bundled Python 3.12 and GitHub CLI PATH (`HARNESS VALIDATION OK`). Two preceding attempts exposed missing `node` and then missing `gh` in the escalated command PATH; neither was a product or governance assertion failure.
- `scripts/run_local_gates --profile pr` and `--profile dev` -> attempted but not counted as passed: the PR profile requires the unavailable GitHub control plane/network, while the sandboxed dev runner cannot start macOS `sandbox-exec` and resolves system Python 3.9 instead of the required bundled runtime. The constituent repository suites are recorded separately above.
- `python3 scripts/test_validate_harness_runner.py && python3 scripts/test_harness_module_boundaries.py && python3 scripts/test_run_local_gates.py` -> passed, 68/68.
- `jq empty spec/runtime-boundaries.json`, Node JSON parse, syntax checks and `git diff --check` -> passed.
- `node scripts/run_controlled_pilot_mobile_acceptance.mjs ... --checked-at 2026-08-13T03:30:00.000Z` against the exact approved external artifacts -> passed.

## Validation results

- Exact payload binding: passed for the approved payload/review/approval/audit; payload SHA and content version match the immutable values above.
- All-card mobile core: 120/120 cards parsed; all 98 auto-scored cards completed with their canonical answer and all 22 `flip` cards completed through the owned `confident` self-assessment state. Interaction counts are flip 22, multiple choice 59, lock 17, elimination 10 and swipe 12.
- Representative repository/UI path: `001004` flip with audio, `000001` multiple choice with audio, `020203` lock, `011303` elimination and `011304` swipe each crossed card-source -> Learning Session -> real signed pilot manifest -> mobile repository -> evaluator -> rendered result -> rendered detail.
- Audio surface: the two representative audio cards rendered the accepted explicit accessible player control; audio bytes were not played or perceptually reviewed by this test.
- Wire contracts: real backend pilot manifest exact shape, mobile pinned-key Ed25519 verification, download/release expiry ordering, and real Bootstrap exact pilot content shape passed.
- Visible metadata: fixed session label, source label/ID, content version, pilot/release/key IDs, card/knowledge/box refs and download URLs stayed out of rendered output; the mobile metadata scan passed.
- Full regression: mobile 512/512, CloudBase 270/270, Web 12/12 plus production build, harness regression 68/68, the 15-section local/partial harness, and the full remote-aware harness all passed.
- Repository mutation: the acceptance runner observed no worktree change and removed its temporary card-bearing fixture.
- PR #503 first CI wave: Agent review, Android release, backend contract, dependency security, mobile quality, full harness, Web quality, evidence archive and repository health passed. The first design-artifact job read a PR body without its required machine-readable field labels and failed; the corrected body then passed `scripts/validate_pr_design_gate.py --base origin/main --head HEAD --body-file /dev/stdin` locally. A new CI wave is required to confirm that correction remotely; iOS release and formal product-owner approval were still pending when this record was updated.

## Binary evidence

- Evidence manifest: N/A. No new screenshots, recordings or retained binary evidence were produced.
- Archive: N/A.

## Design review checklist

- Q1 Law of One: no layout, palette or token changed. Existing Learning continues to bind the one strong subject accent to the current card library; fixed session copy is neutral chrome and introduces no competing identity color.
- Q2 Focal object: the current CET card remains the focal object. First-read order remains addressed card -> interaction body -> result/analysis -> continuation; removing source-label text from chrome strengthens rather than changes that hierarchy.
- Q3 Silhouette: all five accepted Learning silhouettes are unchanged. The acceptance suite exercises one real card from each family and the change does not replace them with a generic button shell.
- Q4 Forbidden patterns: no gradient text, gamification chrome, full-width tab bar, serif, removed feedback token or new pure-black/white surface was introduced. Internal “卡源” and source labels were removed from visible copy and the metadata scan passed.
- Q5 Layout containment: this change adds no layout or frame. Existing compact-viewport Learning tests, full 512-test mobile suite and five representative rendered completions passed without changing safe-area, CTA or tab-bar geometry; no new screenshot claim is made.
- Q6 Learning/flip: Learning remains system-sequenced with no module picker. Flip remains exactly two self-assess choices: `有把握` in mint and `再回看` in amber; no four-level or red review state was added.
- AP-22 / VL-AP-07: all required questions are answered here and will be copied into the PR description before delivery.
- AP-23: the authoritative two-state flip implementation is unchanged and covered by the representative flip completion.

## Agent review status

- Reviewer: Codex self-review under the user's explicit authorization, informed by the completed independent read-only review.
- Status: Passed locally after every independent-review finding was corrected and the complete code/spec diff was re-reviewed.
- Blocking findings: none in the implementation. The review caught and closed five issues: missing durable run evidence, non-native-string coercion, permissive safe-report forwarding, incorrect treatment of flip self-assessment as auto-scoring, and stale Bootstrap pilot-contract documentation. Follow-up self-review also closed missing `profile_id`/unknown-field checks, whitespace-tolerant exact identifiers, and wall-clock-dependent acceptance.
- Delivery caveat: remote required checks and CI have not yet passed, so this Agent review and successful full harness do not authorize merge by themselves.

## User-visible UI impact

- The Learning layout, interaction shapes, motion and scoring do not change.
- A source/card-source label can no longer appear in Learning progress/detail chrome; users consistently see `本轮学习卡` or `本轮回看卡`.
- Controlled-pilot completion copy now says the system retained cards for review without exposing the internal “卡源” concept.
- Design source: accepted `learning-card-rhythm-v1`, `learning-core-interactions-v1`, `learning-space-implementation-map-v1`, `mobile-core-surface-reset-implementation-map-v1`, and the existing Learning screen implementation. No same-PR design artifact is used as authority.
- Implementation mapping: session chrome -> `formatLearningSessionDisplayLabel`; round completion -> existing Learning completion card; all five operation/result/detail states -> unchanged `LearningSurface` branches exercised by the opt-in acceptance suite.
- Interaction/motion source: unchanged accepted Learning rhythm and core-interaction artifacts; no new motion or interaction family.
- Physical-space source: unchanged; existing library/group/box address aperture remains visible, while raw refs remain hidden.
- Unimplemented UI gap: real-device rendering and playback remain pending; this run validates React Native rendered structure only.

## Card make external workspace impact

- Read-only. No candidate card, sample confirmation, content review, approval, audit or audio-QC record was created or modified.
- The exact already-approved 120-card export was consumed transiently for acceptance and remains owned by the external workspace.
- Five newer three-card sample batches remain separate Draft work and are not expanded or admitted into this product without their exact sample-confirmation workflow.

## Risks and open questions

- The 24 audio assets still lack complete identified-human perceptual QC; the acceptance suite proves two player controls render, not that bytes are privately delivered, audible or acceptable.
- Installed-client minimum-version comparison is not implemented. The backend and mobile validate signed semantic-version shape only.
- Receiver-owned public-key injection, persistent receiver execution, private-object byte download, real-device playback, deployment, SMS and pilot cohort evidence remain incomplete.
- Controlled-pilot validation stays non-gate evidence and does not make the product formally launch-ready.
- Expansion beyond the five newer three-card Draft samples remains blocked on exact user sample confirmation in the external content workflow.

## Follow-up

- Complete the 24-entry identified-human audio review; implement installed-client minimum-version enforcement; execute the same approved payload in an independent persistent receiver environment; inject the receiver-owned release key; then run real iOS/Android private download/playback and controlled-pilot device acceptance.
- After exact sample confirmation, expand the five newer sample boxes in `card make`, review and approve them there, export a new payload identity, and rerun this product acceptance before admission.
