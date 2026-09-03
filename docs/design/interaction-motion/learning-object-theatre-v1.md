# Learning Object Theatre Motion v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/learning-interaction-evolution-v1.md`

## Purpose

Define causal, brief, and interruptible transitions for the Quiet Object Theatre without adding a new interaction family.

## Stable Regions

The stage, address, favorite tag, edge disclosure slot, and action rail keep their positions. Motion happens inside the material sheet or directly under the user's gesture.

## Press Feedback

- Choice, lock, elimination, and action targets compress or change state for 80-140ms.
- Press feedback never delays submission.
- Feedback uses state, text, and border changes in addition to color.

## Support Reveal

- The single edge handle remains fixed.
- Peek or hint content expands inward inside the material sheet in 120-180ms.
- Closing support restores the prior task position and does not erase sticky usage.
- Reduce Motion shows or hides support with opacity only.

## Resolve

- Multiple choice: selected option settles, incorrect/correct borders appear, and analysis replaces the option region within 160-240ms.
- Lock: each correct row opens locally; full analysis appears only after all rows resolve.
- Elimination: strike follows the tap; resolution reuses the remaining set's location.
- Swipe: the top task card follows the gesture and cancels back to center when ambiguous.
- Flip: front and back crossfade or rotate within the sheet; Reduce Motion uses a crossfade.

## Settle And Continue

After the result becomes readable, a shallow next-card edge may rise 8-12px behind the action rail. Activating continue moves the resolved sheet a short distance along the vertical flow and replaces it with the next sheet. Non-swipe interactions never travel horizontally.

## Accessibility And Interruption

- Every motion has a non-motion state change conveying the same information.
- Reduce Motion disables depth, rotation, and card travel.
- A user can trigger the next available action without waiting for decorative completion.
- VoiceOver/TalkBack focus moves to result heading, then the primary continuation action.

## Design Review Checklist Answers

Q1: Motion uses only the current library accent and semantic feedback colors.

Q2: Motion reinforces the current sheet, result, and next action rather than creating a second focal object.

Q3: Each interaction retains its specific physical response.

Q4: No looping, celebratory, parallax, or reward motion appears.

Q5: All travel remains inside the stable phone stage and action rail.

Q6: Flip retains two self-assess states; no animation introduces another mastery decision.
