# Space Desk Evolution Promotion Record

## Promoted Artifact

Promote `space-04` into the accepted Space artifact `docs/design/mocks/space-surface-shelf-desk-v1.md`. This record is the search-run evidence behind that design-only artifact. It does not create RN or Web implementation authority by itself.

## Winning Candidate

`space-04` wins after hard filter and connected pairwise review. It is the only survivor that improves the accepted baseline's first-read path while preserving physical hierarchy, favorite tag semantics, sleep/wake semantics, and implementation mapping.

## Baseline Comparison

Compared with `docs/design/mocks/space-surface-visual-refinement-v1.md`, `space-04` keeps the same product model but strengthens the visual proof. The current box is more object-like, sibling/parent context is more legible through a quiet shelf, and sleep/wake state sits under the same box instead of reading like a separate management area. Production implementation still requires a future RN/Web PR that consumes the accepted artifact and mapping record.

## Borrowed Fragments

- From `space-03`: secondary shelf spine for parent context and wider-device adaptation.
- From `space-05`: quiet sleep alcove and lift-back wake causality.
- From `space-02`: selected card drawer can inform card inspect, but only when parent box remains visible.

## Rejected Fragments

- From `space-06`: progress cards, chart panels, and statistics-first first-read.
- From `space-07`: separate favorite and sleep containers.
- From `space-08`: decorative orbit map and physics-like node movement.
- From `space-02`: card-only drawer when it hides the current box.

## Rendered Proof

Rendered proof: `docs/design/search-runs/2026-05-10-space-desk-evolution/rendered-proof.html`.

The proof renders promoted `space-04` as a phone-constrained Space shelf desk with address shelf, current box tray, contained cards, favorite tag, sleep alcove, and return to Learning.

## Implementation Mapping Expectations

- Address shelf -> `SpaceSurface.tsx` parent context region for library/group/box.
- Open box tray -> current object region and first-read focal object.
- Contained card strip -> card objects and sibling card context.
- Favorite tag -> card state badge, not a container.
- Sleep alcove -> sleep/wake state region under original box ownership.
- Return strip -> Learning continuity region.
- Floating top-level chrome -> navigation affordance that stays secondary to the Space object.

## Unimplemented Gaps

- `docs/design/mocks/space-surface-shelf-desk-v1.md` extends `space-surface-visual-refinement-v1`; future RN implementation must consume the accepted mock, not this search-run directory alone.
- Tablet and pc web adaptation need a separate rendered proof if this synthesis becomes accepted.
- Loading, empty, remote-error, permission, and paywall Space states remain outside this run.
- Card inspect transition needs storyboard evidence before implementation changes motion or operation shape.

## Failure Sedimentation

Record these recurring failures in future rejected or eval work when they appear again: Space as progress dashboard, favorite/sleep as physical containers, decorative map without stable ownership, card detail without parent box, and shelf context that becomes a module picker.

## Design Review Checklist Answers

Q1: Current library is reading. The rendered proof uses reading coral as the single strong accent for the current box edge, active address chip, and primary return action.

Q2: Focal object is the current box tray. First-read path is address shelf -> open box tray -> contained cards -> sleep alcove -> return to Learning.

Q3: Space is not a Learning interaction silhouette. The required silhouette is physical hierarchy with parent context, current box focus, contained card objects, attached favorite tag, and sleep zone under the same box.

Q4: No forbidden design patterns are used in the proof: no gradient text, no gamification reward chrome, no full-width bottom tabbar, no removed self-assess tokens, and no serif dependency.

Q5: The proof is rendered at `393 x 852` phone size with contained card labels, secondary shelf context, and no clipped primary return action.

Q6: This is Space-only. It does not alter flip self-assess, stats numerals, or Learning's system-sequenced path.
