# Rejected Baseline Retrospective: Mobile Core Surface Reset v1

## Decision

The product owner rejected the shipped result backed by `docs/design/decisions/mobile-core-surface-reset-v1.md`. The v1 artifact remains historical evidence but should not authorize another polish-only implementation.

## What Failed

- “Aurora Glass” became the visible product identity instead of a supporting material.
- Large rounded panels and capsules made the app look interchangeable with generic AI-generated study products.
- The accepted proof did not enforce the canonical ~60% flip-card silhouette strongly enough, allowing the RN output to shrink the current card and leave dead space.
- The navigation active state became larger and louder than necessary.
- The product technically used an accent but still read as black/white/gray because color did not carry meaningful object ownership.
- The Space address was described more convincingly than it was rendered.

## Sedimented Failure Rules

- A neutral surface plus one colored CTA is not sufficient evidence of library identity.
- Whitespace is only valid when it strengthens the focal object; an inactive half-screen is not “restraint.”
- A design gate passing does not prove aesthetic quality when the accepted baseline itself is generic.
- Material language must carry product meaning. Repeated glass blur, large radius, and pill controls are not a product grammar.
- The primary Learning operation must visually belong to the current card.

## Replacement Candidate

`docs/design/decisions/mobile-editorial-study-object-v2.md` is the proposed replacement. It remains candidate-only until explicit product-owner acceptance.
