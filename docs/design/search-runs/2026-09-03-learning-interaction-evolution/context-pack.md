# Learning Interaction Evolution Context Pack

## Surface

Phone Learning surface, with tablet and PC-Web adaptation obligations recorded but not rendered in this run.

## Accepted Baseline

`docs/design/mocks/learning-card-rhythm-v1.md` and `docs/design/mocks/learning-card-rhythm-v1.html`, implemented on `main@910cd8e`.

## Product Truth

- Learning is a system-sequenced single-card flow.
- The current CET card is the focal learning object and progress unit.
- Five core interactions remain distinct: flip, multiple choice, lock, elimination, and swipe.
- Peek and favorite remain explicit but lightweight; hint is conditional and attached.
- Flip uses exactly `有把握 = confident / mint` and `再回看 = review / amber`; auto-scored interactions do not ask for self-assessment.
- Audio is a medium inside existing interactions and never autoplays.
- Learning preserves a light address relationship to physical Space without becoming a module picker.

## Hard Constraints

- One current library owns the single strong accent.
- One primary action is visually dominant in each state.
- The card's spatial anchor does not jump between short and long content.
- Long content remains complete through bounded internal scrolling; short content must not create a dead white half-screen.
- At most one progressive-disclosure control is visually prominent in the task plane.
- iOS controls retain at least 44pt hit regions; Android controls retain at least 48dp hit regions even when the visible glyph is smaller.
- Motion is brief, causal, interruptible, and replaceable by opacity/state changes under Reduce Motion.
- No user-visible internal process, transport, storage, test-data, or identifier language.

## Soft Objectives

- Reduce time to identify the next action.
- Make the card feel like one persistent object across front, answer, analysis, and continuation.
- Preserve examination authority without becoming a generic worksheet.
- Make empty area feel like material atmosphere rather than unused white UI.
- Make secondary controls discoverable without presenting them as peer buttons.
- Keep RN implementation bounded to one current-object component and interaction-specific task bodies.

## Source Artifacts

- `spec/requirement-memory.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.html`
- Apple HIG Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG Disclosure controls: https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- Apple HIG Feedback: https://developer.apple.com/design/human-interface-guidelines/feedback
- Android accessibility: https://developer.android.com/guide/topics/ui/accessibility/apps.html

## Forbidden Drift

- Dashboard, timeline, module chooser, progress cockpit, or result report as the focal object.
- A fixed giant white slab whose unused area dominates short cards.
- Multiple equal-weight helper buttons.
- Gesture-only access to peek, favorite, hint, or primary completion.
- Decorative animation, reward bursts, parallax, or motion that delays frequent study actions.
- A universal card shell that erases the five interaction silhouettes.

## Candidate Budget

Eight generation-one candidates, three survivors, one mutation round, three pairwise reviews, and one promoted synthesis. Stop when one synthesis beats the implemented baseline on task clarity, object continuity, and visual density without regressing accessibility or long-content handling.
