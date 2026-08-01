# PC Web Core Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`

## Design Artifact Source

- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/mocks/pc-web-core-surfaces-v1.md`
- `docs/design/mocks/pc-web-core-surfaces-v1.html`
- `docs/design/search-runs/2026-08-01-pc-web-core/`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`

## Product Truth

This map translates accepted design regions into future Web responsibilities. It does not define runtime contracts, product state names, data schemas, component trees, or deployment readiness.

The later, separate implementation status and gap table live in `docs/design/mapping/pc-web-core-implementation-evidence-v1.md`. This design-planning map remains the accepted baseline and must not be read as shipped-runtime evidence.

## Shared Shell Mapping

| Region | Design role | Future Web responsibility |
|---|---|---|
| Route rail | Canonical Learning / Space / Statistics / Mine order | Accessible primary navigation with visible current route |
| Center workbench | One route-specific focal object | Main landmark and route content; never an equal-card dashboard |
| Context rail | Address, attached support, recovery, or one secondary action cluster | Complementary landmark with bounded content and deterministic focus order |
| Aurora layer | One active-library atmosphere or neutral account atmosphere | Shared tokens, light/dark support, reduced-motion-safe background |

## Auth Mapping

- Identity gate -> phone field, SMS request, code verification, and bounded recovery.
- Account access is established before the Web shell exposes operable Learning.
- User-facing failures use safe copy; raw provider or API errors never render.
- Future implementation must bind to the existing authentication contract rather than introducing a Web-only account model.

## Learning Mapping

| Interaction | Required center silhouette | Non-touch equivalence |
|---|---|---|
| flip | one large current card plus exactly two self-assess pills after reveal | click/Enter reveal; Tab then choose 有把握 or 再回看 |
| multiple_choice | prompt plus 2 x 2 option grid | click or 1–4 keys; selected state remains visible without color alone |
| lock | vertical lock rows, no per-row card shell | focus/Enter to operate the active row |
| elimination | 3–6 candidates with visible reversible strike-through | click/Space toggles strike before submit |
| swipe | one top card with left/right trails | drag or discrete left/right buttons and arrow keys |

- Object plane -> current addressed card and exam content.
- Action plane -> the interaction-specific shape above.
- Tool plane -> hint, peek, favorite, and attached audio; always secondary.
- Result slip -> concise answer and explanation attached to the same object.
- Continue action -> next system-sequenced card; no module picker detour.
- Address aperture -> compact library / group / box / card path opening Space.

## Audio Mapping

- Audio chip remains attached to the current card and maps to ready, preparing, playing, paused, recoverable failure, and unavailable states.
- Keyboard activation and visible focus are required.
- The Web audio implementation must verify the same private manifest and byte hash boundaries as other clients; browser playback success cannot replace content approval or production manifest evidence.

## Space Mapping

| Region | Required meaning |
|---|---|
| Tree rail | Library / group hierarchy and current path; other libraries remain low-weight context |
| Current box workbench | First-read current container with contained active, favorite, and sleeping card objects |
| Inspector | Selected card/box meaning, supported favorite or sleep/wake action, and return to Learning |
| State rail | Loading, empty, remote recovery, membership limit, or sync status attached to the current box |

No arbitrary drag-and-drop reassignment, table view, favorites box, or sleep-only collection is authorized.

## Statistics Mapping

- Daily ledger is the focal object.
- Counts use tabular numerals and restrained rows.
- No score ring, streak celebration, achievement wall, trend dashboard, or default-home promotion.

## Mine And Membership Mapping

- Account object binds phone identity, membership state, purchase/restore, and sign out.
- Web purchase has equal authority to app purchase and must converge on shared membership state.
- Membership interruption attaches to the limited object, preserves free-state context, and offers purchase/restore without promotional urgency.

## Required Future Implementation Evidence

- Real browser screenshots for Auth, five Learning silhouettes, resolved review/audio, Space, Statistics, Mine, and membership interruption at 1440 x 900.
- Keyboard-only completion of every core task with visible focus.
- Screen-reader landmark and accessible-name audit.
- 200% zoom and 1024px pc-web containment checks without horizontal task loss.
- Reduced-motion proof for flip and swipe alternatives.
- Light/dark contrast checks and no color-only correctness state.
- Explicit gap table against `docs/design/mocks/pc-web-core-surfaces-v1.html`.
- Runtime integration tests cannot claim deployment, payment, content approval, signed builds, or launch readiness.

## Unimplemented Gaps

- No Web code, Web runtime adapter, browser cache, purchase integration, hosting, deployment, or production evidence exists in this design-only PR.
- Tablet has not received its dedicated rendered proof.
- Final Web copy, exact responsive breakpoints, and component names remain implementation hypotheses.
- Formal content, audio, account, payment, distribution, compliance, availability, recovery, and security evidence remain pending.

## Design Review Checklist Answers

Q1: Future implementation must bind each Learning/Space frame to exactly one current library accent.

Q2: The center focal object owns first read; rails stay materially and semantically secondary.

Q3: All five interaction branches must change shape, not only labels or icons. Space must retain tree / box / contained objects / inspector.

Q4: Future implementation must pass the visual forbidden-pattern and metadata-leak scans.

Q5: Not phone-specific. Future evidence must prove 1440 x 900, 1024px pc-web, and 200% zoom containment.

Q6: Flip stays two-level; Statistics is tabular; Learning stays system-sequenced.
