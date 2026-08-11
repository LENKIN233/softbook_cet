# Agent Run Record: Mobile Daylight Studio V1

## Task summary

- Date: 2026-08-11
- Branch: `cross/mobile-visual-rebuild-v5`
- PR: pending
- Summary: replace rejected monochrome/pale mobile design evidence with a complete colorful consumer-app visual baseline, prove the core surfaces and five interaction families, and authorize a later separate RN/Web implementation only after design review and gates.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/single-card-ux-contract.md`

## Product truth used

- Softbook is a CET4/6 system-sequenced single-card product, not a generic word app.
- Learning is primary; Space preserves 馆 → 组 → 盒 → 卡 continuity without becoming browse-first.
- The five interaction families remain visually distinct. Audio is explicit inside an interaction, never a sixth family.
- Flip has exactly mint “有把握” and amber “再回看”.
- Phone, tablet, and desktop require dedicated composition. iOS and Android remain equal-priority implementation targets.
- Learner-facing output must not expose internal prompts, metadata, implementation, review, or repository language.

## Implementation hypothesis changed

No production implementation changed. The accepted design hypothesis uses stable violet brand chrome, a bounded coral current-hall layer, opaque white task surfaces, semantic feedback colors, one primary action per state, phone floating navigation, tablet wide task canvas, and desktop contextual rail.

## Workspace boundary and read scope

- Active source read: the listed specs, current design canon/harness, active mobile fixture copy, and frozen rejected design-run records.
- Generated/dependency/cache read: none as product truth.
- Archive read: none.
- External workspace read: none; `/Users/lenkin/programing/card make` was not changed and development fixture copy is not claimed as approved content.

## Files changed

- `docs/design/search-runs/2026-08-11-mobile-daylight-studio/`: nine-candidate search run, hard filters, connected pairwise review graph, mutation evidence, promotion record, learner proof, interaction atlas, and screenshots.
- `docs/design/decisions/mobile-daylight-studio-v1.md`: exact accepted design decision and re-entry rule.
- `docs/design/mapping/mobile-daylight-studio-implementation-map-v1.md`: token, surface, platform, verification, and prohibited-reinterpretation mapping.
- `docs/design/interaction-motion/mobile-daylight-studio-motion-v1.md`: causal motion and reduced-motion rules.
- `docs/agent-runs/2026-08-11-mobile-daylight-studio-v1.md`: this record.

## Commands run

- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-08-11-mobile-daylight-studio` -> passed.
- `node scripts/check_design_metadata_leaks.mjs` -> passed after removing internal topic/relation labels, semantic CSS names, known identity colors, and source-level metadata terminology.
- `python3 scripts/validate_harness.py` -> passed.
- Local HTTP server plus the in-app browser -> real navigation and interaction at 320×700, 360×780, 393×852, 430×932, 834×1194, and 1440×1000.
- Browser flow -> selected and submitted a 2×2 answer, verified inline result, continued to flip, revealed answer, selected “有把握”, and verified clean next-cycle reset.
- Browser routes -> operated Learning, Space, Statistics, Mine, favorite, sleep/wake, check-in, membership sheet, auth sheet, and local phone validation.

## Validation results

- Four phone widths had zero document-level horizontal overflow.
- At 320×700 the primary action ended at y=576 and floating navigation began at y=612; the action remained unobstructed.
- All visible interactive controls measured at least 44×44 in the narrow-phone audit.
- Tablet Learning was changed from an unusably narrow split to a broad single task canvas.
- Space intrinsic sizing was corrected so its active holder no longer extended beyond the viewport.
- 1194×834 remains a single-column tablet composition with the CTA inside the viewport; 1366×768 uses a compact desktop composition with the CTA inside the viewport.
- The 320px interaction atlas has `scrollWidth=320`, its cards end at x=304, and its lock family visibly separates progress, locked slots, and the adjustable slot.
- Desktop uses the wide task plus bounded contextual region and has no document overflow.
- Route changes restore focus to the destination heading; modal sheets isolate the app, trap focus, close on Escape, and restore the trigger.
- Metadata leakage and design-search validators passed on the exact current files.

## Binary evidence

- Local screenshots were captured under ignored `docs/agent-runs/artifacts/mobile-daylight-studio-v1/` for live visual review and were not added to ordinary Git.
- No immutable external archive was published, so no `agent-run-evidence.v1` manifest is claimed.
- Reproducible HTML proof and exact viewport/interaction measurements remain the committed evidence. They are design proof only, not native release or launch evidence.

## Agent review status

- Status: passed on frozen exact learner SHA `6af51d41…` and atlas SHA `deb544ef…`; P0=0, P1=0, P2=0.
- First review correctly failed three P1s and two P2s: Learning↔Space next-card identity mismatch; phone-result/low-desktop/landscape-tablet/atlas containment defects; atlas color drift; weak lock silhouette; and missing route focus restoration.
- Final review verified the repaired exact bytes: result CTA clear of navigation; 1194×834 single-column tablet and 1366×768 compact desktop; 320px atlas containment; consistent `however` sequence identity; canonical index-1 hall color; lock progress/locked/adjustable slots; and heading focus restoration.
- Blocking findings: none. Phase B native implementation and device evidence remain required separately.

## User-visible UI impact

This design-only change creates a colorful, high-completion learner baseline and removes the wireframe/prompt-leak failure family. It does not change the current shipped/runnable RN UI until a separate implementation PR consumes the accepted artifacts.

## Card make external workspace impact

None. No candidate card content was produced or approved.

## Risks and open questions

- Native font metrics, keyboard/IME, VoiceOver/TalkBack, gesture physics, async recovery, iOS/Android release builds, and device rotation remain Phase B gates.
- Coral must remain confined to the current hall and direct actions; violet remains stable brand.
- Development fixture copy supports design testing only and is not formal content approval.

## Follow-up

- Resolve independent review findings, commit the design-only exact revision, open a PR, pass required checks, and merge.
- From merged `main`, create a separate implementation branch that maps this baseline into RN/Web.
- Real-start and real-use test iOS, Android, phone web, tablet, and desktop before leadership-readiness is claimed.
