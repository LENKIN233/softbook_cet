# Mobile Editorial Study Object v2

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Product Truth

软书的移动端第一人格是“懂四六级、直接带你处理当前知识卡”，不是玻璃材质展示页，也不是进度管理器。当前卡必须是首屏最大且最有意义的对象；Space 需要让卡的位置可见，而不是把位置写成一行标签。

## Implementation Hypothesis

Use an editorial study object: warm exam-paper material, deep plum ink, and one library-colored margin. Glass becomes optional chrome material rather than product identity. The card owns its primary operation and transforms into its answer state instead of handing the user to another panel.

## Decision

Recommend `mue-01` from `docs/design/search-runs/2026-08-07-mobile-editorial-reset/` for product-owner acceptance.

The new grammar is:

1. A tall current card occupies the working viewport.
2. A library-colored margin names its knowledge ownership.
3. The primary action is physically attached to the card edge.
4. The reverse side contains answer, exam insight, and exactly two flip self-assess states.
5. Space renders the current box as a nested cabinet with an explicit current-card marker.
6. Navigation is a quiet route rail; the active route uses a small mark rather than a giant filled pill.

## Why v1 Is Not Sufficient

- Its frosted panels, oversized radii, soft aurora blobs, and capsule controls read as a generic design trend rather than a CET product.
- Its real Learning implementation compresses the current card into the top third and leaves the majority of the viewport inactive.
- The primary action is visually detached from the study object.
- Space continuity is stated as text but not experienced as physical position.
- Black/white/gray hierarchy remains the perceived theme even when one accent is technically present.

## Interaction and UX Model

- Front: read the prompt and one concise exam-oriented signal; optional line/hint/favorite remain typographic secondary tools.
- Flip: the lower card edge is the operation; motion rotates the same object, with a reduce-motion crossfade fallback.
- Back: answer and易错点 remain on the card; 有把握 and 再回看 occupy the lower edge as two equal semantic choices.
- Space: the current card marker appears inside its box compartment; “回到学习” returns to the same learning position.
- Large type: the vertical identity margin becomes a horizontal band and the screen scrolls as one object; no absolute action overlap.

## Platform Direction

- iPhone and Android phone share the same content hierarchy and device-neutral visual identity, while respecting native safe areas and font metrics.
- Tablet must use a dedicated composition: the identity margin becomes a left gutter and Space can sit beside the card. That proof is a required follow-up before implementation.
- PC web is not authorized by this mobile decision.

## Rendered Proof

- `docs/design/mocks/mobile-editorial-study-object-v2.html#learning-front`
- `docs/design/mocks/mobile-editorial-study-object-v2.html#learning-back`
- `docs/design/mocks/mobile-editorial-study-object-v2.html#space-current-card`

## Single-Card UX Contract Answers

- Current card: the tall editorial paper object.
- Primary task: understand or answer the system-selected CET knowledge point.
- Primary action: interaction-specific operation attached to the card edge.
- Secondary actions: line, hint, favorite; all lower visual weight.
- Feedback: the same object reveals answer and exam-oriented reasoning.
- Recovery: a failed load retains the front and replaces the edge with retry; navigation remains available.
- Learning ↔ Space continuity: margin address maps to the cabinet and current-card marker.

## Design Review Checklist Answers

Q1: The current active subject uses coral alone for identity. Mint and amber are reserved for flip self-assess.

Q2: The current card is focal; the first read is prompt → insight → attached operation → route rail.

Q3: The flip proof uses one large card and two self-assess zones; Space uses nested box/card structure.

Q4: The proof has no gradient title, gamification, full-width bar, serif, pure-black theme, or removed self-assess state.

Q5: The 393 × 852 proof contains the action, address, and floating route rail without clipping.

Q6: Learning remains system-sequenced; flip uses exactly 有把握 / 再回看.

## Status

Candidate design-only decision awaiting explicit product-owner acceptance. It does not authorize React Native implementation yet.
