# Mobile UX Platform Architecture v5

## Status And Authority Boundary

- Status: `design_only_architecture_contract`.
- Phase: grayscale UX architecture before visual-direction generation.
- Scope: iOS phone, Android phone, iPadOS, Android tablet, plus semantic/capability parity with the separately accepted PC Web direction.
- This document is not a palette, a visual candidate, an implementation map, or an implementation authorization.
- It does not authorize React Native, native, Web, component, token, or production UI changes. A future implementation PR must consume a separately accepted rendered design artifact, an implementation mapping, interaction/motion evidence, platform-native evidence, and declared gaps.
- The grayscale browser proofs attached to this phase may test architecture and reflow. They are not native-app evidence and cannot prove release readiness.

No earlier mobile candidate composition, geometry, component arrangement, token set, or named fragment is an input to this architecture. The layouts below are re-derived from the product and platform requirements. Existing accepted interaction and physical-space artifacts constrain behavior and meaning only. The accepted PC Web decision is used only for the parity ledger; its workbench composition is not a mobile or tablet template.

## Current Task References

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`

## Product Truth

The following is shared across all release targets and must survive every platform adaptation:

1. Softbook is a low-burden CET4/6 preparation product, not a generic English course catalogue or a word-only tool.
2. Authentication is required before Learning. The primary method is phone plus SMS code; guest Learning is not supported.
3. The top-level route order is always `Learning -> Space -> Statistics -> Mine`.
4. Learning is the most important entry and remains a system-sequenced, single-current-card flow. It must not become module selection, a dashboard, or several equally weighted tasks.
5. Space is a top-level physical hierarchy of `library -> group -> box -> card`. It must not collapse into a flat card list or favorite/sleep shortcuts.
6. Flip, multiple choice, lock, elimination, and swipe remain distinct operation silhouettes. Hint is an attached layer, not a card family. Audio is an explicitly started resource, not a card family and never auto-plays.
7. Flip alone uses the two light self-assessment choices `有把握` and `再回看`. Auto-scored interactions do not ask for the same self-assessment.
8. Favorite remains a tag. Sleep remains a physical state under the owning container and removes a card from Learning until wake. Users cannot arbitrarily rewrite knowledge ownership.
9. Learning state, physical-space state, and membership entitlement continue across iOS, Android, and Web. Daily-level progress continuity is required; exact same-card cross-device resume is not.
10. Trial and premium provide the complete experience. Free-after-trial retains basic Learning and approximately half of the canonical card release while complete Space, library, and algorithm remain limited.
11. Formal product commerce must support purchase on iOS, Android, and Web with equal authority and shared entitlement. Purchase recovery is prompted after a membership experience ends.
12. Closed beta is a distinct runtime profile: payment is not connected, clients cannot grant beta access, and only canonical entitlement is presented.
13. Phone, tablet, and PC Web each require dedicated page composition. One stretched or merely responsive UI for every device class is forbidden.

## Implementation Hypothesis For This Architecture Phase

The following choices make the product truth testable before visual styling. They may be refined by later visual candidates, but a candidate may not remove their behavioral guarantees.

### One Navigation Model, Several Platform Compositions

`Learning`, `Space`, `Statistics`, and `Mine` are stable destinations rather than steps in one linear stack.

- Selecting a top-level destination is idempotent: it never answers a card, clears an interaction, changes a Space position, or dismisses an unresolved purchase result.
- Each destination retains its own local navigation context while the user visits another destination.
- A route-local detail, inspector, membership interruption, or purchase surface sits above the originating destination. Dismiss or Back returns to that origin.
- Authentication is a gate outside the authenticated route set. The authenticated shell must not appear operable behind it.
- System-level Back and interactive dismissal never become implicit Learning actions.
- A tab or route change stops attached audio before another card becomes current. Returning never auto-resumes playback.

### Focal Object Rule

Every screen has one first-read object and one primary next action:

| Surface | Focal object | Primary next action | Bounded context |
| --- | --- | --- | --- |
| Auth | Current phone/code step | Continue or verify | Delivery/retry help |
| Learning | One current CET card | Perform its interaction or continue after resolution | Hint, peek, favorite, audio, compact Space address |
| Space | Current box or inspected card inside its hierarchy | Inspect, sleep/wake, or return to Learning | Parent/sibling context |
| Statistics | Current daily learning record | Check in or inspect the quiet record when available | Small supporting trend, never a dashboard center |
| Mine | One account and membership object | Account or entitlement action | Purchase, restore, sign-out |
| Membership interruption | The limited object from Learning or Space | Purchase/restore in formal commerce, or return/support in beta | Reason for limitation plus origin |

Context may become simultaneously visible on a wide tablet only when it belongs to the focal object and there is enough usable width. Empty permanent side regions, equal task grids, and context shown merely because the screen is wide are forbidden.

## Shared Window And Reflow Contract

Layout decisions use the current usable window, not the hardware marketing name. Rotation, split-window, Stage Manager, freeform windowing, display zoom, and text scaling can move the same device between compact and expanded compositions.

### Compact Composition

Used by phones and narrow tablet windows:

- one focal object or route-local detail at a time;
- canonical top-level destinations remain directly reachable;
- Space uses progressive disclosure while preserving a visible human-readable parent path;
- supporting content follows the focal object in the semantic sequence rather than becoming an off-screen rail;
- every primary action is reachable without horizontal scrolling.

### Expanded Tablet Composition

Used only when available width, text size, and orientation permit:

- one focal work area plus at most one attached context area;
- Learning may pair the current card with its address, attached support, or answer context, but may not show a second current card or a module grid;
- Space may pair hierarchy navigation with the current box/card area because both express one physical location;
- Statistics and Mine remain single-object supporting surfaces and do not expand into dashboards merely to fill width;
- the attached context area disappears or moves after the focal object when it cannot retain a useful minimum measure.

This is not the PC Web three-region workbench. Tablet composition is touch-first, window-variable, and limited to context that directly belongs to the current object.

### Reflow Rules

- Text wraps and surfaces grow vertically; body copy is never clipped or reduced below the accessible baseline to preserve a decorative frame.
- At large accessibility text sizes, a two-dimensional choice layout becomes a single semantic column. For multiple choice, the standard `2 x 2` arrangement is an exception at large text and must reflow to four full-width choices in semantic order.
- Lock rows, elimination candidates, answer analysis, and Space paths may wrap or stack without losing their operation order.
- The focal task precedes secondary support and navigation in the logical traversal order even when context is visually adjacent.
- Fixed-height card bodies are forbidden for any state containing learner-authored, localized, accessibility-scaled, error, membership, or answer-analysis text.
- Scroll is allowed for content; horizontal overflow is not. Primary controls and top-level navigation cannot be the clipped end of a scroll region.
- When width collapses, context moves after the focal object or into a reversible detail. It never disappears if it contains the only recovery action or the only explanation of a limitation.

### Portrait, Landscape, And Multi-Window

| Window state | Required behavior |
| --- | --- |
| Phone portrait | Compact, one-focal-object composition; the primary Learning operation is visible before low-priority support where content length permits. |
| Phone landscape | Remains usable without forcing portrait. Vertical chrome compresses; content may use a bounded two-region content arrangement only when the current interaction remains one object. The on-screen keyboard must not leave an unusable sliver. |
| Tablet portrait | Expanded composition is conditional, not automatic. Long text or accessibility sizes may intentionally use compact composition. |
| Tablet landscape | May reveal one attached context area. It must not introduce more primary actions, additional current cards, or dashboard density. |
| iPad Split View / Stage Manager | Recompute from the live window. Narrow windows use compact navigation and single-column flow; wide windows restore attached context without losing focus or interaction state. |
| Android multi-window / freeform | Recompute from the live window and current insets. Compact windows use the phone-like single-object flow; expansion never assumes full-screen tablet width. |

No rotation or resize may submit an answer, restart Learning, discard the active Auth step, close the current box, or change membership state.

## Shared Safe-Area, Keyboard, And Input Contract

### Insets And System UI

- Decorative background may extend behind system regions; learner text, touch targets, focus outlines, temporary messages, primary actions, and route controls remain inside the effective safe/inset region.
- The top inset accounts for cutouts, status regions, and transient system bars. The bottom inset accounts for home indicators, gesture navigation, and three-button navigation.
- Bottom navigation and bottom-anchored actions consume the system inset rather than adding a second arbitrary gap or overlapping it.
- A modal, sheet, or popover has its own inset and keyboard behavior. Its close/Back action remains reachable at every supported window size.
- Transient system-bar changes, call/status indicators, or a hardware cutout may not shift controls outside the reachable content region.

### IME And SMS Authentication

- Phone and verification-code fields remain visible while focused. The keyboard may reduce the viewport, so the step must scroll or resize instead of relying on an absolutely positioned action.
- The Continue/Verify action remains reachable above the IME or by scrolling, and the focused field is never covered by a bottom navigation element.
- Keyboard dismissal preserves entered content and validation state.
- System one-time-code assistance, full-code paste, hardware keyboard entry, and input correction must all work without changing the authentication sequence.
- A retry or timeout state attaches to the current Auth step. It must not clear a valid phone number or expose provider/runtime language.
- Successful login alone does not start Trial. Trial starts on the first successful authenticated Learning entry. Context validation, selection generation, cursor persistence, and entitlement reconciliation are the current runtime proposal for establishing that success, not additional learner-facing product rules.

### Touch, Pointer, And Hardware Keyboard

- Every core action has a direct activation target; no task depends on hover, a hidden edge gesture, drag precision, or timing alone.
- Touch targets meet the platform-native minimum: at least 44 points on Apple platforms and at least 48 density-independent pixels on Android, with adequate separation.
- External keyboard focus is visible and follows semantic order. Enter/Space activates the focused control where platform conventions allow; Escape or the platform dismissal command closes a transient layer before navigating away.
- Pointer support may add hover feedback but cannot reveal the only available action.
- Swipe and hint gestures have discoverable, accessibility-operable alternatives that preserve the same meaning.

## Assistive Technology And Focus Contract

### Shared Semantics

- Every screen exposes one route/title landmark, the focal object, its required operation, result or error state, bounded support, and top-level navigation in a stable semantic order.
- Decorative material, stacking, dividers, and background regions are hidden from the accessibility tree.
- Human-readable library, group, box, and card labels are announced. Internal identifiers, source names, queue/cache terms, runtime states, file paths, test labels, and design metadata are never learner-facing.
- Controls expose role, accessible name, state, and value. Color, placement, strike-through, motion, or shape is never the sole carrier of correct/incorrect, selected, favorite, sleeping, playing, limited, or disabled state.
- Dynamic result announcements are concise and do not steal focus repeatedly. After a resolved interaction, focus moves to the result heading or primary continuation according to platform convention.
- After closing Auth help, Space detail, a hint, a membership interruption, or purchase/restore, focus returns to the invoking control or the preserved focal object.
- Route switching places focus at the new route heading/focal object, not at an arbitrary first DOM/native node.
- Reduced motion preserves operation meaning with discrete state changes. Audio never resumes after an interruption without explicit learner action.

### Interaction-Specific AT Requirements

| Interaction | Required non-visual and focus behavior |
| --- | --- |
| Flip | One control reveals the back. The revealed state and analysis are announced, then exactly `有把握` and `再回看` become reachable. |
| Multiple choice | Four choices expose position, selection, correctness after submission, and explanation association. At large text they remain in the same semantic order after column reflow. |
| Lock | Rows expose current value, available adjustment, locked/unlocked state, and sequence. Completion is announced once. |
| Elimination | Each candidate exposes retained/eliminated state and Undo before submission. Strike-through is supplementary, not the only signal. |
| Swipe | Directional controls provide the same two-state choice as drag. Cancelled movement announces no result and returns focus to the current card. |
| Hint | The trigger exposes expanded/collapsed state and controls an attached help region. Closing it returns focus to the trigger. |
| Audio | Ready, preparing, playing, paused, retry, and unavailable states are named. The control remains attached to its card and receives no automatic activation. |
| Space | Hierarchy level, owning container, selected card, favorite, sleep/wake, and return target are announced without exposing raw box/card keys. |

## iOS Phone Architecture

### Composition

- An authenticated four-destination tab structure uses the canonical order. Labels remain visible and are not replaced by icon-only navigation.
- Learning opens on the active system-selected card, not a home dashboard. The card operation owns the main content region; support and Space address remain attached and secondary.
- Space uses a path-and-detail progression suitable for one-column width: human-readable library/group/box context remains visible while the current box or card becomes the focal object.
- Statistics and Mine each use a scrollable single-object page. Membership interruption and purchase/restore are presented above the exact originating object rather than as unrelated navigation roots.

### Navigation And Back

- Each tab keeps its own route-local history. Switching tabs preserves the current card operation, Space inspection, Statistics position, and Mine state.
- Re-selecting the active tab is non-destructive. It may return focus toward that route's root context, but it never clears a card result, resets Space, or changes entitlement.
- The standard navigation Back action and iOS edge-swipe pop only route-local details. A cancelled interactive pop leaves focus and product state unchanged.
- A modal or sheet dismisses before any route change. Dismissal returns to its origin and restores focus.
- There is no Back action that changes the top-level tab by pretending tabs are pages in one stack.

### Safe Area And Keyboard

- Content and route controls respect the status/cutout area and home-indicator inset in portrait and landscape.
- An iPhone keyboard, dictation panel, predictive bar, or one-time-code suggestion cannot cover the active Auth field or the only Verify action.
- When the keyboard is present in landscape, Auth becomes a scrollable compact step rather than shrinking text or controls below minimum sizes.

### iOS Accessibility And System Behavior

- Dynamic Type is supported through accessibility sizes; context collapses before text is truncated.
- VoiceOver focus follows the focal-object contract, and custom gestures have named controls.
- Bold Text, Button Shapes, Increase Contrast, Reduce Transparency, and Reduce Motion must not remove state comprehension.
- Returning from background preserves the current product object when canonical state remains valid; audio stays paused.

## Android Phone Architecture

### Composition

- An authenticated four-destination bottom navigation structure uses the canonical order with visible labels.
- Learning, Space, Statistics, and Mine preserve the same product roles as iOS while following Android system-bar, sheet, dialog, and navigation behavior.
- Learning remains one current card. Space uses one-column hierarchy progression with the parent address retained. A wide phone or landscape window may place attached context beside the focal object only when both remain comfortably operable.

### System Back And Predictive Back

Back follows this priority:

1. close the active keyboard, transient menu, hint layer, dialog, or sheet when platform convention assigns Back to it;
2. cancel an in-progress reversible gesture without recording an answer;
3. pop the current route-local detail and return focus to its origin;
4. return to the previous top-level destination retained in the current app task history;
5. from the root with no prior in-app destination, allow the operating system to background/exit the task.

- Back never submits, self-assesses, sleeps/wakes, favorites, purchases, restores, or signs out.
- Predictive Back shows the true destination: the preserved origin object, prior destination, or system task transition. Cancelling the preview leaves the current interaction and focus unchanged.
- A purchase provider or external account handoff returns through its result path to the preserved origin; System Back must not strand the learner in an empty shell.

### Insets And IME

- Edge-to-edge drawing accounts for status bars, display cutouts, gesture navigation, and three-button navigation through current insets.
- IME resize/inset changes keep the current Auth field, validation, and action reachable. The bottom navigation does not sit between the field and IME.
- Landscape and multi-window recompute from actual insets; no hard-coded full-screen height determines action placement.

### Android Accessibility And System Behavior

- Android font scaling and display size changes trigger reflow, not clipping. At the maximum supported test scale, choices, lock rows, paths, and route labels remain understandable.
- TalkBack exposes ordered collection semantics and interaction state. Directional alternatives replace gesture-only requirements.
- Switch Access, keyboard traversal, high contrast text, remove animations, and touch-and-hold timing do not block a core task.
- Process recreation or return from background restores only validated state. Audio remains paused and no answer is inferred from lifecycle change.

## iPadOS Architecture

### Conditional Tablet Composition

- At regular usable width, the canonical top-level destinations occupy a persistent primary navigation region suited to iPadOS. At compact Split View width, navigation collapses to a phone-like tab composition without changing route order.
- Learning keeps one current card as the dominant object. A second region is permitted only for current-card address, attached support, or resolved explanation; it never becomes a module browser or another current card.
- Space may simultaneously show the human-readable hierarchy and current box/card detail because the two regions represent one physical location. A selected card remains visibly owned by its box.
- Statistics and Mine do not gain extra dashboards or management panels merely because more width exists.

### Window, Orientation, And Modal Behavior

- Portrait, landscape, Split View, Slide Over where supported, Stage Manager, and external-display windows are all derived from the live usable size.
- A narrow resize collapses attached context into route-local detail. A later expansion may restore adjacency without duplicating the context or losing focus.
- Popovers are used only for bounded transient choices. A task, long explanation, Auth step, Space inspection, or purchase recovery remains a navigable surface or adaptive sheet rather than an undersized popover.
- A floating or split software keyboard may overlap arbitrary screen regions; focused fields and actions scroll into the unobscured region.

### iPad Input And Accessibility

- Touch remains fully sufficient. Pointer and keyboard add equivalent activation, visible focus, and platform-standard dismissal without becoming required.
- Dynamic Type can force the compact single-column composition even in a wide window. Width is not used to preserve columns at the cost of readable text.
- VoiceOver traversal and focus order follows focal object -> operation/result -> support -> route navigation, independent of whether context is visually beside the card.

## Android Tablet Architecture

### Conditional Tablet Composition

- At expanded usable width, canonical top-level destinations occupy a persistent Android tablet navigation region with visible labels. At compact multi-window width, the structure becomes the Android phone bottom navigation without changing order or meaning.
- Learning uses one focal current card plus at most one attached context region. Space may use hierarchy-plus-current-box detail. Statistics and Mine remain quiet supporting surfaces.
- Expanded layout is conditional on usable width after system bars, hinge/occlusion where applicable, font/display scale, and current content needs. Device model alone never forces multiple panes.

### Window, Back, And IME Behavior

- Portrait, landscape, split-screen, freeform, and external-display windows re-evaluate pane and navigation modes without recreating product state.
- Predictive Back applies to detail panes, sheets, purchase flows, and top-level destination history exactly as on Android phone. Its preview must match the destination that will receive focus.
- Closing a detail pane with Back preserves its selection in the hierarchy where appropriate and focuses the invoking row/object.
- The IME may resize or pan a freeform window; Auth content scrolls within the unobscured bounds and the current action remains reachable.

### Android Tablet Input And Accessibility

- Touch, TalkBack, Switch Access, pointer, and hardware keyboard all reach every core action.
- Semantic traversal remains one logical sequence even when hierarchy and detail are adjacent.
- At large font/display scales, the navigation region and detail context collapse before labels, choices, or recovery actions are clipped.

## Origin-Return Continuity

Origin is an architectural state, not learner-facing metadata. It records only enough in-app context to return the user to a meaningful object; no raw internal identifier or runtime term is displayed.

| Transition | Origin that must be preserved | Return behavior |
| --- | --- | --- |
| Unauthenticated entry -> Auth | Intended top-level destination and meaningful learner-safe context | After successful authentication, return to the intended destination if canonical state permits. Login alone does not start Trial. |
| Learning -> Space | Current card and its human-readable library/group/box address | Open the owning hierarchy. Return to the same current card when still valid, otherwise the next canonical eligible card without a module detour. |
| Space -> Learning | Current box/card inspection and prior Learning context | Continue the system-sequenced flow; never reinterpret the selected box as a user-chosen Learning module. |
| Learning/Space -> membership interruption | Limited object, invoking control, current route | Dismiss returns unchanged. Successful entitlement refresh returns to the object if still valid and re-evaluates the allowed action. |
| Mine -> purchase/restore | Mine membership object | Return to Mine with canonical result and a path back to the previously active route. |
| Any route -> Auth after authorization rejection | Last safe top-level destination only; no untrusted operable state | After re-authentication and canonical refresh, return when valid; otherwise explain the narrow recovery and keep Learning blocked. |
| Audio/resource recovery | Owning card and interaction state | Retry or dismiss in place; never reset the card or advance Learning. |
| Remote or sync recovery | Last validated focal object | Preserve human product context, reconcile canonically, and avoid exposing queue/cache/runtime machinery. |

Origin continuity is local UX continuity, not a claim of exact same-card cross-device resume. Across devices, inheriting daily progress, physical-space state, and shared entitlement is required; the service may select the next canonical eligible card.

## Formal Commerce And Closed-Beta Profiles

These profiles must be designed and tested separately. One must never masquerade as the other.

| Concern | Formal commerce profile | Closed-beta profile |
| --- | --- | --- |
| Purchase | Available on iOS, Android, and Web with equal product authority; platform-compliant purchase entry is reachable from an attached limitation or Mine. | Payment is not connected. No fake purchase, disabled checkout, client self-grant, or preview of an unusable store flow. |
| Restore/recovery | Restore and entitlement refresh are reachable, especially after a membership experience ends. Result returns to the preserved origin. | Client reads/refreshes canonical entitlement only. Missing access provides a learner-safe support/return path, not an operator control. |
| Entitlement | Shared across iOS, Android, and Web after canonical refresh. | Canonical beta premium may be visible as access state; grant/revoke and audit are outside all learner clients. Base membership remains conceptually distinct. |
| Trial | Complete experience for 3-7 days. The first successful authenticated Learning entry starts an available Trial; login alone does not. | Do not invent a separate client-side Trial trigger. The current runtime proposal validates context, selection, cursor, and entitlement before reporting entry success; those checks remain implementation hypotheses. Canonical membership is displayed, and the client does not infer beta access or change base membership. |
| Free-after-trial | Basic Learning and close to half the canonical card release remain usable; complete Space/library/algorithm limitations attach to the affected object. | If the canonical base state is free and no beta grant is active, show the same product limitation semantics without offering unavailable payment. |
| Learner language | Product value, current access, purchase, restore, and recovery only. | Product access and learner support only. Never expose receiver, operator, grant command, audit record, environment, or deployment language. |

The grayscale state matrix must include both profiles. A closed-beta proof cannot satisfy the formal-commerce purchase requirement; a formal-commerce proof cannot claim the beta client is safe.

## PC Web Parity Ledger

The accepted PC Web direction remains `pcw-01 Focused Workbench`. Mobile and tablet do not copy its left route rail, center workbench, or right context rail. Parity means the same core capability and user meaning, with platform-appropriate composition and input.

| Capability/semantic | Accepted PC Web commitment | iOS/Android phone response | iPadOS/Android tablet response | Evidence required before final cross-target acceptance |
| --- | --- | --- | --- | --- |
| Top-level IA | Left rail in `Learning -> Space -> Statistics -> Mine` order | Labeled bottom destinations in the same order | Persistent labeled route region when wide; labeled bottom destinations when compact | Exact-state route audit on all targets; no reordered or hidden Space entry |
| Learning | One card in the center workbench, system sequenced | One focal current card; support attached and secondary | One focal current card; at most one meaningful attached context region | All five interaction silhouettes, hint attachment, result, recovery, and continuation on each class |
| Flip assessment | Exactly `有把握` / `再回看` | Same two states after reveal only | Same two states after reveal only | Keyboard/AT/touch activation and no leakage into auto-scored interactions |
| Other interactions | Mouse/keyboard equivalents preserve meaning | Touch-first plus direct/AT alternatives | Touch plus pointer/keyboard/AT alternatives | No gesture-only completion; large-text reflow preserves order and state |
| Audio | Explicit attached resource with recoverable states | Attached control; no auto-play; lifecycle pauses | Same, with multi-window and external-input behavior | Native interruption, background, retry, and focus proof; browser proof is insufficient |
| Space | Tree -> current box -> selected-object inspector | One-column hierarchy progression with persistent parent address | Conditional hierarchy + current-box adjacency | Library/group/box/card containment, favorite tag, sleep/wake, Learning return on all classes |
| Statistics | Quiet daily ledger, not dashboard center | Quiet single-object daily record | Same; no extra dashboard density | Check-in and empty/loading/error states; numeral comprehension and large-text proof |
| Mine | One account/membership object | One account/membership object | One account/membership object | Auth identity, entitlement, formal purchase/restore or beta-safe branch |
| Membership limitation | Attaches to the current limited object | Attaches to Learning/Space origin or Mine object | Same, context may be adjacent only when useful | Origin retained through dismiss, purchase/restore, canonical refresh, and error |
| Auth | Calm phone-SMS gate; no operable shell behind | Platform phone/code sequence with IME-safe action | Adaptive phone/code sequence with floating/split keyboard safety | Real autofill/paste/keyboard/AT tests; login alone does not start Trial |
| Input | Mouse and keyboard; no hover-only completion | Touch and AT; optional hardware keyboard | Touch, pointer, keyboard, and AT | Semantic equivalence, visible focus, no precision/timing-only task |
| Cross-target continuity | Shared progress, Space, and entitlement semantics | Daily progress/Space/entitlement reconcile canonically | Same | Same account checks across iOS, Android, and Web; exact card resume not claimed |

PC Web remains a separate accepted artifact and needs its own current evidence at final leadership review. Passing mobile/tablet proofs does not certify Web, and passing Web does not certify native platforms.

## Evidence Boundary: Browser-Only Versus Native-Pending

Evidence classification is explicit:

- `browser_only`: a claim demonstrated in the grayscale HTML/browser harness but not on an operating-system-native surface;
- `native_pending`: a platform behavior that cannot be promoted from browser simulation and still requires the native check below.

An item remains `native_pending` even when its browser approximation passes. Browser success may establish the intended architecture, never the native result.

### What Grayscale Browser Proofs May Establish

- the required surfaces and state branches exist;
- top-level route order and route-local origin/return logic are represented;
- focal object, primary action, secondary support, and recovery are distinguishable without palette;
- representative phone/tablet portrait, landscape, and narrow-window viewports reflow without horizontal overflow or clipped controls;
- large-text and 200% browser zoom cause defined stacking, including `2 x 2` multiple choice -> one column;
- DOM traversal/focus order, control names, roles, state, keyboard activation, and no hover-only dependency can be inspected;
- formal-commerce and closed-beta learner surfaces are physically separate states;
- learner-visible copy can be scanned for internal metadata leakage;
- PC Web semantic parity can be reviewed as a ledger against its accepted artifact.

Browser proofs remain architecture evidence only. Simulated device chrome, CSS environment variables, browser viewport resizing, and scripted click sequences are not native evidence.

### Native-Pending Evidence

| Area | Why browser evidence is insufficient | Required native check |
| --- | --- | --- |
| Safe areas/system bars | Browser frames cannot reproduce every cutout, home indicator, gesture bar, three-button bar, transient status region, or inset lifecycle | Real/simulator iOS and Android screenshots plus reachability checks across target devices and orientations |
| IME/one-time-code | Browser keyboard simulation cannot prove OS resize, autofill, suggestion bar, floating/split keyboard, or paste behavior | iOS and Android Auth runs with software/hardware keyboards, one-time-code assistance, correction, dismissal, rotation, and multi-window |
| System/predictive Back | Browser History is not iOS navigation dismissal or Android System/Predictive Back | Android predictive preview/cancel/commit and iOS Back/edge-swipe cancel/commit on every transient/detail/purchase origin |
| Dynamic text/display settings | Browser zoom is not Dynamic Type, Android font scale, Bold Text, display size, or platform truncation | Maximum supported accessibility-size runs with screenshots, semantics, and complete core-task operation |
| VoiceOver/TalkBack | DOM accessibility inspection cannot prove native announcements, rotor/local context, traversal, Switch Access, or focus restoration | Full Auth, one Learning interaction from each family, Space inspect/sleep/wake, purchase/restore branch, and route navigation with native AT |
| Native purchase/restore | Browser buttons cannot prove StoreKit/Google Play result, cancellation, pending state, entitlement refresh, or provider return | Formal-commerce sandbox flows for success, cancel, pending/error, restore, and cross-target entitlement; beta build proves purchase absence |
| Audio | Browser playback cannot prove native session interruption, verified private asset, background pause, output changes, or stale completion suppression | Real-device iOS/Android explicit play, pause, call/interruption, background/return, card change, offline/retry, and AT announcement |
| Window lifecycle/state | Browser resize does not prove process recreation, OS multi-window, Stage Manager, or state restoration | Rotation, split/freeform/Stage Manager, background/foreground, and process recreation without answer or state mutation |
| Touch and pointer ergonomics | CSS hitboxes do not prove device density, reach, system gesture conflicts, stylus/pointer, or long-press timing | Real-device target-size, edge conflict, pointer/keyboard, and one-handed reach checks |

Until native-pending evidence passes, every corresponding claim is `native_pending`. No artifact may rename it as complete, production-ready, or leadership-ready.

## Grayscale Architecture Acceptance Gates

### P0: Must Pass Before Visual Candidate Generation

- All four platform classes have dedicated composition rules and exact state coverage; none is a stretched phone or copied PC Web workbench.
- Canonical navigation order, Learning priority, and top-level Space entry are present in every authenticated composition.
- Every surface has one focal object, one primary next action, bounded support, and a recovery/escape path.
- The five Learning interaction silhouettes remain distinct; hint and audio remain attached; flip alone has the two self-assess choices.
- Space shows at least library/group/box/card containment and preserves favorite, sleep/wake, and Learning continuity.
- Safe-area/inset and IME architecture cannot cover the only action or top-level navigation.
- Android Back/predictive Back and iOS Back/dismissal are explicitly mapped and cannot record a Learning or Space mutation.
- Portrait, landscape, tablet narrow/wide window, and large-text reflow have deterministic composition changes with no horizontal overflow.
- Multiple choice demonstrates standard `2 x 2` and large-text one-column states as one semantic sequence.
- AT order, focus restoration, direct alternatives to gestures, state names, and result announcements are defined for all core interactions.
- Auth hides the operable shell, preserves input through IME/retry, and does not claim login starts Trial.
- Formal commerce and closed beta are separate. Formal shows real purchase/restore architecture; beta exposes no payment or self-grant path.
- Origin and return are preserved through Auth, Space, membership, purchase/restore, recovery, Back, resize, and AT focus changes.
- Learner surfaces contain no internal identifiers, source/runtime terms, test metadata, or receiver/operator language.
- The PC Web parity ledger has no missing core capability and does not claim that mobile evidence certifies Web.

Any P0 failure blocks visual-direction work. It must not be papered over with palette, material, animation, or denser chrome.

### P1: Must Be Resolved Before Promotion To Accepted Visual Authority

- Confirm final route-control placement and collapse behavior through equal candidate exploration rather than this prose alone.
- Validate representative CET content extremes: long Chinese analysis, long English stem/options, six elimination candidates, multi-row lock, missing hint, long Space names, and error/recovery copy.
- Prove thumb/pointer reach, tablet context usefulness, landscape ergonomics, and no accidental gesture conflicts.
- Prove focus visibility and high-contrast/reduced-transparency states once a visual language is applied.
- Reconcile the selected visual candidate with the existing interaction/motion and physical-space artifacts, then declare any required artifact delta before implementation mapping.
- Complete the native-pending evidence matrix and refresh PC Web evidence for the same product/state ledger.

## Explicit Non-Claims

- No palette, hue, material, elevation, typeface, icon family, radius, spacing scale, or branded visual direction is selected here.
- Grayscale is a temporary diagnostic constraint, not the product theme.
- No historical mobile candidate or current application screenshot is visual authority for the next phase.
- No browser-rendered phone or tablet frame is called an iOS or Android native proof.
- No React Native component structure, navigation library, breakpoint constant, purchase SDK, accessibility API, or storage schema is authorized here.
- No local, simulated, or design-only evidence proves deployment, launch readiness, native quality, or final leadership review readiness.
