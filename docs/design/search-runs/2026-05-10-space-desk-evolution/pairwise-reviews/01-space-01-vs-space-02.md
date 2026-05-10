# Pairwise Review 01

## Pair

- Candidate A: space-01
- Candidate B: space-02

## Reviewer Role

Product Truth / UX Task / Physical Space / Implementation / Accessibility Layout.

## Winner

space-01

## Product Truth

`space-01` better preserves Space as current box first. `space-02` is useful for inspect but risks making the selected card the only object and weakening parent ownership.

## Task Clarity

`space-01` makes the default Space entry clearer because the user immediately sees the current box and contained cards. `space-02` makes card inspect clearer after selection, not on first entry.

## Space Or Interaction Fit

`space-01` keeps hierarchy as address -> box -> cards -> state. `space-02` only passes if the parent rail remains strong behind the card drawer.

## Visual System Fit

`space-01` gives one strong reading accent to the current box. `space-02` may need extra emphasis on selected card and parent rail, increasing accent competition.

## Implementation Mapping

`space-01` maps directly to existing Space regions. `space-02` needs selected-card drawer behavior and should wait for a storyboard if motion changes.

## Rationale

For first Space entry, the product needs physical hierarchy before card detail. `space-02` has a borrowable inspect pattern, but `space-01` is safer and clearer as the default screen.

## Borrowable Fragments

- Borrow `space-02` selected-card drawer only as a secondary inspect state.
- Keep `space-01` current box first-read.

## Rejected Fragments

- Reject a card-only drawer that hides the parent box.
- Reject any inspect transition that looks like a separate detail page.
