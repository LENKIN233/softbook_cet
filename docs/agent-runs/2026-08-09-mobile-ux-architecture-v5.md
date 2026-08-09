# Agent Run Record: Mobile UX architecture v5

## Task summary

- Date: 2026-08-09
- Branch: `cross/mobile-ux-architecture-v5`
- PR: pending; stacked on draft PR `#483`
- Parent design checkpoint: corrected v4 commit `de3bd5c5a23a70e2ca3c165613ea04a2f07da2b1`, independently classified `completed_no_promotion`
- Summary: design-only correction and evidence pass for the mobile UX architecture. It replaces false browser outcomes, hidden tablet reflow, blended access profiles, and incomplete state accounting with a fail-closed 141-state + 13-combination contract, four platform learner documents, two physically separate access documents, and frozen browser evidence.
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
- Kept exact native component, safe-area, IME, Back, focus API, audio, store, service, and PC Web mappings unresolved and blocked.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and accepted design/runtime artifacts above, corrected v4 design history, the v5 worktree, and relevant delivery/harness scripts.
- Generated/dependency/cache/archive read: none used as product truth. Browser runtime support code was inspected only to operate the approved in-app browser API.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or changed.
- No `apps/mobile`, native project, backend, content payload, release evidence, or deployment file was changed.

## Files changed

- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/README.md`: final-goal, authority, truth/hypothesis, artifact map, and stop boundary.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-ux-state-contract.md`: 141 semantic states and 13 forced combinations.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/platform-architecture.md`: four mobile/tablet browser composition contracts plus explicit native and PC Web boundaries.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md`: one fail-closed row per state/combination, with exact browser cells and all native/PC Web cells still blocked.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md`: frozen hashes, operated flows, measured breakpoints, pre-correction failures, and non-claims.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-reviewer-matrix.html`: reviewer-only entry point and current blocked decision.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/`: physically separate iOS phone, Android phone, iPadOS, and Android tablet learner documents plus shared architecture CSS/JS.
- `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/`: physically separate formal-commerce and managed read-only learner documents.
- `scripts/check_design_metadata_leaks.mjs`: fail-closed scanning for UX-architecture external learner scripts and learner comments.
- `scripts/test_check_design_metadata_leaks.mjs`: external-script, learner-comment, reviewer-process, and raw-metadata regressions.
- `docs/agent-runs/2026-08-09-mobile-ux-architecture-v5.md`: this record.

## Commands run

- `node --check` on all three learner JavaScript runtimes.
- `node scripts/test_check_design_metadata_leaks.mjs`.
- `node scripts/check_design_metadata_leaks.mjs`.
- `python3 -m http.server 4175 --bind 127.0.0.1` from the worktree.
- Real in-app-browser click/fill/keypress/pointer-drag/Back/Forward/viewport/screenshot/layout replay against cache-busted URLs.
- `shasum -a 256` for every frozen proof source.
- `python3 scripts/validate_harness.py --mode local`.
- `git diff --check`.

## Validation results

- JavaScript syntax: passed for `architecture-flow.js`, `access-standard.js`, and `access-managed.js`.
- Metadata scanner regression: `36/36` passed, including referenced external learner-script scanning and reviewer-only external-script separation.
- Full metadata scanner: `PASS: No metadata leaks detected in design visual artifacts.`
- Exact state accounting: 141 semantic state rows + 13 COV rows, no duplicate/missing IDs; exact browser cells currently iOS `83`, Android phone `27`, iPadOS `35`, Android tablet `27`.
- Frozen browser replay: passed for the exact subset recorded in `browser-evidence.md`; page runtime console errors `0`.
- iOS 320/360/390/430, iOS landscape, Android 390/430, Android landscape, iPadOS 761/800/1024, Android tablet 761/800/1024, and shared access 320/1024 all measured `overflowX=0`.
- iOS minimum operated target floor: `44`; Android and shared-access floor: `48`.
- Four-choice remained 2×2 at 320 and 360; statistics date numerals compute to `tabular-nums`.
- Native, store, canonical service, real audio, real receiver operations, 200% text, OS reduced motion, IME, VoiceOver/TalkBack, cutout/safe-area, and PC Web per-state evidence: blocked.
- Local full-section harness: `HARNESS VALIDATION OK`; `HARNESS COMPLETENESS PARTIAL (mode=local, selected=15)` is the expected local-mode report and does not substitute for remote required checks.
- `git diff --check`: passed.
- Final independent frozen-hash architecture review: pending.

## Binary evidence

- Evidence manifest: N/A; browser observations are textual exact-source evidence in `browser-evidence.md`.
- Archive: N/A.
- No browser screenshot is classified as native or launch evidence.

## Agent review status

- Reviewer: independent exact-hash subagent
- Status: pending
- Blocking findings: pending

## Design review checklist

- Q1 — Current library / Law of One: the learner path is `仔细阅读馆`. This architecture proof deliberately defines no accent or palette, so Law-of-One color binding is unproved and visual acceptance remains blocked.
- Q2 — Focal object / first read: Learning is one current card; first read is card task → bounded attached tools/result → platform chrome. Auth, Space, access, and confirmation states each keep one state-appropriate focal object. Browser screenshots and accessibility trees confirm the grayscale hierarchy, but not final visual quality.
- Q3 — Canonical silhouette: Flip reveal + two judgements, 2×2 Four-choice, ordered Lock, marked-text Elimination, and two-direction Swipe are materially distinct. Space retains hierarchy rather than becoming a flat list or progress bucket.
- Q4 — Forbidden patterns: no gradient text, gamification chrome, full-width phone tabbar, pure `#000/#fff`, serif UI, four-level self-assess, or auto-scored reuse of self-assess tokens remains in learner proofs. The grayscale palette itself is explicitly non-promotable and cannot answer the user's final color/theme requirement.
- Q5 — Containment: browser measurements show no horizontal page overflow, permanent empty tablet pane, clipped CTA, or covered navigation at the recorded widths. CSS reads all four safe-area env values, but real native safe-area/IME/cutout evidence remains blocked.
- Q6 — Surface-specific: Flip exposes exactly `有把握 / 再回看`; Statistics uses `tabular-nums` for dated records and no check-in fiction; Learning exposes no module-selection primary path.

## User-visible UI impact

- Adds design-only browser learner/reviewer artifacts. Shipped app code is unchanged.
- Corrects false-success scoring, false local Trial/Premium, sleeping-card return, progress-bucket Space, hidden tablet-width reservation, learner-source review leakage, and blended formal/managed access in the proof layer.
- Does not provide a final palette, final UI, accepted UX, native build, or leadership-ready branch.

## Card make external workspace impact

- N/A. Illustrative proof copy is not candidate card production, card approval, or formal content quantity.

## Risks and open questions

- Required ledger rows remain blocked; therefore the architecture gate remains blocked.
- Native iOS/Android/tablet evidence and PC Web per-state parity are absent.
- Formal store success/cancel/account mismatch and canonical entitlement refresh are absent.
- Free limits, real Trial persistence, membership-end recovery, audio-present lifecycle, offline/retry/duplicate/process-restore, large text, reduced motion, and assistive technology require exact evidence.
- The architecture's grayscale near-white/dark materials are deliberately non-authoritative and must not seed final theme selection.

## Follow-up

1. Complete independent review of the frozen exact hashes and address any P0/P1 findings.
2. Keep the PR draft and the visual-search gate blocked.
3. Produce the remaining Tier-2 browser/native/PC Web evidence and obtain explicit product-owner architecture acceptance.
4. Only then start equal-completeness visual-system exploration; do not begin React Native implementation before an exact visual artifact is accepted and mapped.
