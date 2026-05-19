# Learning Card Rhythm v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/directions/learning-card-rhythm-directions-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`

## Purpose

This artifact defines the accepted Learning state rhythm around one current CET card. It complements `learning-core-interactions-v1.md`: that artifact defines each interaction model, while this artifact defines how those models sequence on the Learning surface without exposing implementation metadata.

## Rendered Proof

- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.html`

## Product Truth

Learning remains a guided single-card flow. The product should absorb system complexity so the user sees a useful CET card, a clear operation, a meaningful result, and a quiet continuation.

This artifact does not change the interaction contract. If a new interaction, scoring mode, or required card field is needed, update `spec/interactions.json` first.

## Implementation Hypothesis

Future RN / Web implementations should map the Learning surface into six rhythm states:

```text
place -> focus -> support -> resolve -> settle -> continue
```

The sequence can compress for fast cards, but it must not reorder into:

```text
source/status -> module choice -> task -> metadata/debug state
```

## Rhythm Contract

### place

Goal: make one current card feel intentionally placed in front of the learner.

Required:

- current card object is the visual anchor;
- current library identity is visible through one strong accent;
- spatial address is a light clue in human language;
- no user-visible internal ids, content source labels, queue/cache/runtime wording, or mock/seed labels.

Motion:

- current object may enter with a restrained 120-220ms lift or opacity settle;
- reduce-motion fallback is instant placement with no travel.

### focus

Goal: make the required operation obvious.

Required:

- preserve the canonical silhouette for the card's interaction;
- keep `peek`, `hint`, `favorite`, Space entry, and progress lighter than the primary operation;
- do not ask the user to pick a module before acting on the current card.

Motion:

- operation affordance can settle after the object by 40-80ms;
- no looping attention animation.

### support

Goal: allow help without derailing the card.

Required:

- `hint` is an attached layer and does not solve the card;
- `peek` gives small context and does not become a management surface;
- `favorite` is a tag state and not a physical destination;
- absent support content leaves no placeholder panel.

Motion:

- attached support appears in 120-200ms;
- support can close without changing answer state;
- reduce-motion fallback is inline appearance.

### resolve

Goal: show the answer outcome and exam-oriented explanation without emotional noise.

Required:

- auto-scored interactions reveal answer state and concise analysis;
- flip reveals back content and then shows only `有把握 = mint` / confident and `再回看 = amber` / review;
- wrong state means correction, not punishment;
- correct state means confirmation, not reward.

Motion:

- answer state can use a 120-180ms rim, strike, row expand, or option settle according to interaction type;
- no celebratory game-progress motion.

### settle

Goal: let the product handle bookkeeping quietly.

Required:

- result copy should be human and study-facing;
- sync or recovery copy should preserve continuity;
- implementation-layer terms must not appear in visible UI.

Acceptable user-facing meanings:

- result recorded;
- network will retry;
- continue learning;
- inspect location in Space.

Forbidden user-facing meanings:

- internal source identity;
- payload shape;
- cache or queue implementation;
- repository/runtime mode;
- card or box identifiers as raw labels.

Motion:

- settle state should be subtle and shorter than the primary interaction reveal;
- if sync work is still pending, do not animate a persistent technical status indicator.

### continue

Goal: move the learner forward without turning Learning into management.

Required:

- next card or review step becomes the natural primary continuation;
- Space remains a secondary continuation for location awareness;
- statistics and module browsing do not appear as inter-card blockers.

Motion:

- next object enters as continuation of the same learning stream;
- reduce-motion fallback is content replacement with clear focus retention.

## Interaction-Specific Notes

- `flip`: `resolve` can pause for self-assessment; no other interaction uses the two self-assess pills.
- `multiple_choice`: `resolve` belongs to the selected option and correct option; do not add a mastery prompt.
- `lock`: `focus` and `resolve` may repeat per row, but the full card still follows the six-state rhythm.
- `elimination`: `support` must not obscure strike state.
- `swipe`: ambiguous drag cancels before `resolve`; the rhythm returns to `focus`.
- `hint_layer`: appears only inside `support`, never as the current card's primary interaction.

## Failure And Recovery

Loading should preserve the one-card silhouette. Empty, unavailable, or permission states should explain the product condition and the next useful action. Remote failure should favor continuity and retry language over implementation details.

## Design Review Checklist Answers

Q1: The rhythm uses one current library accent and introduces no new accent family.

Q2: Focal object is the current card. First-read path is place -> focus -> support/resolve -> settle -> continue.

Q3: The artifact preserves the canonical Learning silhouettes and adds only sequencing around them.

Q4: No forbidden design patterns are introduced; reward chrome and metadata-first UI are explicitly rejected.

Q5: Not applicable; this artifact contains no rendered phone frame.

Q6: flip uses exactly `有把握 = mint` / confident and `再回看 = amber` / review; stats and module selection are not introduced.
