# DesignCandidate space-02

## Candidate ID

`space-02`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Start Space from a selected card drawer but keep parent box ownership visible.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-02
- Screenshots: Rendered survivor panel `space-02` in `candidate-proofs/survivor-comparison.html`.

## Product Truth Fit

This candidate supports card inspect by letting the selected card slide forward while the current box remains behind it. It preserves favorite and sleep as card states. Risk: if the drawer becomes too dominant, Space could feel like a card detail page rather than a physical hierarchy.

## Focal Object

Selected card object inside the current box.

## First-Read Path

Selected card drawer -> parent box rail behind it -> address chip -> sibling cards -> sleep status.

## Interaction Silhouette

Space hierarchy silhouette with a card-forward inspect state. Parent box must remain visible as the card's container.

## Spatial Model

Library and group appear in the top address. Current box appears as a backing rail. The inspected card is still visibly inside the box, with sibling cards tucked behind.

## State Language

Favorite sits on the selected card. Sleep is a destination zone inside the parent box rail, not a separate page. Wake would slide the card back into the active row.

## Motion Causality

Card inspect is caused by selecting a contained card. The card moves forward; parent box remains stable. Sleep movement is secondary.

## Platform Strategy

Works on phone for inspect-heavy cases. Tablet could show card detail beside the box. Pc web could split inspect and shelf columns. It is weaker as a default first Space screen.

## Implementation Mapping

Requires `SpaceSurface.tsx` to support a selected-card detail region while still rendering parent box context. It should not define new arbitrary card movement APIs.

## Known Risks

The card can become the only object users see. The parent box may feel like decorative backdrop unless strongly labelled.

## Design Review Checklist Answers

Q1: Current library is reading; the selected card uses reading accent only through its parent box edge and active tag.

Q2: Focal object is selected card, with first-read path back to parent box. This is clear for inspect but weaker for first entry.

Q3: Space hierarchy is preserved only if parent box remains visible behind the card.

Q4: Candidate avoids forbidden visual patterns and does not introduce reward or dashboard chrome.

Q5: Phone containment needs proof because the drawer plus parent rail can crowd narrow width.

Q6: Space-only candidate; Learning sequence and flip/stats rules are unchanged.
