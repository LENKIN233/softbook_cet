# PC Web Core Surfaces v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`

## Rendered Asset

- `docs/design/mocks/pc-web-core-surfaces-v1.html`

## Source Decision

- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/search-runs/2026-08-01-pc-web-core/`
- `docs/design/mapping/pc-web-core-implementation-map-v1.md`

## Target

Dedicated PC Web application at a 1440 x 900 reference viewport. The artifact is deliberately wide-screen-native: persistent route rail, one center focal object, and bounded right context. It is not a phone frame enlarged into empty desktop space.

## Visual Frames

The rendered board contains:

1. Auth phone-SMS identity gate.
2. Flip resolved state with exactly 有把握 / 再回看.
3. Multiple-choice prompt plus 2 x 2 grid.
4. Lock vertical rows.
5. Elimination strike-through candidates.
6. Swipe single top card plus left/right trails and discrete alternatives.
7. Resolved review with attached answer slip and attached audio resource.
8. Space tree / current box / contained cards / inspector.
9. Quiet Statistics daily ledger.
10. Mine account and membership object.
11. Contextual membership interruption preserving the affected Space object.

## First-Read Paths

- Auth: identity card -> phone/SMS operation -> recovery.
- Learning: current card -> interaction -> attached result/audio -> context rail -> route rail.
- Space: current box -> contained cards -> selected inspector -> parent tree -> return to Learning.
- Statistics: daily ledger -> quiet rows -> route rail.
- Mine: account object -> membership action -> account controls.
- Membership interruption: affected object -> reason for limit -> purchase/restore -> preserved route context.

## Focal Objects

Each frame has one: identity card, current knowledge card, current box/selected card, daily ledger, account object, or limited current object. Wide-screen context never becomes an equal secondary dashboard.

## State And Interaction Guarantees

- Coral is the sole strong active-library accent in Learning and Space reference frames.
- Flip self-assess is exactly two levels and uses mint / amber without red punishment semantics.
- Auto-scored interactions do not ask for self-assessment.
- Audio stays attached to the current card.
- Favorite stays a tag and sleep stays a region under the current box.
- Statistics uses tabular numerals and no achievement chrome.
- Membership is contextual, not promotional.

## Quarantine Status

`accepted_authority`: the rendered user-visible text contains no agent, validator, metadata, runtime, source path, identifier, test fixture, raw error, or unfinished-work language. The artifact is design-only and may be consumed only after this PR is accepted and merged.

## Unimplemented Or Unproven Gaps

- No production Web implementation or deployment is included.
- Browser keyboard, screen reader, zoom, dark appearance, reduced motion, and responsive evidence must be produced by the implementation PR.
- Content density uses anonymous exam-oriented examples and must be retested against approved payloads.
- Tablet remains a separate future rendered-proof requirement.
- External accounts, payments, content approval, signed clients, compliance, and operational evidence remain pending.

## Design Review Checklist Answers

Q1: The active library is consistent across Learning and Space frames. Coral alone drives active edges and primary actions; other library colors appear only as small low-weight dots in Space. Non-library surfaces use neutral ink.

Q2: The first-read object is singular per frame and remains visually above route/context chrome.

Q3: The five core interactions have visibly different center silhouettes. Space uses parent tree -> current box -> contained cards -> inspector.

Q4: No forbidden pattern appears: no gradient text, serif, reward chrome, full-width bottom navigation, removed self-assess tokens, or user-visible internal language.

Q5: Not a phone artifact. Each app surface is a contained 1440 x 900 frame.

Q6: Flip has exactly 有把握 / 再回看, Statistics uses tabular numerals, and Learning has no module picker.
