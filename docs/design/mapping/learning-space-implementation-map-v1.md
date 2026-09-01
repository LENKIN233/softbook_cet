# Learning + Space Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`

## Design Artifact Source

- `docs/design/design-harness.md`
- `docs/design/briefs/learning-space-worldview.md`
- `docs/design/directions/learning-surface-3-directions.md`
- `docs/design/directions/learning-card-rhythm-directions-v1.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mocks/learning-space-phone-frames-v1.md`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-state-baseline-v1.html`
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`

## Product Truth

This map does not authorize implementation by itself. It maps accepted design decisions to code surfaces so future implementation PRs do not invent user-facing design inside RN.

## Implementation Hypothesis

Current RN files are behavior prototypes. They can provide interaction and state evidence, but they do not define final user-facing visual design.

## Code Surface Ownership

| Product Surface | Current Code Surface | Design Obligation |
|---|---|---|
| Learning current card | `apps/mobile/src/learning/LearningSurface.tsx` | Render the current card as an addressed exam object, not a generic card shell. |
| Learning interaction area | `apps/mobile/src/learning/LearningSurface.tsx` | Preserve interaction-specific silhouettes for flip, multiple choice, lock, elimination, and swipe. |
| Learning state rhythm | `apps/mobile/src/learning/LearningSurface.tsx` and app-level Learning states | Preserve the place -> focus -> support -> resolve -> settle -> continue sequence without exposing implementation metadata. |
| Learning tools | `apps/mobile/src/learning/LearningSurface.tsx` | Keep `peek`, `hint`, and `favorite` visible but secondary. |
| Learning address aperture | `apps/mobile/src/learning/LearningSurface.tsx` | Show light library/group/box context without turning module selection into the primary path. |
| Space hierarchy | `apps/mobile/src/space/SpaceSurface.tsx` | Render library / group / box / card as spatial hierarchy, not flat list or two-box shortcut. |
| Favorite state | `apps/mobile/src/space/SpaceSurface.tsx` and learning tag affordance | Treat favorite as tag state, never as a physical box. |
| Sleep state | `apps/mobile/src/space/SpaceSurface.tsx` and contextual learning affordance | Treat sleep as a physical zone affecting learning flow. |

## Required Implementation Mapping In Future PRs

Any future PR changing user-facing Learning or Space UI must state:

- which accepted artifact is being implemented;
- which component region maps to current object plane;
- which component region maps to action plane;
- which component region maps to tool plane;
- which component region maps to address aperture or Space continuation;
- which interaction silhouettes are implemented;
- which design gaps remain.

## Minimum Visual Contract For Learning

### Current Object Plane

RN should expose one main visual container for the current card object. It must not be decomposed into many equal cards, panels, counters, and modules.

At a fixed phone viewport, the current object keeps one stable resting height
across short and long content. Inside it:

- the identity band remains fixed;
- the task band balances short content and owns vertical scrolling for long
  content;
- the action band remains fixed and thumb-reachable.

The outer object must not grow and shrink with every prompt, option, support,
or result transition.

### Action Plane

RN should branch by interaction type at the shape level:

- flip: card object + bottom two-pill self-assess.
- multiple choice: prompt + 2x2 option grid.
- lock: vertical lock rows.
- elimination: candidate set with strike-through affordance.
- swipe: top card with left/right trail hints.

Changing only icons or button labels is not enough to satisfy interaction silhouette requirements.

### Tool Plane

Tools should be visually lighter than the primary interaction:

- `peek` is reached through the compact address aperture.
- `hint` uses a small card-edge trigger and reveals inward as an attached layer.
- `favorite` is a quiet tag mark in the identity band.
- `sleep` should remain contextual and spatial.

These tools must not be rendered together as a bottom button row beside the
primary action. The bottom action band belongs to the interaction's one current
primary action.

### State Rhythm

Learning implementation should consume `docs/design/interaction-motion/learning-card-rhythm-v1.md`:

- place: one current card object with current library accent and human address cue;
- focus: interaction silhouette is the primary operation;
- support: `hint`, `peek`, and `favorite` stay attached and secondary;
- resolve: auto-scored interactions reveal answer state, while flip alone uses two self-assess pills;
- settle: result and recovery copy stay study-facing and never expose source, payload, cache, queue, repository, runtime, mock, seed, card id, or box id language;
- continue: next card or Space continuation appears without forcing module selection.

### Address Aperture

Address context should be visible as a compact spatial clue:

```text
track / library / group / box
```

It should not become a module picker.

## Minimum Visual Contract For Space

Space implementation must preserve:

- visible hierarchy;
- current card or current box focus;
- box contents;
- favorite tag state;
- sleep zone and wake action;
- return path to Learning.

It must not reduce Space to:

- favorites box + sleep box;
- flat card list;
- study statistics board;
- arbitrary drag-and-drop organizer.

### Space Region Mapping

Future `apps/mobile/src/space/SpaceSurface.tsx` implementation should map the accepted `Box Desk` direction:

- parent context region -> library / group breadcrumb;
- current object region -> current box focus;
- contained object region -> card tiles and sibling cards;
- state region -> favorite tag, sleep zone, and wake action;
- continuity region -> return to Learning with current context.

For visual fidelity, consume `docs/design/mocks/space-surface-shelf-desk-v1.md` as the current accepted Space rendered baseline. It extends `space-surface-visual-refinement-v1` with the shelf-desk synthesis promoted from design search:

- address shelf -> compact `library / group / box` path plus quiet sibling context, not a module picker;
- open box tray -> first-read current box object with one reading-coral accent edge;
- contained card strip -> active and sibling card objects with favorite / sleep tags attached to cards;
- sleep alcove -> sleep / wake state under the same box;
- continuity strip -> return to Learning with preserved context;
- floating tab capsule -> top-level navigation chrome that does not replace Space hierarchy.

For non-ideal Space states, also consume `docs/design/physical-space/space-state-baseline-v1.md` and `docs/design/mocks/space-state-baseline-v1.html`:

- loading -> shelf and box skeletons preserve the current address instead of showing a full-screen spinner;
- empty box -> empty tray remains under the known parent shelf instead of becoming a blank list or module picker;
- remote error -> cached Space remains visible with retry or cached-continuation recovery;
- permission / paywall -> gated depth attaches to the current Space object and does not replace Space with a generic promotion page;
- sync merge -> local address remains visible while cloud merge status resolves without exposing arbitrary position reassignment.

## Resolved Design Proof Questions

The previous design-proof questions are now closed by accepted artifacts:

- exact phone-frame mock for accepted Learning direction: `docs/design/mocks/learning-space-phone-frames-v1.html`;
- exact phone-frame mock for accepted Space direction: `docs/design/mocks/learning-space-phone-frames-v1.html`;
- expanded Space visual direction and state proof: `docs/design/mocks/space-surface-visual-proof-v1.html`;
- refined accepted Space visual baseline: `docs/design/mocks/space-surface-visual-refinement-v1.html`;
- accepted Space shelf-desk baseline promoted from search: `docs/design/mocks/space-surface-shelf-desk-v1.html`;
- accepted Space non-ideal state baseline: `docs/design/mocks/space-state-baseline-v1.html`;
- tablet layout decision: `docs/design/decisions/learning-space-platform-layout-v1.md`;
- pc web layout decision: `docs/design/decisions/learning-space-platform-layout-v1.md`;
- dark-mode rendering proof: `docs/design/mocks/learning-space-phone-frames-v1.md`;
- accessibility contrast proof for low-alpha library chips: `docs/design/mocks/learning-space-phone-frames-v1.md`;
- rendered motion prototype for flip / hint reveal / swipe: `docs/design/storyboards/learning-space-motion-prototype-v1.html`.
- rendered Learning card rhythm phone proof for place / focus / support / resolve / settle / continue: `docs/design/mocks/learning-card-rhythm-v1.html`.

## Mobile Implementation Evidence — 2026-08-30

The mobile integrity implementation consumes the accepted artifacts already
listed in this map. It does not add design authority or change product truth.

Implemented mapping:

- Learning current object plane remains one addressed card in
  `apps/mobile/src/learning/LearningSurface.tsx`.
- Lock action plane now follows the accepted vertical-row silhouette: only the
  current row is operable, a wrong choice remains in that row for retry,
  already-correct rows stay open, and submit becomes available only after every
  row matches `answer_key.lock_pattern`.
- Core answer controls expose their selected / checked / disabled semantics to
  assistive technology without adding another visual decision or mastery scale.
- Space parent-context region now provides compact previous / next browsing for
  library, group, and sibling box. Changing the browsed address does not mutate
  the current Learning card or its knowledge ownership.
- Space current-object region remains the open box tray; contained-card,
  favorite-tag, and sleep-alcove regions continue to stay under that owning
  box.
- Space continuity region keeps `回学习` bound to the unchanged Learning
  context and exposes `回到当前卡盒` whenever manual browsing steps away from
  the current card address.
- Entering box inspection starts on the exact current Learning card, including
  when that card is not the first sibling in source order. At a completed
  server round, Space follows the receipt-bound `spaceCardId` instead of losing
  continuity because the active selection is empty.
- Space hierarchy, inspection, paging, state, and recovery actions expose
  assistive roles/state and use at least `44 x 44dp` touch regions.
- Manually browsed boxes use selected-box address, card-position, and sleep copy;
  `同盒` and `当前` language is reserved for the current Learning card's box.
- Accessibility-size Space cards and inspection surfaces leave long exam
  prompts unbounded by `numberOfLines`, while the surrounding scroll ownership
  keeps the full prompt and actions reachable.
- Phone Space uses an intrinsic vertical scroll container because the shell
  consumes part of the raw window height; accessibility-size phone layouts
  delegate scrolling to the shell, while accessibility-size tablet Space owns
  its scroll container. The open box and `回学习` action therefore remain
  reachable instead of being clipped by the workbench.
- The iOS privacy manifest declares the linked phone number, user ID,
  pseudonymous installation device ID, and product interaction data that the
  authenticated mobile runtime actually sends for account and learning
  functionality; none is declared for tracking.
- Native private-audio downloads use one monotonic outer deadline across every
  redirect, native transfer, and redirect-boundary filesystem cleanup. The
  deadline cancels the current body-stalled task and routes timeout, late task,
  cancel-callback, and outer-cache cleanup through one serialized idempotent
  partial-file owner, so an Android body read stall cannot leak a partial file
  or replace the original timeout with a missing-file cleanup race.
- Learning-session membership fields remain a consistency observation only.
  Stage or trial-clock drift forces a fresh revisioned Bootstrap read; the
  session never writes an unrevisioned trial projection into global membership
  state and a stale session cannot extend the canonical trial.
- `peek` and `hint` remain reachable on every interaction silhouette. Dense
  lock, elimination, and swipe cards render the opened support layer inside the
  current interaction object instead of accepting a tap with no visible result.
- Once the user opens `peek` or `hint`, the attempt keeps a sticky usage fact
  even if the layer is collapsed before submission; scheduling therefore does
  not change because of a presentation toggle.
- The resolved-card detail owns vertical scrolling while keeping the continue
  action inside the same object. Analysis title, summary, and exam tip are no
  longer line-clamped on the reference phone or accessibility text sizes.
- Result continuation now distinguishes completed judgment from durable save.
  Saving, retained-sync, and failed-save states are visible on the resolved
  card, and a failed save exposes an explicit retry action.
- Interaction test selectors use stable ordinal positions rather than card
  content IDs or answer-derived values.

Implementation-only gaps and evidence boundary:

- This change adds no new Space operation, arbitrary reassignment, motion
  shape, visual token, or platform layout authority.
- Tablet and PC Web rendered-proof gaps listed by the accepted Space artifact
  remain unchanged.
- Repository tests and native static checks do not prove real-device layout,
  VoiceOver / TalkBack behavior, private audio playback, or receiver deployment.

## Remaining Implementation Boundary

The original mapping PR was design-only. Mobile now has the scoped implementation
evidence recorded above; future RN / Web implementation work must still name the
accepted artifact being consumed, map component regions to this file, declare
implementation-only gaps, and pass the design gate.

## Design Review Checklist Answers

Q1: Future PRs must name the current library per screen and prove Law of One. This mapping uses no single rendered library.

Q2: Focal object is the current addressed card for Learning and the current box/card location for Space.

Q3: Mapping requires all five canonical Learning silhouettes and calls out that icon swaps are insufficient.

Q4: Mapping rejects forbidden patterns and does not introduce visual CSS or RN styling.

Q5: Phone-frame containment is resolved by `docs/design/mocks/learning-space-phone-frames-v1.html`.

Q6: Learning and flip constraints are explicitly mapped.
