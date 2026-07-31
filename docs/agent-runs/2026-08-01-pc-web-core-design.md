# Agent Run Record: PC Web core-surface design authority

## Task summary

- Date: 2026-08-01
- Branch: `module/pc-web-core-design`
- Base: `origin/main` at `032e9a5d9b03e6fdd9ffd30f270293b9161632fd`
- PR: https://github.com/LENKIN233/softbook_cet/pull/469
- Summary: Promotes a design-only PC Web core-surface authority from an eight-candidate search run. It renders authentication, the five canonical Learning interaction families, review with attached audio, Space, Statistics, Mine, and membership gating in contained `1440 x 900` frames, while leaving production implementation to a separate future PR.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`

## Product truth used

- PC Web is a required first-class target; it cannot be represented by a stretched phone frame.
- Learning remains a system-sequenced single-current-card flow. Width separates the focal object, its address, and bounded support instead of exposing a module picker or dashboard.
- Flip self-assessment remains exactly `有把握` and `再回看`; the other four canonical interaction families score automatically.
- Audio stays attached to the current card. Favorite remains a tag, sleep remains a region under the current box, and Space keeps parent hierarchy, current box, contained cards, and inspector continuity.
- Statistics records continuity without becoming the product core. Membership interruption stays contextual rather than promotional.

## Implementation hypothesis changed

- A stable left route rail, center focal-object workbench, and bounded right context rail are accepted as the PC Web shell.
- The center workbench changes silhouette for flip, multiple choice, lock, elimination, swipe, review/audio, Space, Statistics, Mine, authentication, and membership gating while the shell grammar remains stable.
- This design-only PR creates authority for a later implementation PR; it does not create a Web application, runtime client, deployment, or browser acceptance evidence.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and design artifacts listed above.
- Generated/dependency/cache/archive read: none.
- External workspace read: none. `/Users/lenkin/programing/card make` was not modified, and this task does not produce or approve candidate card content.

## Files changed

- `docs/design/search-runs/2026-08-01-pc-web-core/`: eight candidate directions, hard-filter record, three connected pairwise reviews, fragment harvest, mutation record, promotion record, candidate proof, and promoted rendered proof.
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`: accepted Focused Workbench decision and rejected alternatives.
- `docs/design/mapping/pc-web-core-implementation-map-v1.md`: future implementation surfaces, state coverage, accessibility obligations, and explicit gaps.
- `docs/design/mocks/pc-web-core-surfaces-v1.md`: accepted artifact specification and design-review checklist.
- `docs/design/mocks/pc-web-core-surfaces-v1.html`: eleven contained PC Web reference frames.
- `docs/design/rejected/pc-web-core-surface-failures-v1.md`: dashboard, multi-card grid, floating-window, and module-catalogue failure sedimentation.
- `docs/design/{decisions,mapping,mocks}/README.md`, `spec/doc-manifest.json`: active-authority indexes and dependencies.
- `docs/agent-runs/2026-08-01-pc-web-core-design.md`: this run record.

## Commands run

- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-08-01-pc-web-core` -> passed.
- `node scripts/check_design_metadata_leaks.mjs` -> passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- Browser visual and containment inspection at `1600 x 1000` around contained `1440 x 900` frames -> passed for all 11 surfaces; no document/app overflow and no console warnings or errors.
- `scripts/run_local_gates --profile dev` -> 19/20 passed with the declared dev-only Node 25.9.0 versus required 22.13.0 exception; 0 failed gates; report `exports/local-gates/20260731T225704Z-032e9a5d-dev-81751/report.json`.
- `python3 scripts/validate_pr_design_gate.py ...` -> pending until commit exists.
- `git diff --check` -> passed before final record update.

## Validation results

- Search-run structure passes with eight candidates, hard filters, a connected survivor-comparison graph, candidate-bound rendered evidence, fragment harvest, mutation, and promotion.
- The visual metadata quarantine passes after replacing real catalog labels with anonymous spatial labels while preserving the accepted visual hierarchy.
- Harness validation passes.
- Browser inspection proved 11/11 contained `1440 x 900` surfaces, no descendant crossing the frame bounds, no page-level horizontal overflow, and no console warning/error. Auth, every interaction silhouette, review/audio, Space, Statistics, Mine, and membership gating were visually inspected.
- Local dev gates completed with 0 failures. The only declared exception is dev Node version drift; exact-head PR CI remains pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A
- Reason: this is a design-only HTML/Markdown authority change, not a signed binary or deployment.

## Agent review status

- Reviewer: Codex
- Status: passed for the design-only repository scope; exact-head PR checks remain delivery conditions.
- Blocking findings: none in the design search, rendered-artifact, metadata-quarantine, manifest, or implementation-mapping scope.
- Review summary: the artifact keeps one focal object, preserves all five interaction silhouettes, retains Space hierarchy and state semantics, avoids dashboard/catalogue/window-manager failure modes, does not expose raw catalog metadata, and explicitly leaves Web code, runtime, accessibility, responsive, and deployment evidence unclaimed.

## User-visible UI impact

- Design authority only. No production UI changes in this PR.
- Accepted source: `docs/design/decisions/pc-web-core-surface-decision-v1.md` and `docs/design/mocks/pc-web-core-surfaces-v1.html`.
- Interaction/motion source: `docs/design/interaction-motion/learning-core-interactions-v1.md`.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`.
- Implementation mapping: `docs/design/mapping/pc-web-core-implementation-map-v1.md`.
- Unimplemented gap: the entire production PC Web application and its browser/accessibility/deployment evidence remain for a separate implementation PR.

## Card make external workspace impact

- N/A. No card payload was produced, approved, imported, or modified.

## Risks and open questions

- Tablet still needs a dedicated rendered proof before tablet implementation.
- The future Web implementation must prove keyboard operation, screen-reader semantics, zoom, reduced motion, dark appearance, responsive containment, runtime parity, purchase recovery, and deployment behavior.
- Anonymous content in the proof must later be stress-tested against approved payloads without exposing raw catalog metadata.
- External launch capabilities, distribution accounts, compliance, payments, production SMS, signed clients, approved content, and physical-device evidence remain separate launch blockers.

## Follow-up

- Wait for exact-head required checks and formal product-owner approval; merge only after both are green.
- After the design authority is accepted and merged, create a separate PC Web implementation PR mapped to these artifacts.
