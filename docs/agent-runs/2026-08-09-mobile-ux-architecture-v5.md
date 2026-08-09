# Agent Run Record: Mobile UX architecture v5

## Task summary

- Date: 2026-08-09
- Branch: `cross/mobile-ux-architecture-v5`
- PR: draft `#484`, targeting `main`; formal product-owner check remains `WAITING`
- Parent design checkpoint: corrected v4 commit `de3bd5c5a23a70e2ca3c165613ea04a2f07da2b1`, independently classified `completed_no_promotion`
- Summary: design-architecture correction and evidence pass plus narrowly scoped CI security remediation. The architecture work replaces false browser outcomes, hidden tablet reflow, blended access profiles, omitted check-in behavior, compound evidence overclaims, and incomplete state accounting with a fail-closed 160-state + 13-combination contract, four platform learner documents, two physically separate access documents, and frozen browser evidence. The continuation adds a proposed six-checkpoint evidence topology, machine-checkable owner/cohort/result fields for all 173 obligations, a fail-closed PC Web `pcw-01` mapping for all 160 + 13 obligations, and a strict-5 real-use correction for Flip reveal focus loss. The CI remediation upgrades the fixable `js-yaml` advisory and records two short-lived, fail-closed `image-size` exceptions because upstream currently publishes no patched release.
- Current result: `architecture_gate_blocked_with_browser_subset_verified`. No visual system, accepted design, native completion, leadership readiness, or React Native authority is created.

The final goal remains one explicitly accepted, mature CET4/6 consumer product that is genuinely usable on iOS, Android, representative tablets, and PC Web. This checkpoint removes architecture ambiguity; it is not the finish line.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`

## Product truth used

- Softbook is a CET4/6 product for Chinese university students, not a generic English-learning or vocabulary-management product.
- Learning is system-sequenced and single-current-card. The top-level order remains `学习 / 空间 / 统计 / 我的`.
- Authentication is successive phone → SMS code. Login alone does not start Trial; the first successful authenticated Learning entry does.
- Flip, Four-choice, Lock, Elimination, and Swipe remain five materially distinct families. Flip alone uses exactly `有把握 / 再回看`.
- Hint and audio remain attached capabilities, not new core families. Audio is absent when no attached resource exists.
- Space preserves `library → group → box → card`; favorite is a tag; sleep/wake is reversible and changes Learning eligibility without deleting progress.
- Trial, Free, Premium, formal purchase/restore, and receiver-managed read-only access remain separate truths. The client never self-grants Premium.
- PC Web remains a required, separately composed target under its accepted Focused Workbench authority.
- Learner UI must not expose reviewer, repository, runtime, test, profile-switch, predicate, internal key, or implementation language.

## Implementation hypothesis changed

- Added a proposed cross-device grayscale state architecture and four browser-framed platform compositions.
- Added local scenario adapters only to render proposed Auth, Learning-session, completion, mutation, purchase, restore, and read-only access transitions. They do not establish server/store/native truth.
- Proposed an iOS bounded bottom navigation, Android landscape rail, iPadOS 208px sidebar, Android tablet 160px rail, and compact 761/800px collapse. These remain implementation hypotheses until mapped and verified natively.
- Proposed six separately owned evidence checkpoints: Browser Architecture, Canonical Service, PC Web Parity, Visual Authority, Native Final Acceptance, and Release / Leadership Readiness. The proposal has `gate_effect=none` and no product-owner decision has been inferred.
- Added a fail-closed `pcw-01` state mapping and execution matrix. It is an inventory, not PC Web implementation or parity evidence.
- Changed Flip reveal focus from the removed invoker/body fallback to the newly rendered explanation region. This is browser architecture behavior only, not native accessibility evidence.
- Kept exact native component, safe-area, IME, Back, focus API, audio, store, service, and PC Web mappings unresolved and blocked.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and accepted design/runtime artifacts above, corrected v4 design history, the v5 worktree, and relevant delivery/harness scripts.
- Generated/dependency/cache/archive read: none used as product truth. Browser runtime support code was inspected only to operate the approved in-app browser API.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or changed.
- No mobile application source, native project, backend, content payload, release evidence, or deployment file was changed. `apps/mobile/package.json` and `package-lock.json` changed only to resolve the transitive `js-yaml` advisory; the dependency security policy changed to govern the unpatched build-time `image-size` advisories.

## Files changed

- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/README.md`: final-goal, authority, truth/hypothesis, artifact map, strict-5 status, and stop boundary.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-ux-state-contract.md`: 160 semantic states and 13 forced combinations, including nine explicit simple-check-in states and ten split compound obligations.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/platform-architecture.md`: four mobile/tablet browser composition contracts plus explicit native and PC Web boundaries.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`: one fail-closed row per state/combination plus machine-checkable evidence class, authority owner, target environment, test key, exact cohort, and current result; all required rows remain blocked overall.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md`: strict-4 historical cohort, strict-5 focus delta hashes/replay, measured breakpoints, pre-correction failures, and non-claims.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md`: proposed six-layer checkpoint contract with explicit owner, entry/exit, claim/non-claim, evidence-cohort, and fail-closed rules.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-layering-decision-proposal.md`: pending product-owner decision proposal; it has no gate effect.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md`: all 160 + 13 obligations mapped to accepted PC Web regions and future evidence, with every result fail-closed.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-reviewer-matrix.html`: reviewer-only entry point, current blocked decision, checkpoint proposal, and PC Web inventory.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/`: physically separate iOS phone, Android phone, iPadOS, and Android tablet learner documents plus shared architecture CSS/JS; strict-5 adds a programmatic Flip explanation focus target and cache-busted flow reference.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/`: physically separate formal-commerce and managed read-only learner documents.
- `scripts/validate_state_evidence_ledger.mjs` and `scripts/test_validate_state_evidence_ledger.mjs`: fail-closed 173-row machine-contract validator and negative mutation tests.
- `scripts/validate_pc_web_v5_state_mapping.py`: standalone fail-closed PC Web inventory validator and negative mutation tests; it is deliberately not a release gate.
- `scripts/check_design_metadata_leaks.mjs`: fail-closed scanning for UX-architecture external learner scripts and learner comments.
- `scripts/test_check_design_metadata_leaks.mjs`: external-script, learner-comment, reviewer-process, and raw-metadata regressions.
- `apps/mobile/package.json` and `apps/mobile/package-lock.json`: preserve consumer-declared major compatibility while routing 3.x consumers to fixed `js-yaml@3.15.1` and 4.x consumers to fixed `js-yaml@4.3.1`.
- `security/dependency-audit-policy.json`: time-bounded exceptions, expiring `2026-08-16`, for the two unpatched `image-size` advisories reachable only through Metro's repository-controlled build inputs.
- `docs/agent-runs/2026-08-09-mobile-ux-architecture-v5.md`: this record.

## Commands run

- `node --check` on all three learner JavaScript runtimes.
- `node scripts/test_check_design_metadata_leaks.mjs`.
- `node scripts/check_design_metadata_leaks.mjs`.
- `python3 -m http.server 4175 --bind 127.0.0.1` from the worktree.
- Real in-app-browser click/fill/keypress/pointer-drag/Back/Forward/viewport/screenshot/layout replay against cache-busted URLs.
- Strict-5 real in-app-browser replay on iOS phone `390×844`, Android phone `390×844` / `844×390`, iPadOS `1024×768` / `761×768`, and Android tablet `1024×768` / `761×768`, including five-family lifecycle, Flip focus, Space continuity/mutation, DOM/a11y/title leakage, and console checks.
- `shasum -a 256` for every frozen proof source.
- `node scripts/validate_state_evidence_ledger.mjs` and `node scripts/test_validate_state_evidence_ledger.mjs`.
- `python3 scripts/validate_pc_web_v5_state_mapping.py --self-test`.
- `python3 scripts/validate_harness.py --mode local`.
- `python3 scripts/validate_harness.py`.
- `npm install --package-lock-only --ignore-scripts` and `npm ci` in `apps/mobile`.
- `npm ls js-yaml image-size --all`.
- `node scripts/test_validate_dependency_security.mjs && node scripts/validate_dependency_security.mjs`.
- tracked-asset boundary scan for `ICNS / HEIF / HEIC / JXL / AVIF` inputs.
- `npm run lint -- --quiet`, `npm run typecheck`, and `npm test -- --runInBand --watchAll=false` in `apps/mobile`.
- `git diff --check`.

## Validation results

- JavaScript syntax: passed for `architecture-flow.js`, `access-standard.js`, and `access-managed.js`.
- Metadata scanner regression: `36/36` passed, including referenced external learner-script scanning and reviewer-only external-script separation.
- Full metadata scanner: `PASS: No metadata leaks detected in design visual artifacts.`
- Exact state accounting: 160 semantic state rows + 13 COV rows, no duplicate/missing IDs. Parent browser-cell counts were retired after the strict review found platform inflation; conservative frozen-source coverage is iOS phone `38`, Android phone `10`, iPadOS `8`, Android tablet `8`, and shared access-profile browser `12`. A further `14/5/5/5` platform presentations were operated but remain blocked because the browser adapter cannot prove canonical origin/commit truth; check-in acknowledgement/reconciliation/exact-retry remain blocked.
- Evidence ledger machine contract: all `173` rows carry a unique test key, authority owner, target matrix, exact strict-4 source/service cohort, evidence class, and fail-closed current result. All `173` current results remain `blocked_required_target`; no native or PC Web cell was promoted.
- PC Web inventory: all `160` semantic IDs plus `13` COV IDs map to accepted `pcw-01` regions and one of `12` required viewport/input/accessibility/service/commerce/beta/audio execution rows. Every mapping and matrix result remains `blocked_*`; the validator is inventory-only and is not wired into a delivery or release gate.
- Frozen browser replay: passed for the exact subset recorded in `browser-evidence.md`; page runtime console errors `0`.
- Strict-5 delta replay found the missed Flip reveal focus loss, moved focus to the rendered explanation, and re-ran that transition on all four platform documents. It also repeated the full five-family iOS path, Learning/Space identity and sleep replacement, tablet constrained-window containment, and platform leakage checks. Every recorded delta state measured `overflowX=0`; console errors/warnings and visible/accessible-name leak matches were zero. The local repository proof URL remains developer-only and is not production-route evidence.
- Frozen strict-3 review found one remaining iOS global-stack P1. Strict-4 replaced it with destination-owned route-local stacks, then re-ran the exact failed path. `Learning → 查看所在空间 → 回到学习 → Space tab → App Back` now moves visibly to the Space root on the first activation, exposes no root Back control, and never pops a top-level iOS tab.
- iOS 320/360/390/430, iOS landscape, Android 390/430, Android landscape, iPadOS 761/800/1024, Android tablet 761/800/1024, and shared access 320/1024 all measured `overflowX=0`.
- iOS minimum operated target floor: `44`; Android and shared-access floor: `48`.
- Four-choice remained 2×2 at 320 and 360; statistics date numerals compute to `tabular-nums`.
- Native, store, canonical service, real audio, real receiver operations, 200% text, OS reduced motion, IME, VoiceOver/TalkBack, cutout/safe-area, and PC Web per-state evidence: blocked.
- Local full-section harness: `HARNESS VALIDATION OK`; `HARNESS COMPLETENESS PARTIAL (mode=local, selected=15)` is the expected local-mode report and does not substitute for remote required checks.
- Full harness command required by the PR review gate: `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Dependency security: each transitive `js-yaml` consumer remains inside its declared major range (`3.15.1` or `4.3.1`); the policy validator passed with no CloudBase findings and exactly two governed `image-size` advisories. GitHub lists no patched `image-size` release, so both exceptions expire on `2026-08-16` and must be removed as soon as upstream publishes a fix. The repository contains no tracked `ICNS`, `HEIF`, `HEIC`, `JXL`, or `AVIF` asset that can reach the vulnerable parsers.
- Mobile regression after the targeted overrides, repeated under CI's Node `22.13.0`: lint passed, typecheck passed, and all `45` suites / `437` tests passed.
- `git diff --check`: passed.
- Final independent frozen-hash architecture review of strict-4 commit `bd3ed0f54350b252f1554872de5a07cd09f97232`: `pass_exact_architecture_browser_subset`; P0 `0`, P1 `0`. The overall architecture gate remains blocked.
- Final independent dependency-remediation review of exact range `7f5fa76086290da46b96a1055889e2f4d77d9373..82ce240`: Passed; P0 `0`, P1 `0`, blocking findings none. A first-pass global 4.x override was rejected during review; the corrected targeted resolution keeps every `js-yaml` consumer inside its declared major range and passed fresh install, dependency-tree, policy, lint, typecheck, and `45/437` test replay.

## Binary evidence

- Evidence manifest: N/A; browser observations are textual exact-source evidence in `browser-evidence.md`.
- Archive: N/A.
- No browser screenshot is classified as native or launch evidence.

## Agent review status

- Pre-commit behavior audit: `pass_precommit_behavior_audit` on strict-3; P0 `0`, P1 `0`. It rechecked Lock correction, Elimination/Swipe answer context, Auth focus, platform Back, Space focus/scroll restoration, sleeping-card replacement, and the removal of the false post-success check-in repeat control.
- Pre-commit evidence audit: `pass_precommit_evidence_audit` on flow hash `e21efa673ec301640392acc76781872d1fe0cd3f4dac29a76454cdd045f5b102`; P0 `0`, P1 `0`. It independently recomputed `38/10/8/8` exact platform cells, `14/5/5/5` presentation-only observations, `12` shared cells, all `160 + 13` IDs, all frozen hashes, and the blocked canonical-origin rows.
- Exact review of strict-3 commit `2a09309e3b2bc85003d2e68b5a65196f4e9c0fcd`: `fail_architecture_checkpoint`; P0 `0`, P1 `1`. The residual finding was the shared iOS global stack and a real double-Back/no-visible-change path. Strict-4 corrected that finding and re-ran all platform browser scenarios affected by the shared script hash.
- Reviewer: independent exact-hash subagent
- Status: `pass_exact_architecture_browser_subset` on strict-4 commit `bd3ed0f54350b252f1554872de5a07cd09f97232`; P0 `0`, P1 `0`
- Blocking findings: none inside the exact browser subset. Required ledger, native, PC Web, visual-system, and product-owner gates remain blocked.
- Continuation checkpoint review initially found one P0 release-readiness bypass and two P1 cohort/owner defects. The proposal now requires zero release-scope blockers, strictly separated scenario cohorts referenced by a hash-only aggregation manifest, and explicit semantic/evidence/decision owners. This correction still has no gate effect or owner acceptance.
- Continuation ledger/PC Web review initially reproduced four P1 validator bypass classes: coupled owner spoof, coupled state substitution, semantically hollow mapping, repository-path escape, and hollow execution rows. Frozen contract/mapping identities, authority-code validation, repository containment, full-row/matrix digests, and negative tests now reject those mutations.
- Current strict-5 continuation status: targeted validators, metadata scanner, full harness, and real browser delta passed; exact-commit independent review is pending and must be recorded before this continuation can be described as reviewed.

## Design review checklist

- Q1 — Current library / Law of One: the learner path is `仔细阅读馆`. This architecture proof deliberately defines no accent or palette, so Law-of-One color binding is unproved and visual acceptance remains blocked.
- Q2 — Focal object / first read: Learning is one current card; first read is card task → bounded attached tools/result → platform chrome. Auth, Space, access, and confirmation states each keep one state-appropriate focal object. Strict-5 moves Flip reveal focus to its explanation rather than losing the learner on `body`. Browser screenshots and accessibility trees confirm the grayscale hierarchy, but not final visual quality.
- Q3 — Canonical silhouette: Flip reveal + two judgements, 2×2 Four-choice, vertical leading-lock rows, marked-text Elimination, and a stacked Swipe deck with explicit directional trails are materially distinct. Space retains hierarchy rather than becoming a flat list or progress bucket.
- Q4 — Forbidden patterns: no gradient text, gamification chrome, full-width phone tabbar, pure `#000/#fff`, serif UI, four-level self-assess, or auto-scored reuse of self-assess tokens remains in learner proofs. The grayscale palette itself is explicitly non-promotable and cannot answer the user's final color/theme requirement.
- Q5 — Containment: browser measurements show no horizontal page overflow, permanent empty tablet pane, clipped CTA, or covered required text/action at the recorded widths. The strict-5 constrained tablet replay found no actionable or text node intersecting bottom navigation. CSS reads all four safe-area env values, but real native safe-area/IME/cutout evidence remains blocked.
- Q6 — Surface-specific: Flip exposes exactly `有把握 / 再回看`; Statistics uses `tabular-nums` for dated records and a lightweight explicit check-in without streak, reward, or learner-supplied progress counters; Learning exposes no module-selection primary path.

## User-visible UI impact

- Adds design-only browser learner/reviewer artifacts. Shipped app code is unchanged.
- Corrects false-success scoring, false local Trial/Premium, sleeping-card return, progress-bucket Space, hidden tablet-width reservation, learner-source review leakage, and blended formal/managed access in the proof layer.
- Corrects Flip reveal focus loss in the browser proof so keyboard and screen-reader focus lands on the newly rendered explanation instead of `body`.
- Does not provide a final palette, final UI, accepted UX, native build, or leadership-ready branch.

## Card make external workspace impact

- N/A. Illustrative proof copy is not candidate card production, card approval, or formal content quantity.

## Risks and open questions

- Required ledger rows remain blocked; therefore the architecture gate remains blocked.
- The six-checkpoint topology is a proposal with `gate_effect=none`; the product owner has not accepted its names, owners, ordering, P0 subset, or native-feasibility carrier.
- The PC Web state inventory is complete only as a fail-closed mapping. PC Web implementation, exact browser replay, 200% zoom, input/accessibility, canonical service, payment, beta, and audio evidence remain absent.
- The two `image-size` exceptions are not a zero-vulnerability claim. They are limited to Metro's build-time use of repository-controlled local assets, expire on `2026-08-16`, and deliberately fail closed if upstream resolves the advisory or the exception is not removed/reassessed by then.
- Native iOS/Android/tablet evidence and PC Web per-state parity are absent.
- Formal store success/cancel/account mismatch and canonical entitlement refresh are absent.
- Free limits, real Trial persistence, membership-end recovery, audio-present lifecycle, offline/retry/duplicate/process-restore, large text, reduced motion, and assistive technology require exact evidence.
- The architecture's grayscale near-white/dark materials are deliberately non-authoritative and must not seed final theme selection.

## Follow-up

1. Keep the PR draft and every visual/native/release promotion path blocked; request an explicit product-owner accept/reject/amend decision on the six-checkpoint proposal.
2. If accepted, run the Browser Architecture, Canonical Service, and PC Web evidence lanes as separate fail-closed cohorts. Close real 200%/large-text, reduced-motion, assistive-technology, service/store/receiver, and PC Web implementation gaps without borrowing evidence between lanes.
3. Only after an exact architecture decision may equal-completeness visual-system exploration start. React Native implementation still waits for an accepted visual artifact and exact implementation mapping; native final acceptance and release readiness remain later checkpoints.
