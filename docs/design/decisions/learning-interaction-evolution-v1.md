# Learning Interaction Evolution Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/search-runs/2026-09-03-learning-interaction-evolution/promotion-record.md`

## Decision

Accept `Quiet Object Theatre`, the mutated `lie-08` synthesis.

## Product Truth

- Learning remains one system-sequenced current CET card.
- The card retains a stable spatial address and physical identity.
- Flip, multiple choice, lock, elimination, and swipe keep their canonical operation models.
- Peek and favorite remain explicit but lightweight; hint remains conditional and attached.
- Flip alone uses `有把握` and `再回看`.
- Long content is never truncated, and support usage remains sticky for scheduling.

## Implementation Hypothesis

The screen separates the persistent card from its dense readable content:

```text
stable atmospheric stage
  -> intrinsic material sheet
  -> one contextual disclosure
  -> one action rail
```

The stage keeps the card's address, current-library accent, and physical continuity. The sheet holds prompt, support, interaction, correctness, and analysis. Empty stage area is softly tinted material atmosphere, not a giant empty white surface.

## Interaction Hierarchy

### First read

The learner sees the material sheet first, then its interaction silhouette, then one primary action. Progress, address, and favorite remain peripheral.

### Progressive disclosure

Only one disclosure control is visually present in the task plane:

- the address text is the lightweight `题眼` aperture and keeps its own callback;
- `提示` alone occupies the edge slot when the card has authored hint content;
- favorite remains a quiet tag glyph in the address region, not another pill button.

Peek and hint remain separate events and sticky usage facts. The address aperture has a full hit region but does not look like a second pill button.

### Resolve in place

Auto-scored interactions replace the task sheet with correctness and analysis inside the same stage. Flip replaces the front sheet with back content and exposes exactly two self-assess actions. A separate report page is optional depth, never the default result transition.

### Continue

A shallow next-card edge may appear only after result settlement. It indicates sequence without teaching swipe behavior to non-swipe interactions.

## Content Density

- Short content: centered sheet with a minimum reading body that includes the
  authored front signal and exam context; it must occupy at least half of the
  usable stage above the action rail.
- Standard content: sheet grows intrinsically within bounded stage insets.
- Long content: sheet reaches its maximum bound and owns vertical scrolling.
- The stage, address, edge slot, and action rail do not move between density classes.
- No prompt, option, back content, hint, or analysis is line-clamped to preserve the composition.

## Platform Strategy

- Phone: 48dp support targets, one vertical stage, thumb-reachable action rail.
- Tablet: wider sheet and larger side insets; no second dashboard column.
- PC-Web: compact pointer targets, hover/focus/keyboard states, bounded reading width.
- Reduce Motion: replace sheet transforms and card travel with short opacity/state changes.

## Acceptance Criteria For Implementation

- Current card stage remains fixed while short/long sheet density changes inside it.
- Initial phone state has one visually dominant action and no utility-button row.
- Only hint uses an edge disclosure; peek remains the lightweight address aperture.
- Favorite remains at least 44pt/48dp hit area while appearing as a lightweight glyph.
- Answer and analysis appear in the current object before any optional detail surface.
- Five interaction silhouettes stay distinguishable.
- Frequent study motion is brief, causal, interruptible, and disabled or reduced when requested.
- Long actual candidate content remains complete and scroll-reachable.

## Design Review Checklist Answers

Q1: The current library owns the only strong accent on stage, selected state, and action rail.

Q2: The intrinsic material sheet is focal; the first-read path is task -> interaction -> action -> in-place result.

Q3: Five canonical interaction silhouettes remain distinct inside the same stable stage.

Q4: No gradient text, reward chrome, full-width bottom bar, serif, or four-state self-assessment is introduced.

Q5: The 393x852 proof contains the stage, 48dp edge handle, bounded sheet, action rail, and floating navigation.

Q6: Flip uses exactly `有把握` and `再回看`; Learning never presents module selection or statistics as the primary path.
