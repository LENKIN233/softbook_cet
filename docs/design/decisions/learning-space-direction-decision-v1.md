# Learning + Space Direction Decision v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`

## Decision

Accepted design direction:

```text
Addressed Exam Object
```

It accepts `Direction B: Knowledge Object` as the core direction, with two constraints:

- From `Direction A`: editorial exam authority must govern content typography and analysis hierarchy.
- From `Direction C`: the primary interaction must remain immediately readable and low burden.

## Product Truth

The accepted direction must preserve these truths:

- Learning is a system-sequenced single-card flow.
- The user should feel guided by a CET-aware system.
- Every card physically exists in a library / group / box / card hierarchy.
- Space is a top-level product entry and a background coordinate for Learning.
- Favorite is a tag, not a box.
- Sleep is a physical zone affecting learning flow.
- Audio is content medium, not an interaction family.
- flip self-assess has exactly two states: `有把握` and `再回看`.

## Implementation Hypothesis

The accepted visual model:

> A current CET card is an addressed knowledge object. It is handed to the user for one low-cost action, while a restrained spatial aperture shows where the object belongs.

This is a design hypothesis, not a product spec replacement. RN implementation must map to this artifact and declare any gaps.

## Accepted Screen Model

### 1. Current Object Plane

The current card is the visual anchor. It should read as a material object with:

- one current library accent edge;
- one exam content plane;
- one interaction-specific affordance area;
- restrained glass depth;
- no ornamental rewards.

### 2. Action Plane

The interaction shape owns the immediate task:

- `flip`: content object + two self-assess pills below.
- `multiple_choice`: prompt + 2x2 option tile grid.
- `lock`: vertical lock rows, no per-row card shells.
- `elimination`: candidate set with visible strike-through state.
- `swipe`: one top object with left/right trail hints.

### 3. Tool Plane

Secondary tools stay light and non-competing:

- `peek`
- `hint`
- `favorite`
- contextual `sleep` only when spatial management is meaningful

They must not form a toolbar that competes with the primary action.

### 4. Address Aperture

Learning exposes a small address aperture:

```text
CET track -> library -> group -> box
```

It should explain location without becoming module navigation. Full browsing belongs to Space.

### 5. Space Continuation

Space should feel like stepping back from the current object to its shelf:

- current box is primary;
- parent library/group are visible;
- sibling boxes/cards are inspectable;
- favorite tag and sleep zone are visible as state, not as replacement boxes.

## Accepted Composition

```text
phone / learning

top:      current library chip + light session continuity
middle:   current card object, occupying the first read
inside:   exam content + interaction silhouette
below:    light tools + primary result / next action
edge:     address aperture into Space
bottom:   floating capsule navigation
```

```text
phone / space

top:      current library / group context
middle:   current box as spatial focus
around:   neighboring boxes/cards at lower weight
side:     favorite tag and sleep state indicators
bottom:   return-to-learning affordance + floating capsule navigation
```

## Rejected Directions

### Editorial Exam Card As Primary

Rejected as primary because it can make Space feel like a table of contents rather than a physical product differentiator. Keep its typography discipline.

### Focus Console As Primary

Rejected as primary because it can erase the addressable-card worldview and drift toward ordinary exercise UI. Keep its action clarity.

### Pure Knowledge Object

Rejected as unbounded form because material effects can become self-important. The accepted direction uses objecthood only to support content and spatial meaning.

## Acceptance Criteria For Future Visual Artifacts

A Learning mock or implementation is aligned only if:

- blurred silhouette still shows one current object and the correct interaction shape;
- user can identify the current library without seeing two competing strong accents;
- address is present but not promoted to module selection;
- `peek`, `hint`, and `favorite` are visible but secondary;
- Space entry feels like location context, not a separate manager app;
- no dashboard, XP, streak, badge, confetti, or promotional chrome appears;
- the surface can be explained without saying “it is just a flashcard”.

## Design Review Checklist Answers

Q1: Current library must be explicit per screen. The accepted direction permits only that library's identity color as strong accent.

Q2: Focal object is the current addressed card. First-read path is current object -> interaction affordance -> light tools/result -> address aperture.

Q3: The accepted direction binds each core interaction to `visual-language.json#interaction_silhouettes`; deviations require a new decision artifact.

Q4: This decision introduces no forbidden pattern and rejects game chrome, dashboard learning, full-width tabbar, and gradient/title effects.

Q5: Phone renderings derived from this decision must prove containment and safe-area in the visual artifact or implementation PR.

Q6: Learning-specific constraints are explicit: no primary module selection; flip has exactly two self-assess pills.
