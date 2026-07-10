# Space State Baseline v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Rendered Asset

- `docs/design/mocks/space-state-baseline-v1.html`

## Product Truth

Space remains a top-level product capability and physical hierarchy. Even when content is loading, unavailable, gated, or waiting for sync, the user should still understand where the current object lives:

```text
library -> group -> box -> card
```

Every state must preserve owning-container relationship. Favorite remains a tag on a card object. Sleep remains a physical zone under the owning container that affects the learning flow. Membership may limit complete Space value after trial, but it must not erase the user's understanding that Space is real product value rather than a generic promotion screen.

## Authority Boundary

This artifact does not change `spec/knowledge-map.json`, `spec/space-operations.json`, `spec/box-catalog.json`, `spec/membership.json`, or `spec/runtime-boundaries.json`.

It does not authorize RN or Web implementation in the same PR. Future implementation must name this artifact, map component regions to `docs/design/mapping/learning-space-implementation-map-v1.md`, and declare unimplemented gaps in the PR body.

It also does not define final backend state names, final paywall copy, animation timing, component tree, or conflict-resolution algorithm.

## State Invariants

- The address shelf stays visible unless authentication has fully blocked product entry before Space can be shown.
- The current box tray remains the first-read object, even when it is skeleton, empty, locked, stale, or partially cached.
- Parent library and group context remain secondary spatial context, not a module picker.
- Cards remain contained objects. They are never converted into equal top-level list rows.
- Favorite and sleep remain card states inside the box system.
- Recovery actions stay narrow: retry, continue with cached Space, return to Learning with context, restore purchase, or open the purchase surface.
- The display accent is the single strong library accent in the rendered baseline. Other state hues may appear only as feedback or status support.

## State Baselines

### Loading

Loading uses the same shelf and open-box structure as the accepted shelf-desk baseline. Skeleton blocks should sit where the shelf path, box tray, and contained card objects will appear.

Do not replace Space with a full-screen spinner. The user should feel the current physical address is being restored, not that they left the product surface.

### Empty Box

An empty state is an empty current box or empty filtered slice inside a known parent shelf. It should explain that no eligible cards are currently visible in this box while preserving the box outline and sibling context.

Allowed actions are returning to Learning with context, checking sibling box context, or refreshing the current Space view. It must not become module selection or a blank list.

### Remote Error

When remote loading fails, the UI should preserve the last known shelf and box if cache exists. The error is a narrow state rail attached to the Space object, with retry and cached-continuation affordances.

If no cache exists, the empty physical outline still appears with an error rail and a clear recovery path. The user should not see a destructive reload screen or generic technical failure page.

### Permission Or Paywall

Permission and membership states should keep a preview of the current library, group, and box, then show which depth is limited. The gate belongs to the Space object; it does not replace Space with a promotion surface.

Trial and premium users can see complete Space. Free-after-trial users can keep basic learning value and perceive Space value, but complete physical Space may be gated by membership. The visual state should support purchase or restore flows without changing Space ownership rules.

### Sync Merge Or Stale State

Sync merge and stale states should show that Space is temporarily reconciling cross-device position. Keep the current local address visible, label the cloud merge as status, and offer narrow recovery such as refresh or continue with the current cached Space until the merge resolves.

Do not expose a complex conflict editor, counter-heavy sync panel, or arbitrary position reassignment flow.

## Visual Frames

The rendered asset proves five phone states:

- `Loading`: address shelf and box skeleton remain spatial.
- `Empty Box`: an empty tray still has parent shelf context.
- `Remote Error`: cached Space remains visible with a narrow recovery rail.
- `Space Gate`: gated depth is attached to the current box, not turned into a standalone paywall.
- `Sync Merge`: local box and cloud merge status coexist without exposing a complex conflict manager.

## Implementation Mapping Expectations

Future `apps/mobile/src/space/SpaceSurface.tsx` or Web Space work should map this artifact as:

- address shelf -> library / group / box path and quiet sibling context;
- current box tray -> focal object in every state;
- state rail -> loading, remote, gate, or sync status attached to the Space object;
- contained object area -> card objects, skeleton objects, locked objects, or empty slots;
- recovery strip -> retry, restore, purchase, cached continuation, or return to Learning with preserved context.

This artifact should be consumed alongside `docs/design/mocks/space-surface-shelf-desk-v1.md`, not instead of it.

## Unimplemented Gaps

- No RN or Web implementation is included.
- Tablet and pc web versions still need dedicated rendered proof before implementation.
- Exact production copy, entitlement naming, retry behavior, and sync merge algorithm remain implementation or service hypotheses.
- Motion for loading, error recovery, and sync merge still needs storyboard evidence before animation changes.
- This artifact does not define Figma components or final component names.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot. The display accent is the single strong accent for the address shelf, current box edge, and primary recovery action.

Q2: Focal object is always the current box tray. First-read path is address shelf -> state rail -> current box tray -> contained objects or state slots -> narrow recovery action.

Q3: Space is not a Learning interaction silhouette. Its required silhouette remains physical hierarchy: parent shelf, current box focus, contained objects, favorite/sleep semantics, and Learning continuity.

Q4: No forbidden patterns are introduced: no gradient text, no gamification reward chrome, no full-width bottom tabbar replacement, no removed self-assess tokens, and no serif dependency.

Q5: The rendered asset uses `393 x 852` phone frames, includes viewport containment, and keeps state text, actions, and chrome inside the frame.

Q6: This is Space-only. It does not alter flip self-assess, stats numerals, or Learning's system-sequenced path.
