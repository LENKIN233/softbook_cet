# Mobile Visual Rebuild V3 — UX State Matrix

## Scope And Interpretation

This matrix operationalizes the product truths in `spec/product-core.json`, `spec/platform-contract.json`, `spec/interactions.json`, `spec/visual-language.json`, and `docs/design/single-card-ux-contract.md` for design review. Exact copy, timing, component structure, and layout remain implementation hypotheses until a direction is accepted.

The rows have a two-phase evidence boundary. For Phase A design promotion, an
exact code-native proof must make the proposed programmatic semantics,
keyboard/switch path, focus order/recovery, live updates, width/type/contrast,
and platform compositions observable and independently reviewable. References
below to screen-reader or platform behavior are binding design contracts, not a
claim that production RN or native VoiceOver/TalkBack has already passed. After
the exact design is accepted, Phase B uses a separate implementation PR to
verify the same contracts on real iOS, Android, and tablet builds/devices,
including safe area, IME/back, native assistive technology, async behavior, and
persistence/restoration. Phase A cannot substitute for Phase B, and design
acceptance is not release approval.

For every Learning row, reviewers must be able to name:

- `current_card`
- `primary_task`
- `primary_action`
- no more than three quiet `secondary_actions`
- `feedback_state`
- `escape_or_recovery`
- `space_continuity`

If any field is missing, the state is not visually implementable.

## Cross-Surface State Rules

| Concern | Required state behavior | Failure to reject |
| --- | --- | --- |
| One primary decision | Only one action is visually dominant at a time. Dominance transfers after the current task is complete. | Two equal CTAs such as `查看解析` and `下一张`; tab chrome competing with the task. |
| Result and analysis | Auto-scored answer commits into an inline result plus useful CET analysis; `下一张` becomes primary only after the result is legible. Flip reveals analysis before its two light self-assessment choices. | Result on a detached page; optional analysis that can be skipped by an equally strong `继续`; analysis hidden behind a second navigation stack. |
| Recovery | Errors preserve valid input and the current card state. Retry or correction is adjacent to the failed step. | App restart, full-flow reset, raw error, or silent failure. |
| Continuity | Switching surface preserves the learner’s meaningful context. Space can return to the relevant Learning context in one explicit action. | Returning to a generic root, losing inspected box/card, or silently resetting Learning detail. |
| Text growth | Task, option, analysis, and error text reflow vertically. Core meaning is never removed by hard line limits. | Ellipsis on question/analysis; clipped controls; horizontal page overflow. |
| Non-visual equivalent | Gesture, color, sound, and motion each have a labeled control, text/state cue, or programmatic announcement. | Swipe-only answer, color-only correctness, sound-only completion, or motion-only hint. |
| Async state | The initiating action becomes pending/disabled, its label or progress communicates work, duplicate submission is blocked, and completion/error is announced. | Multiple requests, invisible pending state, or focus loss after completion. |

## Authentication

| State | Current focus and primary action | Required feedback / recovery | Accessibility and platform notes |
| --- | --- | --- | --- |
| Phone entry / idle | Phone field is the first focus; `获取验证码` is primary only after a valid 11-digit number. | Inline formatting/help does not masquerade as an error. | Numeric keypad hint where supported; field has persistent programmatic label; disabled state is announced and not encoded only by opacity. |
| Phone invalid | Phone field retains input; correction is the task. | Human-readable inline error associated with the field; focus returns to the field. | Error announced once as an assertive/live update, then remains reviewable without repeated announcements. |
| Requesting code | Request action becomes pending and cannot be fired twice. | Input remains visible; safe cancel/back remains available if supported. | Pending state exposes `busy`; spinner has a text equivalent. |
| Code requested | Code field becomes primary; destination number remains visible in privacy-safe form. | `更换手机号` is one explicit action and does not require navigating back through an invisible stack. | Focus moves to code heading/field predictably; screen reader hears where the code was sent. |
| Resend cooldown | Code entry remains primary; resend shows remaining availability without becoming a dashboard timer. | At expiry, resend becomes available in place. | Do not announce every second. Announce initial wait and availability; timer text uses tabular numerals if displayed. |
| Request failed | Retry code request is primary; phone input is preserved. | Human message plus retry; `更换手机号` remains available. | Error and recovery are adjacent in semantic order; no raw status or route. |
| Code incomplete / invalid format | Code field is primary. | Inline correction retains entered digits. | One-time-code autofill allowed but never required. |
| Verifying | Submit is pending/disabled; code remains visible. | Duplicate verification blocked. | Busy state and completion announced; focus is not sent to the top of the screen. |
| Wrong / expired code | Correct or replace code is primary. | Distinguish invalid from expired in human language; expired state provides resend in one action; wrong-number correction remains one action. | Error binds to code field; focus moves to error summary or field according to platform convention. |
| Auth network loss | Retry verification is primary; inputs and requested-code context survive. | Offline/network message avoids blame and internal terms. | Retry target ≥44 x 44; status is exposed as a live update. |
| Auth success | Continue into the preserved Learning context; no intermediate promotional screen. | Success transition is brief, interruptible, and has a reduce-motion alternative. | Focus lands on the Learning task heading/current card, not tab chrome. |

## Learning Session Shell

| State | Current focus and primary action | Required feedback / recovery | Space continuity |
| --- | --- | --- | --- |
| Session loading | Lightweight current-session placeholder; no fake metric dashboard. | If delayed, show human progress; if failed, retry without losing the previous valid session. | Previous known library/box context may remain as a quiet cue but must not present stale actionability. |
| Session ready | Exactly one current card/interaction object is focal. Primary action comes from its interaction state. | Light progress and current library are context only. Up to three secondary actions may include favorite, hint, audio, or safe exit when applicable. | Current library identity is visible; address is inspectable without competing with the task. |
| Long content | Content and task remain focal; primary action stays findable through a sticky action zone or clear end-of-content handoff. | No hard truncation. Scroll position remains stable when feedback expands. | Continuity cue stays subordinate and never steals text width. |
| Session unavailable / empty | Recovery or safe return is primary; never invent a fake card. | Explain the learner-facing condition and a useful next step without queue/runtime language. | A valid Space entry may be offered only if it helps recovery and does not imply arbitrary card selection. |
| Leave and return | Return to the same meaningful task state unless product logic has validly advanced it. | Unsaved transient gesture state may reset; committed answer/result must not. | Space and top-level tab changes preserve current card/box context. |

## Flip

| State | Current card / primary task | Primary and secondary actions | Feedback / recovery / continuity |
| --- | --- | --- | --- |
| Front | One large card; understand the CET cue before revealing. | Primary: `查看解析`/reveal. Quiet secondary: explicit audio if present, hint, favorite. | No self-assessment before reveal. Address cue identifies current library/box quietly. |
| Hint exposed | Same card remains focal; hint is physically attached to it. | Primary remains reveal; close hint is explicit. | Hint does not become a separate card or obscure the primary action. Reduced motion uses immediate reveal/crossfade. |
| Analysis revealed | Same card, now with back/analysis, remains focal; read the useful explanation. | Exactly two peer self-assessment choices: `有把握` and `再回看`. No third/fourth mastery level. | Focus moves to analysis heading, then choices. `再回看` uses amber/warm semantics, never error red. |
| Assessment committed | Understand that the choice registered and where the card will go. | Primary transfers to `下一张`. Secondary may inspect its Space address. | Short confirmation plus position/review implication; retry only if commit failed. No raw sync state. |
| Commit failed | Current result remains visible; retry commit is primary. | Safe retry; changing the assessment is explicit if allowed. | Do not roll the learner back to the front or lose analysis. |

## Multiple Choice

| State | Current card / primary task | Primary and secondary actions | Feedback / recovery / continuity |
| --- | --- | --- | --- |
| Unanswered | Prompt above a 2 x 2 option field is the silhouette; choose one answer. | Selecting an option is the primary action. Hint/audio/favorite remain quiet and content-dependent. | Options have labels beyond color and a predictable screen-reader order. |
| Option selected / submitting | Chosen tile remains identifiable; evaluation is pending. | Duplicate selection/submit is blocked. If selection and submit are separate, only submit is dominant. | Busy state does not reflow the grid or discard selection. |
| Correct | Result, correct option, and useful analysis appear in the same task surface. | Primary becomes `下一张` only after analysis is present. | Correctness uses text/icon plus color; focus moves to result heading; Space implication is concise. |
| Incorrect | Chosen and correct options are distinguishable without relying on red/green alone; analysis explains the CET trap. | Primary becomes `下一张` after the result is legible; retry appears only if product logic permits and never competes equally. | Preserve option and result history. Auto-scored feedback must not use `有把握`/`再回看`. |
| Evaluation failed | Chosen option remains selected; retry evaluation is primary. | Retry without re-answering; safe exit remains available. | No false correct/incorrect state and no internal error. |

## Lock

| State | Current card / primary task | Primary and secondary actions | Feedback / recovery / continuity |
| --- | --- | --- | --- |
| Locked | A vertical sequence of rows/slots is focal; adjust each required position. | The active slot control is primary; hint/audio/favorite quiet if relevant. | Each row exposes locked/unlocked state, position, and available values to assistive tech. No card frame around every row. |
| Partially solved | Solved rows visibly settle while unsolved rows retain clear focus. | Continue adjusting the next unresolved slot. | Progress is conveyed by row state, not a distracting percentage/counter. Wrong adjustments are recoverable in place. |
| All slots set / checking | Whole pattern is evaluated once; duplicate input is blocked briefly. | Check/commit is primary only if not automatic. | Focus and scroll position remain stable. |
| Unlocked / result | Unlocked pattern plus inline explanation is focal. | Primary becomes `下一张`; inspect address may be secondary. | Auto result uses text/icon/state, not flip self-assessment colors. Lock-open motion has a reduced-motion state change. |
| Check failed | Pattern remains intact; retry is primary. | No forced reset of all slots. | Error is announced and associated with the result region. |

## Elimination

| State | Current card / primary task | Primary and secondary actions | Feedback / recovery / continuity |
| --- | --- | --- | --- |
| Candidate set | A 3–6 item set/column is focal; remove distractors. | Each candidate is an operable toggle/action. | Struck state includes text decoration/icon/programmatic checked state; it is not opacity/color alone. |
| Partially eliminated | Remaining structure is still readable; undo is available without becoming primary. | Continue eliminating; undo last or restore item is quiet. | Focus stays on the operated candidate; screen reader announces retained/eliminated. |
| Commit/check | Final remaining set is evaluated; no accidental navigation gesture competes. | Check is primary if explicit. | Duplicate submission blocked; state persists while pending. |
| Result | Remaining answer and inline analysis are focal. | Primary becomes `下一张`; retry/undo only if allowed and visually secondary. | Result explains why removed material was distracting; Space implication remains concise. |
| Evaluation failed | Candidate set remains exactly as operated; retry is primary. | Restore/retry without reconstructing the set. | Announce failure once; no internal details. |

## Swipe

| State | Current card / primary task | Primary and secondary actions | Feedback / recovery / continuity |
| --- | --- | --- | --- |
| Neutral | Exactly one top card with a subtle deck/trail is focal; make a binary judgement. | Left/right labeled buttons are always available; drag is an equivalent shortcut, not the only path. | Direction labels are visible/programmatic and do not rely on color. |
| Drag below threshold | Top card follows input but remains current. | Release cancels and returns to neutral. | No answer is committed; haptic/motion is supplemental. Reduced motion may omit card travel. |
| Drag past threshold | Intended state is previewed before commit. | Release commits; moving back below threshold cancels. | Preview exposes state text/icon; accidental vertical scroll does not answer. |
| Keyboard/switch/button choice | Same binary states and commit semantics as drag. | Chosen labeled button is primary input. | Full parity for VoiceOver/TalkBack, switch access, and external keyboard. |
| Committed result | Card settles away, then result plus concise analysis appears before the next card becomes active. | Primary becomes `下一张` after result is legible. | Do not auto-advance so quickly that result is unreadable. Position/review implication is stated without internal algorithm language. |
| Commit failed / undo window | Failed commit restores the same card and state; retry is primary. If undo exists, it is time-insensitive for screen-reader users or otherwise remains explicitly reachable. | Retry/undo is labeled. | No phantom advancement or lost card. |

## Hint And Audio Enhancements

| State | Requirement | Rejection condition |
| --- | --- | --- |
| Hint available | Appears as a subordinate action attached to the current interaction. Open/closed state is programmatic. | Separate hint card, dominant hint CTA, gesture-only reveal. |
| Hint open | Current task and primary action remain findable. Close is explicit and focus returns to the trigger. | Hint covers task/CTA, steals scroll, or traps focus. |
| Audio available | Explicit labeled play control; duration/loading may be disclosed quietly. | Autoplay, front subtitle added by UI when content contract forbids it, or audio treated as a sixth interaction. |
| Audio loading | Play control exposes busy state and prevents duplicate requests. | Spinner-only feedback or layout jump. |
| Audio playing | Play/pause and progress are operable; sound is never the sole carrier of instruction/result. | Playback without pause, background state that cannot be found, or screen-reader label that does not update. |
| Audio unavailable | Current card remains solvable when the content contract allows it; otherwise retry is explicit. | Raw URL/cache/manifest language or silent dead control. |

## Space To Learning Continuity

| State | Phone | Tablet | Accessibility / recovery |
| --- | --- | --- | --- |
| Space overview | Shows library → group/box structure as spatial structure; one current library dominates. | May expose hierarchy and current container simultaneously, using tablet-specific text measures. | Structure uses headings/relationships in semantic order, not absolute position alone. |
| Box inspect | Drill into one box while preserving an explicit back/breadcrumb path. | Master-detail or spatial inspector may keep parent hierarchy visible without duplicating phone cards. | Focus moves to box heading; back returns to invoking node. |
| Card inspect | Shows address, learning state, favorite tag, and permitted sleep/wake action. | Inspector can coexist with hierarchy; it must not become an arbitrary reassignment panel. | All state has text/programmatic meaning; target size and semantic order remain valid. |
| Favorite toggle | Tag toggles in place and confirms success. | Same semantics, adapted placement. | Expose checked/pressed state; failure restores truthful state and offers retry. |
| Sleep / wake | Move into/out of the supported sleep zone with consequence explained before destructive-feeling action. | Spatial change may animate between regions, with reduce-motion alternative. | Confirmation/failure is announced; user cannot mistake sleep for deletion or knowledge reassignment. |
| Start/return to Learning | One explicit action opens the relevant supported Learning context while preserving card/box identity. | Learning may open alongside context or as a focused workspace; not a stretched phone modal. | Focus lands on the Learning task; back returns to the inspected Space context. |
| Empty / unavailable box | Explain condition and safe next action; do not invent content. | Preserve surrounding hierarchy. | No dead-end; unavailable entitlement and network failure are distinguishable in human language. |

## Statistics And Mine

| Surface/state | Focal purpose and primary action | Required restraint | Accessibility / continuity |
| --- | --- | --- | --- |
| Statistics default | Understand today’s concise learning/review state; check in if not already completed. | No module launcher, duplicated “next learning” panel, or multi-card command dashboard. Use tabular numerals for metrics. | Metrics have descriptive labels; charts have text equivalents; check-in state is programmatic. |
| Check-in pending/success/failure | Pending blocks duplicate input; success settles in place; failure offers retry. | No confetti, medal, shame, or streak pressure. | Success/error is a live update; color/icon is supplemental. |
| Statistics empty/offline | Explain what is unavailable and preserve any last truthful summary if clearly labeled. | No fake zero that could be mistaken for real progress. | Retry and return-to-Learning remain reachable but only one is visually primary. |
| Mine default | Account identity, membership, privacy, and preferences are the information spine. | Do not repeat the Statistics dashboard or learning progress hero. | Sections/headings provide predictable navigation; account state is not color-only. |
| Membership / purchase recovery | Show entitlement truth and the appropriate purchase/restore action. | No urgency marketing, false scarcity, or ambiguous web/app authority. | Price/terms/readability and restore action meet target/focus requirements. |
| Sign-out / account action error | Consequence is clear; confirmation only where needed; failure preserves signed-in truth. | No raw backend/API copy. | Destructive action is named; focus returns to a stable heading after completion/cancel. |

## Device-Class Composition Matrix

| Target | Phase A — exact design proof | Phase B — native implementation proof | Explicitly invalid |
| --- | --- | --- | --- |
| iOS phone 320 / 360 / 393 / 430 pt widths | Focused card, lower action zone, reachable four-item navigation, and explicit safe-area/text/input composition hypothesis. Long states may scroll without losing action findability. | Real iOS build/device verifies safe area, status/home chrome, keyboard/IME, native focus, and the same task outcomes at representative widths. | Clipped pill/CTA, status-bar overlap, fixed-height card truncation, or the primary action above the thumb zone with a blank lower screen. |
| Android phone 320 / 360 / 393 / 430 dp widths | Same product capability/state coverage as iOS with a distinct Android composition and explicit back, keyboard/inset, status/navigation-bar, focus, and TalkBack hypotheses. | Real Android build/device verifies hardware/system back, IME/insets, system bars, native focus, TalkBack, and task parity. | iOS screenshot merely relabeled Android, obscured controls behind system navigation/IME, or mismatched hardware-back behavior. |
| Tablet portrait 744 x 1133 reference | Dedicated content width and hierarchy; secondary pane/context appears only when it reduces navigation cost. Useful workspace ≥70%. | Real native tablet build/device verifies portrait safe area, type reflow, input/focus, rotation recovery, and action reachability. | Fixed sidebar plus centered phone column, huge empty lower half, or phone-sized CTA floating far from its task. |
| Tablet landscape 1133 x 744 reference | Deliberate two-dimensional composition for Learning/Space where useful; task, analysis, and context share the viewport without becoming a dashboard. | Real native tablet build/device verifies landscape containment, line measure, focus/input, rotation recovery, and action-to-object distance. | Portrait composition stretched horizontally, excessive line length, or disconnected inspector/action areas. |

## Accessible Type And Assistive Technology Matrix

| Mode | Phase A — exact design proof | Phase B — native implementation proof | P0 failure |
| --- | --- | --- | --- |
| Default type | All target widths; no horizontal layout overflow or covered action/navigation. | Native default type on required devices preserves the accepted hierarchy and reachability. | Any clipped core content or control. |
| 130% and 160% type | Reflow preserves task → action → feedback order; controls grow or wrap. | Native dynamic/font scaling preserves the accepted order and programmatic relationships. | Hard line limit removes meaning; control label clips; result overlays task. |
| 200% / maximum supported accessibility type | One-column fallback is allowed. Primary task, primary action, recovery, and navigation remain comprehensible; secondary metadata may move below. | Maximum native accessibility type remains operable on real required devices. | Unreachable CTA, overlapping layers, horizontal page scroll, or content order that no longer makes sense. |
| VoiceOver | Exact proof documents and exposes roles/names/states, focus order/recovery, live result/error/pending updates, and labeled alternatives for every required path. This is a semantic design review, not a VoiceOver pass. | Real VoiceOver completes auth/wrong-number recovery, all five interactions, hint/audio when present, Space inspect → Learning, check-in, and account/membership on an iOS build/device. | Missing roles/names/states; focus trap; unannounced result/error; gesture-only task. |
| TalkBack | Exact proof documents the same semantic path plus intended Android back/IME and focus behavior. This is not a TalkBack pass. | Real TalkBack completes the same functional path on an Android build/device and preserves focus through back/IME, feedback, and navigation. | Capability parity gap or screen-reader focus loss after feedback/navigation. |
| Reduce Motion | Every transition has a causally equivalent crossfade/immediate/restrained state; no looping decorative motion is necessary. | Native OS reduce-motion setting activates the accepted fallback without losing meaning or focus. | Meaning exists only in flip/slide/drag animation or motion cannot be disabled. |
| High contrast / color differentiation | Measured text/non-text pairings pass and text/icon/state cues remain understandable without library or feedback hue. | Native compositing and platform states preserve the accepted contrast and non-color meaning. | Color-only identity, correctness, selection, or disabled state. |

## Review Trace Per State

For each Phase A rendered/operable state, the review record must capture:

1. candidate id and stable proof anchor;
2. target platform/composition, viewport, appearance, type scale, input mode,
   and intended assistive-technology mode;
3. current focal object and primary action;
4. contrast result for every small-text/accent pairing used in that state;
5. target size, containment, and safe-area result;
6. expected versus observed proof-level focus order, semantic state, and live
   announcement behavior;
7. recovery action and whether committed state was preserved;
8. Learning ↔ Space implication where applicable;
9. pass/fail against the P0/P1 ids in `acceptance-rubric.md`.

The Phase B implementation record must separately capture the exact accepted
design revision, build/commit, OS/device/orientation, native type and input mode,
VoiceOver/TalkBack state, observed focus/announcement behavior, safe-area/IME/
back result, async/retry scenario, persistence/restoration result, independent
reviewer, and pass/fail against the implementation P0s. A Phase A trace cannot
be relabeled as this native record.
