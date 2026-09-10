# Learning Object Theatre Motion v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/learning-interaction-evolution-v1.md`

## Purpose

Define causal, brief, and interruptible transitions for the current paper-and-shelf composition without adding a new interaction family.

## Stable Regions

The paper envelope, address, favorite tag and primary action zone keep their positions. Motion happens inside the material sheet or directly under the user's gesture.

## Press Feedback

- Choice, lock, elimination, and action targets compress or change state for 80-140ms.
- Press feedback never delays submission.
- Feedback uses state, text, and border changes in addition to color.

## Support Reveal

- Hint and strategy controls stay attached to the current paper, separate from the primary action.
- Peek or hint content expands inward inside the material sheet in 120-180ms.
- Closing support restores the prior task position and does not erase sticky usage.
- Reduce Motion shows or hides support with opacity only.

## Resolve

- Multiple choice: selected option settles, incorrect/correct borders appear, and analysis replaces the option region within 160-240ms.
- Lock: each correct row opens locally; the final correct row reveals the answer and key reason without another confirmation.
- Elimination: strike follows the tapped phrase in the source sentence and can be undone before submission; the remaining sentence appears in the answer comparison.
- Swipe: the top task card follows the gesture and cancels back to center when ambiguous.
- Flip: front and back crossfade or rotate within the sheet; Reduce Motion uses a crossfade.

## Settle And Continue

After the result becomes readable, Continue exits the current paper and enters the next identity. A failed remote continuation restores the current paper. No idle next-card motion is required.

## Accessibility And Interruption

- Every motion has a non-motion state change conveying the same information.
- Reduce Motion disables depth, rotation, and card travel.
- A user can trigger the next available action without waiting for decorative completion.
- Result headings and the primary continuation action retain semantic labels; actual VoiceOver/TalkBack navigation must be verified before claiming assistive-technology acceptance.

## Design Review Checklist Answers

Q1: Motion uses only the current library accent and semantic feedback colors.

Q2: Motion reinforces the current sheet, result, and next action rather than creating a second focal object.

Q3: Each interaction retains its specific physical response.

Q4: No looping, celebratory, parallax, or reward motion appears.

Q5: All travel remains inside the stable phone stage and action rail.

Q6: Flip retains two self-assess states; no animation introduces another mastery decision.
