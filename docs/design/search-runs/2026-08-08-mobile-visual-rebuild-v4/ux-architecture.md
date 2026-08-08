# Mobile Visual Rebuild V4 — Grayscale UX Architecture

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/physical-space/space-model-v1.md`

## Status

- Lifecycle: `completed_no_promotion`; retained as the grayscale architecture
  input to the rejected cohort.
- Purpose: define operable information, action, state, and platform composition
  before the visual styling that was subsequently reviewed and rejected.
- This is an architecture contract for later grayscale proof, not a final
  screen design and not implementation authority.

## Product Truth

- Learning is the primary entry and a system-sequenced single-card flow.
- One current card or interaction object owns the first read.
- The learner sees one primary decision at a time, with no more than three quiet
  secondary actions.
- Feedback answers whether the action registered, what the result means, what
  happens next, and whether Space state changed.
- The five interaction families are visually and operationally distinct.
- Space is a top-level physical hierarchy, not a collection list or analytics
  page.
- Statistics stays simple; Mine owns account and membership context.
- Authentication precedes Learning but does not replace the product with an
  account-management shell.
- iOS phone, Android phone, and tablet share product meaning, not pixel-identical
  composition.

## Implementation Hypotheses

- Grayscale is the first gate because hierarchy that depends on color is not
  robust enough for later theming or accessibility.
- The primary action should remain spatially predictable near the interaction
  object, but it need not be a fixed full-width footer.
- Supporting information should appear inline after the action or in one
  secondary pane, not as a stack of equal-weight cards.
- Platform-standard navigation, back behavior, safe-area handling, and text
  scaling should be retained unless a candidate demonstrates a measurable UX
  gain and an accessible equivalent.
- Tablet should use panes to reveal continuity; it should not expose more
  management operations merely because space is available.

## Grayscale-First Rule

Every Phase 1 wireframe uses only:

- four neutral values: page, primary surface, primary ink, secondary ink;
- typographic scale and weight;
- spacing, alignment, order, and limited containment;
- solid, dashed, or patterned annotations outside the learner surface only.

It must not use:

- library, correctness, warning, or brand colors;
- gradients, glass, shadows, textures, decorative illustration, or logo marks;
- a fake status bar, fake Dynamic Island, fake gesture handle, or device bezel;
- color-coded arrows or reviewer notes inside the learner surface.

If two states cannot be distinguished without color, add a label, icon, shape,
or structural change before color is introduced.

## Shared Information Architecture

```text
authentication gate
  └─ verified session
      ├─ 学习  — current system-sequenced task
      ├─ 空间  — physical hierarchy and current-object location
      ├─ 统计  — quiet daily record and review signal
      └─ 我的  — identity, membership, purchase and recovery
```

The four destinations preserve independent navigation state. Switching
destinations must not discard an in-progress answer, a revealed analysis, or a
recoverable error unless the user explicitly starts over.

## Surface Responsibilities

| Surface | Focal object | Primary task | Permitted support | Must not become |
| --- | --- | --- | --- | --- |
| Learning | current card or interaction object | complete the next learning action | light progress, audio when required, hint, favorite, Space continuity | dashboard, module picker, poster |
| Space | current box or selected card within visible ownership | inspect location or perform a supported spatial action | parent context, siblings, sleep/wake, favorite tag, return to Learning | flat card list, file manager, counter board |
| Statistics | today's learning record | understand today and continue | completed/review signal, check-in | analytics suite, gamification wall |
| Mine | learner identity or membership state | manage account or entitlement | purchase, restore, sign out, help | second home dashboard |
| Authentication | phone and verification step | enter, verify, or recover | consent, resend timing, editable phone, network retry | route clone, promotional landing page |

## Learning State Architecture

### Common State Sequence

```text
resume or load
  → task ready
  → learner action
  → submitting or evaluating
  → registered result
  → explanation / light self-assess when applicable
  → next card or safe exit
```

Every state declares:

| Field | Requirement |
| --- | --- |
| Current object | Exactly one; remains identifiable across state changes. |
| Primary task | Expressed as learner intent, not system narration. |
| Primary action | One strongest available action; disabled only with an adjacent reason. |
| Secondary actions | Zero to three; visually later than the task. |
| Registered state | Selected answer or manipulation remains visible after submission. |
| Feedback | Outcome and explanation are adjacent to the object they explain. |
| Recovery | Retry, edit, back, skip, or safe exit appears where applicable. |
| Space continuity | Compact ownership or state cue; never a miniature map dashboard. |

### Interaction Silhouettes In Grayscale

- Flip: one dominant front or back surface; reveal first, then exactly two
  self-assessment actions. Audio and hint remain attached to the content.
- Four-choice: prompt first; four choices form a 2 × 2 decision field when text
  fits. At large text, preserve four clear choices through one-column reflow
  rather than clipping.
- Lock: a vertical sequence of manipulable rows with explicit locked, active,
  and resolved states. Do not wrap each row in a separate decorative card.
- Elimination: a bounded candidate set with visible retained and removed states;
  removal cannot be conveyed by low opacity alone.
- Swipe: one active object with directional alternatives and a non-gesture
  equivalent. Partial movement, cancellation, commit, and reduced-motion states
  remain distinguishable.

### Result Continuity

The preferred information order is:

```text
registered learner choice
  → outcome
  → concise reason
  → exam-relevant analysis
  → Space consequence when relevant
  → 下一张
```

The result may scroll. The current result and next action must remain findable;
there is no requirement to cram the entire explanation above the fold.

## Space State Architecture

The minimum hierarchy is:

```text
library context
  group context
    current box focus
      current card and sibling states
```

Space must show at least three levels of relationship at once through position,
containment, label hierarchy, or an equivalent non-color cue. It must also
preserve:

- the same current card when navigation context permits;
- parent ownership when a card is favorited or sleeping;
- a clear return to Learning;
- explicit pending, success, error, and retry behavior for sleep and wake;
- selection state through rotation, pane changes, and route return.

The hierarchy may be progressively disclosed on phone. Progressive disclosure
does not permit flattening the model.

## Supporting Surface Architecture

### Statistics

First read: `today → what changed → continue`.

- One daily summary may contain completed and due-for-review information.
- Check-in is a supporting acknowledgement, not the screen's visual identity.
- No circular score dashboard, multi-chart grid, streak celebration, or account
  status stack.

### Mine

First read: `identity or membership state → relevant action`.

- Group account, membership, purchase or restore, and help by task.
- Keep learning statistics out unless a small link provides useful continuity.
- Errors stay next to the failed action and preserve entered information.

### Authentication

First read: `phone → verification code → continue`.

- Phone entry and code entry are successive states, not two competing forms.
- Code sent, resend cooldown, expiry, incorrect code, editable phone, offline,
  pending, and retry states are required.
- Success returns to the original destination and restores its safe state.
- Error copy describes what the learner can do; it never displays raw system
  details.

## iOS Phone Composition

The iOS proof uses system safe areas and a conventional top-level tab model.
It is not wrapped in a drawn phone or a custom floating device object.

```text
┌──────────────────────────────┐
│ safe-area-aware context      │
│ title + light progress       │
├──────────────────────────────┤
│                              │
│ current interaction object   │
│ content may scroll           │
│                              │
├──────────────────────────────┤
│ inline result / recovery     │
│ primary action zone          │
├──────────────────────────────┤
│ system-conforming four tabs  │
└──────────────────────────────┘
```

Rules:

- Use the tab bar only for the four top-level destinations; task actions belong
  with the task or in an appropriate toolbar.
- Preserve each tab's navigation state.
- Respect safe areas, home indicator, keyboard, rotation, and Dynamic Type.
- Use standard back and modal-dismiss expectations. Do not invent an Android
  back affordance inside the learner surface.
- Minimum interactive hit region is 44 × 44 pt. Custom controls require pressed,
  disabled, selected, loading, and accessibility states.

## Android Phone Composition

The Android proof is edge-to-edge with explicit system-bar and gesture insets.
It uses Android navigation and back expectations rather than an iOS copy.

```text
┌──────────────────────────────┐
│ edge-to-edge system inset    │
│ app context / optional up    │
├──────────────────────────────┤
│                              │
│ current interaction object   │
│ content may scroll           │
│                              │
├──────────────────────────────┤
│ inline or supporting sheet   │
│ primary action zone          │
├──────────────────────────────┤
│ four-destination nav bar     │
│ gesture/navigation inset     │
└──────────────────────────────┘
```

Rules:

- System Back and predictive-back preview preserve or safely resolve the
  current task. In-app Back is added only when hierarchy requires Up behavior.
- The bottom navigation region contains destinations, not primary actions.
- Supporting content may become a bottom sheet when that is clearer than an
  inline expansion; it must not obscure the current choice or retry path.
- Respect cutouts, edge-to-edge system bars, gesture navigation, three-button
  navigation, software keyboard, and manufacturer aspect-ratio variation.
- Minimum interactive target is 48 × 48 dp. Text uses scalable sizing and must
  survive the user's font and display settings.

## Tablet Composition

Tablet is a separate composition for both portrait and landscape. Its purpose
is to expose useful relationship, not more controls.

### Learning

```text
┌──────────┬──────────────────────────┬──────────────┐
│ top-level│ current interaction      │ context /    │
│ nav      │ object and primary task  │ result /     │
│          │                          │ Space cue    │
└──────────┴──────────────────────────┴──────────────┘
```

- Portrait may collapse the context pane into an attached sheet or stacked
  region while keeping navigation and the current object distinct.
- Landscape may show navigation, task, and context concurrently.
- The secondary pane cannot become module navigation or a permanent dashboard.
- A long explanation scrolls within a readable column; buttons and inputs have
  maximum widths rather than stretching across the window.

### Space

```text
┌──────────┬──────────────────────────┬──────────────┐
│ top-level│ library / group / box    │ selected     │
│ nav      │ spatial hierarchy        │ object       │
│          │                          │ inspector    │
└──────────┴──────────────────────────┴──────────────┘
```

- The hierarchy and selected object remain related during resize and rotation.
- On iPadOS, a platform-appropriate sidebar or split-view behavior is a later
  hypothesis. On Android tablet, adaptive navigation rail and pane behavior are
  a separate hypothesis.
- Neither platform may reuse a scaled phone bottom bar when a side navigation
  model is more ergonomic.

## Large Text And Narrow Width Behavior

At 200% text or the largest supported platform text settings:

- primary copy wraps without ellipsis;
- action labels wrap or the component changes presentation;
- 2 × 2 choice layout may reflow to one column without changing choice order;
- fixed bottom regions do not cover focused content or the next action;
- horizontal scrolling is not required for ordinary text and controls;
- Space may progressively disclose panes while preserving the hierarchy path;
- decorative content yields before instructional or recovery content.

The minimum browser-equivalent reflow proof is 320 CSS pixels. Native proofs
must also cover the narrowest supported device and split-window state.

## State Coverage Before Color

Every platform architecture must show these grayscale states before color work:

- authentication: phone, code, pending, incorrect, expired, offline, resend,
  success and restored destination;
- Learning: load, ready, selected or manipulated, evaluating, success,
  incorrect, explanation, next, retry and safe exit;
- flip: front, revealed, `有把握` = confident/mint, `再回看` = review/amber;
- audio where content requires it: idle, loading, playing, paused, ended, failed,
  retry;
- Space: hierarchy load, empty only when truthful, selected box, selected card,
  favorite, sleep pending/success/error, wake pending/success/error;
- Statistics: no activity, activity, check-in available, checked in, unavailable;
- Mine: signed in, trial, free, paid, expired, purchase pending/error/success,
  restore pending/error/success.

## Grayscale Review Gate

An independent reviewer must run the following without color or annotations:

1. Five-second first read: name the current task and the next action.
2. One-hand action path on each phone architecture.
3. Large-text path through authentication, one Learning interaction, result,
   and retry.
4. Back, cancel, and recovery behavior without losing committed work.
5. Learning → Space → Learning continuity.
6. Tablet portrait and landscape change without stretched phone chrome.
7. Screen-reader order and control names from the learner surface only.
8. Leakage inspection for visible, accessibility, generated, dynamic, loading,
   empty, error, paywall, and recovery copy.

Any failure returns to the architecture stage. It must not be patched with
color, decoration, or reviewer explanation.
