# Mobile UX Architecture v5 — Grayscale UX State Contract

## Status and purpose

- Status: `architecture_gate_input_only`.
- Audience: design, product, engineering, accessibility, and independent reviewers. This file is never learner-facing content.
- Scope: one shared semantic state ledger for iOS phone, Android phone, iPadOS tablet, Android tablet, and PC Web parity review.
- Purpose: freeze what the learner must be able to understand, do, commit, and recover from before any visual-system candidate is named.
- Non-authority: this contract does not select a palette, typography, radius, surface material, navigation appearance, component geometry, candidate lineage, or motion style.
- Stop boundary: this contract does not accept a rendered design, change `spec/visual-language.json`, authorize an implementation mapping, authorize React Native work, or establish leadership readiness.

The final goal remains an explicitly accepted, mature CET4/6 consumer experience that is usable on real iOS, Android, tablet, and Web release targets. Passing this document only permits creation and review of grayscale learner proofs; it is not a proxy for that goal.

## Referenced authority

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/next-synthesis-plan.md`

When concepts overlap, `spec/authority-map.json` decides ownership. The v4 synthesis plan contributes only the corrected stop boundaries and evidence requirements; none of its rejected candidates contributes visual structure.

## Truth boundary

### `product_truth`

- Learning is a system-sequenced, single-current-card CET4/6 flow. It is not a module catalogue, dashboard, or general English-learning system.
- Top-level order is always `学习 / 空间 / 统计 / 我的`; each device class may compose those destinations differently.
- Authentication is required before Learning and uses successive phone-number then SMS-code steps. A successful login alone does not consume Trial.
- The five core interaction families are Flip, Four-choice, Lock, Elimination, and Swipe. Hint is an attached layer and audio is an attached content medium; neither is a sixth core family.
- Flip alone uses the two learner judgements `有把握` and `再回看`. Auto-scored families never reuse those judgements. The authority-defined semantic-role mapping remains binding, but this grayscale phase does not visually encode any color role.
- Every Learning state names one current card, one primary task, one strongest action, bounded secondary actions, feedback, recovery, and Space continuity.
- Space preserves `library → group → box → card`; favorite is a tag, and sleep/wake is a reversible physical-space state that changes Learning eligibility without deleting learning state.
- Trial is a 3–7 day complete experience; Free retains normal basic Learning and close to half the cards but not the complete library, complete algorithm, or complete Space; Premium exposes the complete experience.
- The formal Trial begins on the first successful authenticated Learning entry; successful login alone does not consume it.
- Purchase exists on iOS, Android, and Web with shared canonical entitlement, and membership recovery must remain available after the experience ends. A membership interruption preserves the originating Learning card or Space position.
- A closed-beta Premium grant/revoke is receiver-operator controlled and auditable. The client only reads canonical access and never exposes a self-grant or self-revoke control.
- Audio is explicitly initiated, card-owned, non-autoplaying, and has ready, preparing, playing, paused, and recoverable error states.
- PC Web remains a required release target with its separately accepted Focused Workbench authority. Mobile architecture proves semantic parity, not visual or structural copying.
- Statistics includes one lightweight explicit daily check-in action. It is not a streak, reward loop, learning counter, or substitute for accepted learning-event-derived activity.
- No learner surface exposes server, repository, pipeline, receipt, test, review, design-candidate, operator, queue, predicate, identifier, or implementation language.

### `implementation_hypothesis`

The following remain hypotheses until separately mapped, built, and verified:

- exact native components, navigation containers, breakpoints, insets, focus APIs, animation primitives, persistence adapters, and network orchestration;
- the currently proposed Learning-session runtime checks for context validation, selection generation, cursor persistence, and entitlement reconciliation before it reports a successful first Learning entry;
- the exact `daily-check-in.v2` request, offline command, acknowledgement, duplicate handling, recovery, and canonical reconciliation lifecycle; the repository-local client/backend contract is implemented but not deployed and does not establish service truth;
- the concrete purchase-recovery and restore lifecycle, including store/account mismatch handling, until its owner accepts the mapped behavior on each target;
- exact placement, dimensions, density, visual hierarchy, typography, iconography, material, and motion values;
- exact native audio delivery/cache adapters and store SDK presentation;
- exact learner copy beyond the plain-language intent/recovery constraints in this ledger;
- how tablet context expands or collapses while preserving the same state and return target;
- how accepted PC Web semantics map to its existing rail/workbench/context composition.

No hypothesis in this file may be treated as a shipped capability. Repository wiring, browser simulation, or a grayscale proof does not establish deployed service, native-device, private-audio, store, or launch readiness.

## Authority shorthand

Every ledger row names at least one of these anchors. Shorthand reduces repetition; it does not weaken the cited owner.

| Code | Authority |
| --- | --- |
| `A-SHELL` | `spec/account-sync-contract.json#authentication`, `#canonical_read`; `spec/runtime-boundaries.json#local_persistence.auth_session_store` |
| `A-NAV` | `spec/product-core.json#surface_navigation`; `spec/platform-contract.json#navigation_contract` |
| `A-LEARN` | `spec/product-core.json#learning_experience`; `docs/design/single-card-ux-contract.md` |
| `A-INTERACT` | `spec/interactions.json#interactions`; `docs/design/interaction-motion/learning-core-interactions-v1.md` |
| `A-ACTION` | `spec/action-surface.json#card_surface_contract` |
| `A-AUDIO` | `spec/interactions.json#audio_resource_contract`; accepted audio decision and motion artifacts |
| `A-SPACE` | `spec/product-core.json#physical_space`; `spec/space-operations.json`; accepted Space artifacts |
| `A-STATS` | `spec/product-core.json#surface_navigation`, `#learning_experience.user_costs_to_avoid`; accepted PC Web Statistics decision; corrected v4 architecture plan |
| `A-CHECKIN` | `spec/product-core.json#v1_scope.must_have`; `spec/account-sync-contract.json#daily_check_in_v2` (implementation hypothesis, repository-local and not deployed) |
| `A-MINE` | `spec/platform-contract.json#authentication_policy`; `spec/runtime-boundaries.json#local_persistence`; corrected v4 architecture plan. Help/privacy/deletion lifecycle details remain hypotheses until their product owner accepts them |
| `A-MEMBER` | `spec/membership.json`; `spec/account-sync-contract.json#trial_and_purchase`; formal Learning-session runtime |
| `A-BETA` | `spec/membership.json#policy.closed_beta_entitlement`; beta-entitlement runtime contract |
| `A-PLATFORM` | `spec/platform-contract.json#device_classes`, `#v1_parity`, `#interaction_fidelity_policy` |
| `A-WEB` | `docs/design/decisions/pc-web-core-surface-decision-v1.md` |
| `A-VISUAL` | `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker`; `docs/design/design-quarantine.md#learner-and-reviewer-boundary` for rejected-artifact non-inheritance and learner/reviewer exposure separation |

## Ledger field rules

Each state row is normative and supplies:

- **Authority**: the product or runtime owner that makes the state necessary.
- **Origin**: the exact route, object, or prior state that must be preserved.
- **Return target**: where completion, cancellation, Back, or successful recovery lands.
- **Learner intent**: what a learner must understand in plain product language.
- **Action**: what the learner may do now; background predicates are not actions.
- **Commit truth**: the boundary after which the UI may truthfully present a durable outcome.
- **Failure / recovery**: what remains preserved and the narrow safe way forward.

“Same object” means the same learner-recognizable card, box, account, or access interruption—not merely the same top-level route. “Canonical acknowledgement” is reviewer terminology only and must be translated to learner consequences such as `已保存`, `稍后重试`, or `继续学习` in a learner artifact.

## State ledger

### Shell, session, and top-level continuity

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SHELL-01 Cold launch` | `A-SHELL`, `A-NAV` | App icon, deep link, or browser entry | Auth step or preserved signed-in destination | Understand that the product is opening, without seeing a false signed-in shell | Wait; no duplicate navigation action | No product state is claimed before credential and baseline validation | Keep one stable launch surface; timeout offers retry, not fabricated progress |
| `SHELL-02 Restored session validating` | `A-SHELL` | Stored credential from a prior session | Preserved route and object after validation | Understand that the account is being restored | Wait or cancel to Auth if offered | Signed-in content appears only after session scope and canonical baseline are valid | Invalid credentials clear account-bound state and return to Auth; no stale learner object is shown as current |
| `SHELL-03 Signed-in shell ready` | `A-SHELL`, `A-NAV` | Successful Auth or valid restore | Last safe route, otherwise Learning | Know which of the four top-level destinations is active | Choose `学习 / 空间 / 统计 / 我的` | Navigation selection changes route only; it does not fabricate data commits | Route-load failure preserves navigation and offers retry on that route |
| `SHELL-04 Validated offline session` | `A-SHELL` | Connectivity loss after a valid canonical baseline | Same route and preserved safe object | Know that saved content may be used with limits | Continue only explicitly available offline actions or retry connection | Only a previously validated cached selection may be answered once; no second card is selected locally | Keep the safe object; explain that connection is needed for unavailable actions |
| `SHELL-05 No valid offline baseline` | `A-SHELL` | Cold/restored launch without validated account state | Same entry after retry, or Auth when session is invalid | Understand that Learning cannot safely open yet | Retry connection; use Auth only when session actually ended | No progress, membership, or current-card claim is committed | Do not import device-local state as canonical; retain retryable entry |
| `SHELL-06 Session expired or rejected` | `A-SHELL` | Any signed-in route | Auth, with a safe post-login return intent where allowed | Understand that sign-in is required again, not that learning data was deleted | Continue to Auth | Signed-out state is committed only after account-bound persistence is invalidated as contracted | Preserve non-sensitive route intent; never show raw status codes or authorization terminology |
| `SHELL-07 Foreground entitlement refresh` | `A-SHELL`, `A-MEMBER` | Returning from background, store, or another device | Same route and same learner object | Understand only if access changed or an action must wait | Continue when unchanged; review access when changed; retry on failure | Access claim changes only after canonical entitlement refresh | Keep the originating task; offline/refresh failure is not rendered as account rejection |
| `SHELL-08 Route return restoration` | `A-NAV`, `A-PLATFORM` | Modal, sheet, system store, Auth recovery, or deep child route | Exact originating route, object, scroll/selection, and meaningful focus | Resume the task rather than restart the app | Continue the preserved task or choose another top-level route | No learning/space commit is inferred from navigation alone | If exact child state cannot be restored, return to its owning route with a learner-safe explanation |

### Authentication

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AUTH-01 Phone entry` | `A-SHELL`, `A-PLATFORM` | Cold launch, sign-out, or expired session | SMS-code entry after successful send | Enter the phone number used for the account | Enter number; continue | No account or Trial state is committed | Invalid local format keeps the entered number and explains how to correct it |
| `AUTH-02 Phone invalid` | `A-SHELL` | `AUTH-01` | Corrected `AUTH-01` | See what needs correction without blame | Edit number; continue again | No request is committed | Focus returns to the number field; no raw validation rule is exposed |
| `AUTH-03 Code sending` | `A-SHELL` | Valid `AUTH-01` submission | `AUTH-04` | Know that a code is being requested | Wait; duplicate continue is disabled | Transition only after the send request succeeds | Timeout/offline preserves the number and offers retry |
| `AUTH-04 Code entry` | `A-SHELL` | Successful `AUTH-03` | Signed-in validation, or `AUTH-01` via edit phone | Enter the received SMS code for the displayed phone | Enter code; verify; edit phone; platform Back | Login is not committed until verification and required account restoration succeed | Keyboard/Back never loses the phone number; expired or invalid code stays recoverable |
| `AUTH-05 Verify pending` | `A-SHELL` | Complete code submission | `SHELL-02` then preserved destination | Know that sign-in is being checked | Wait; no duplicate verify | Authentication is committed only on valid server response; Trial is still not consumed | Timeout/offline preserves phone and code context, allowing retry or edit phone |
| `AUTH-06 Code invalid` | `A-SHELL` | Failed `AUTH-05` | Corrected `AUTH-04` | Understand that the code was not accepted | Correct/re-enter code; request a new code when allowed | No signed-in state is committed | Clear only the invalid code input; preserve phone and resend timing |
| `AUTH-07 Code expired` | `A-SHELL` | Expired `AUTH-04` or `AUTH-05` | New-code request then `AUTH-04` | Understand that a fresh code is needed | Request new code when available; edit phone | No signed-in state is committed | Preserve phone; do not present expiry as account failure |
| `AUTH-08 Resend countdown` | `A-SHELL` | `AUTH-04` after a send | `AUTH-04` with resend available | Know when another code can be requested | Continue entering current code; edit phone | Countdown is not an entitlement or authentication commit | Background/foreground restores an honest remaining state rather than restarting urgency |
| `AUTH-09 Resend available` | `A-SHELL` | `AUTH-08` countdown complete | `AUTH-12` after one resend activation | Request a fresh code once | Resend once | Merely becoming available or tapping does not establish a new send | Preserve phone/code context; a new countdown begins only after send success |
| `AUTH-10 Auth offline` | `A-SHELL` | Any send/verify request without connectivity | Same Auth step | Understand that connection is needed to continue sign-in | Retry; edit phone; platform Back where valid | No account, Trial, or access state changes | Preserve safe input; never offer guest Learning |
| `AUTH-11 Auth success and continuation` | `A-SHELL`, `A-MEMBER` | Successful verification | Preserved safe deep-link intent, otherwise Learning | Continue into the account | Continue automatically or explicitly once ready | Signed-in shell requires validated account state; successful login alone does not start Trial | Bootstrap failure remains a signed-in recovery state and must not expose runtime predicates |
| `AUTH-12 Resend pending` | `A-SHELL` | One activation from `AUTH-09` | `AUTH-04` with a new countdown after send success | Know that a fresh code is being requested | Wait; duplicate resend is disabled | A new send is committed only after success | Failure preserves code-entry context and returns to a single retry action |

### Learning common session and completion states

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LEARN-01 Session loading` | `A-LEARN`, `A-SHELL` | Learning route entry or prior completion | One current card, a truthful empty/future state, or recovery | Understand that the next CET task is being prepared | Wait; leave route if needed | A current card appears only from a valid session selection bound to matching content | Failure preserves Learning route and offers retry without predicate narration |
| `LEARN-02 Current card ready` | `A-LEARN` | Valid new or resumed session selection | Interaction-specific state for the same card | Understand the current exam task and strongest operation | Perform the interaction; use bounded attached tools | Merely viewing a card commits nothing | Missing content blocks interaction and offers retry; never substitute a local card |
| `LEARN-03 Resumed current card` | `A-LEARN`, `A-SHELL` | Restored app/session with valid current selection | Same interaction state and card | Recognize the same unfinished task | Continue or safely leave | Resume is truthful only when selection, card, phase, and content identity match | Mismatch triggers narrow session refresh; no exact cross-device resume claim is invented |
| `LEARN-04 Cached offline card` | `A-LEARN`, `A-SHELL` | Connectivity loss after validated card load | Same card, one allowed completion, then connection recovery | Know the current task is available offline with a bounded next step | Answer this card once | Completion may be durably queued only for that validated selection; no second card appears | After answer, block continuation until acknowledgement and fresh reconciliation; preserve result and retry path |
| `LEARN-05 Content/session mismatch` | `A-LEARN`, `A-SHELL` | Session load, restore, or post-ack refresh | Fresh validated current card | Understand that Learning needs refreshing, not why internal identities differ | Retry refresh; leave route | No card answer or progress is accepted against mismatched content | Keep account and route; never display versions, hashes, source IDs, or selection IDs |
| `LEARN-06 No task available now` | `A-LEARN` | Valid session response with no selection | Learning route with next useful time/action, or another route | Understand that there is no current card, without a fake completion celebration | Return later; inspect Space or Statistics only as secondary choices | Empty/future state is shown only after a valid session response | Refresh error stays distinct from a valid empty state |
| `LEARN-07 Interaction active` | `A-LEARN`, `A-INTERACT` | `LEARN-02` | Same card result or cancellable ready state | Understand the single operation in progress | Use the family-specific controls | Intermediate manipulation is not a learning completion | Cancellation restores a coherent ready/partial state defined by that family |
| `LEARN-08 Commit pending` | `A-LEARN`, `A-INTERACT` | A complete family-specific answer | Same card resolved state after durable acceptance | Know that the answer registered locally and completion is being saved | Wait; no duplicate completion | Result may be calculated locally, but progress/next-card truth waits for durable event acknowledgement and reconciliation | Preserve chosen answer and local result; retry the same immutable completion only |
| `LEARN-09 Commit accepted` | `A-LEARN` | Successful `LEARN-08` acknowledgement and refresh | Same card attached result, then one next action | Understand result, key explanation, and what to do next | Continue to next card; use attached secondary actions | Completion is committed only after acknowledgement, post-ack canonical mapping, and fresh session read | If refresh fails after acknowledgement, never resubmit as a new answer; preserve accepted result and retry refresh |
| `LEARN-10 Duplicate completion` | `A-LEARN`, `A-SHELL` | Retry of the exact pending event | Same resolved card and continuation | See one completion, not a duplicate warning | Continue after canonical recovery | Exact duplicate reuses the original accepted outcome and never increments progress again | Hide idempotency terminology; if payload differs, fail closed and retain recovery |
| `LEARN-11 Completion failed / retry` | `A-LEARN` | Failed `LEARN-08` before durable acceptance | Same card, same chosen answer, retry | Understand that the answer is preserved but not yet saved | Retry; leave only if preservation is honest | No durable progress or next-card claim | Do not discard the current selection, select a replacement, or expose queue state |
| `LEARN-12 Restored after interruption` | `A-LEARN`, `A-SHELL` | App background, process restart, store return, or route detour | Exact safe phase of the same card when valid | Resume studying, interacting, result review, or retry | Continue from restored phase | Restore does not create a new completion | Unsafe partial gestures reset to the same card's ready state; committed outcomes remain committed |
| `LEARN-13 Explanation expanded` | `A-LEARN` | Accepted auto-score result or revealed Flip answer | Same result and continuation | Understand what was tested, the key point, and the likely trap | Review/scroll; continue when ready | Reviewing the explanation changes no score or Space state | Long content reflows and remains scrollable; continuation is never covered |
| `LEARN-14 Trial-trigger eligible session entry` | `A-MEMBER`, `A-LEARN` | First authenticated Learning entry before Trial is active | Valid current Learning state with canonical Trial access | Begin Learning with the access actually granted | Start/continue the current task | Trial is shown active only after all formal server-side Learning-session conditions succeed and canonical entitlement reports it | If any predicate fails, do not consume or claim Trial; show only plain retry/access consequence |

### Flip family

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `FLIP-01 Front ready` | `A-INTERACT`, `A-LEARN` | `LEARN-02` with Flip | `FLIP-02` | Recall or inspect the knowledge point before revealing | Reveal; use attached tools | No score or completion | Failed attached tool never blocks reveal |
| `FLIP-02 Reveal transition` | `A-INTERACT` | Reveal action | `FLIP-03` | Understand that the same card is revealing its answer | Wait or complete interruptible reveal | Reveal itself is not a completion | Interrupted/reduced-motion presentation lands on the same revealed answer without looping |
| `FLIP-03 Answer revealed` | `A-INTERACT`, `A-LEARN` | Completed reveal | One of two self-assess choices | Compare recall with the answer and analysis | Choose exactly `有把握` or `再回看` | No learning completion until one judgement is submitted | Back/route interruption restores the revealed face without inventing a judgement |
| `FLIP-04 Judgement pending` | `A-INTERACT`, `A-LEARN` | Either exact Flip judgement | `LEARN-09` | Know which judgement was selected and that it is being saved | Wait; no duplicate choice | Commit uses exactly the selected judgement; no four-level mastery is inferred | Retry preserves the chosen label and same selection |
| `FLIP-05 Confident resolved` | `A-INTERACT`, `A-LEARN` | Accepted `有把握` | Next card via `LEARN-09` | See the answer outcome and continue | Continue; inspect explanation or Space relation | Only accepted event establishes the judgement | Refresh failure preserves accepted outcome; no second judgement request |
| `FLIP-06 Review resolved` | `A-INTERACT`, `A-LEARN` | Accepted `再回看` | Next card via `LEARN-09` | See that the card will be revisited and continue | Continue; inspect explanation or Space relation | Only accepted event establishes review intent | Never use error/destructive language for `再回看`; refresh is separately recoverable |

### Four-choice family

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CHOICE-01 Options ready` | `A-INTERACT`, `A-LEARN` | `LEARN-02` with Four-choice | `CHOICE-02` | Review the CET prompt and compare four answer choices | Select one option; use attached tools | Selection alone is not completion | Reflow preserves labels, logical order, and one selectable set |
| `CHOICE-02 Option selected` | `A-INTERACT` | One option chosen | `CHOICE-03` or another selection | Verify the intended choice before submitting | Change selection; submit once | No correctness is revealed before submit | Focus/route interruption preserves a truthful selection or resets without committing |
| `CHOICE-03 Submit pending` | `A-INTERACT`, `A-LEARN` | Submit selected option | `CHOICE-04` or `CHOICE-05` | Know that the selected answer registered | Wait; no duplicate submit | Correct/incorrect may be computed for feedback, while durable progress follows `LEARN-08/09` | Retry retains the exact option and card |
| `CHOICE-04 Correct resolved` | `A-INTERACT`, `A-LEARN` | Accepted correct answer | `LEARN-09` | Understand why the answer is correct | Read attached analysis; continue | Accepted auto-score, never Flip self-assess | Refresh failure preserves result and continuation retry |
| `CHOICE-05 Incorrect resolved` | `A-INTERACT`, `A-LEARN` | Accepted incorrect answer | `LEARN-09` | See both the selected and correct option, then understand the trap | Read analysis; continue | Accepted auto-score, never a destructive or account state | Selected and correct meaning must survive grayscale and assistive technology |
| `CHOICE-A11Y-01 Large-text proposed reflow` | `A-INTERACT`, `A-PLATFORM` | `CHOICE-01/02` at large accessibility text or unusually long approved options | Same choice state and logical order | Compare the same four choices without clipping or horizontal scrolling | Select/change/submit exactly as above | Reflow itself commits nothing | The default four-choice silhouette may change from 2 × 2 to one column only as a separately rendered, tested, and explicitly accepted accessibility exception; until then it is a proposal, not silent implementation authority |

### Lock family

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LOCK-01 Pattern ready` | `A-INTERACT`, `A-LEARN` | `LEARN-02` with Lock | `LOCK-02` | Understand the relation to complete across all slots | Adjust one slot at a time; use attached tools | No completion while pattern is incomplete | Long text remains associated with its slot; no hidden horizontal operation |
| `LOCK-02 Partial pattern` | `A-INTERACT` | One or more slot adjustments | `LOCK-01`, `LOCK-02`, or `LOCK-03` | See which values are currently chosen | Continue adjusting; reset if offered | Individual adjustments are local, reversible state only | Interruption restores a coherent partial pattern or resets visibly; it never claims success |
| `LOCK-03 Full pattern pending` | `A-INTERACT`, `A-LEARN` | All slots resolved to a submitted pattern | `LOCK-04` or `LOCK-05` | Know that the complete pattern is being checked | Wait; no duplicate commit | Only the complete submitted pattern enters the completion boundary | Retry preserves the same complete pattern |
| `LOCK-04 Unlocked resolved` | `A-INTERACT`, `A-LEARN` | Accepted correct full pattern | `LEARN-09` | Understand the solved relation and explanation | Read; continue | Accepted auto-score only after the whole pattern is correct | Refresh failure preserves solved state |
| `LOCK-05 Not yet resolved` | `A-INTERACT`, `A-LEARN` | Submitted pattern not complete/correct under the approved interaction contract | Same card correction or attached result, according to content rule | Understand what can be adjusted next without being told internal answer machinery | Adjust or review attached explanation | No false unlock or next-card progress | Preserve readable slot state and a clear correction path |

### Elimination family

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ELIM-01 Sentence ready` | `A-INTERACT`, `A-LEARN` | `LEARN-02` with Elimination | `ELIM-02` | Identify removable interference while keeping the sentence readable | Mark one or more candidates; use attached tools | Marking alone is reversible and uncommitted | Reflow keeps marked text anchored to its original sentence position |
| `ELIM-02 Items marked` | `A-INTERACT` | One or more marks | `ELIM-01`, `ELIM-02`, or `ELIM-03` | Review what will be removed | Toggle marks; submit once | No result before submit | Undo restores exact text; interruption never silently commits |
| `ELIM-03 Submit pending` | `A-INTERACT`, `A-LEARN` | Submitted marked set | `ELIM-04` or `ELIM-05` | Know that the chosen set registered | Wait; no duplicate submit | Completion binds the exact marked set | Retry preserves the marked set and remaining sentence |
| `ELIM-04 Correct resolved` | `A-INTERACT`, `A-LEARN` | Accepted correct marked set | `LEARN-09` | Read the remaining sentence and understand the structural insight | Read; continue | Accepted auto-score | Failure preserves both original and resolved meaning without exposing answer keys |
| `ELIM-05 Incorrect resolved` | `A-INTERACT`, `A-LEARN` | Accepted incorrect marked set | `LEARN-09` | Compare the chosen and intended removals, then understand the trap | Read; continue | Accepted auto-score, not Flip judgement | Non-color text/state semantics identify learner choice and expected result |

### Swipe family

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SWIPE-01 Decision ready` | `A-INTERACT`, `A-LEARN` | `LEARN-02` with Swipe | `SWIPE-02` or labelled alternative | Understand the two labelled meanings | Drag in a direction or use equivalent labelled controls | No completion | Alternatives remain available for motor, keyboard, and reduced-motion use |
| `SWIPE-02 Below-threshold drag` | `A-INTERACT` | Pointer/touch movement | `SWIPE-01` | See that the object follows but has not committed | Release to cancel or continue | Below-threshold motion never commits | Cancel returns the same object to ready state with no result |
| `SWIPE-03 Above-threshold pending` | `A-INTERACT`, `A-LEARN` | Direction passes commit threshold or labelled alternative is chosen | `SWIPE-04/05` | Know which labelled decision was made | Release/submit once; wait | Only one explicit direction value enters completion | Interruption before durable submit restores a truthful chosen/pending state |
| `SWIPE-04 Correct resolved` | `A-INTERACT`, `A-LEARN` | Accepted correct direction | `LEARN-09` | Understand the result and reasoning | Read; continue | Accepted auto-score | Refresh failure preserves the resolved direction |
| `SWIPE-05 Incorrect resolved` | `A-INTERACT`, `A-LEARN` | Accepted incorrect direction | `LEARN-09` | Compare chosen and correct meaning | Read; continue | Accepted auto-score | Non-color labels expose both meanings; no destructive metaphor |
| `SWIPE-06 Labelled non-gesture alternative` | `A-INTERACT`, `A-PLATFORM`, `A-WEB` | Learner chooses not to drag or uses a pointer constraint | Same pending/resolved state | Make the same two-way decision without drag travel | Use two labelled actions | Same semantic value and commit boundary as gesture | No hover-only dependency or hidden direction meaning |
| `SWIPE-07 Reduced-motion behavior` | `A-INTERACT`, `A-PLATFORM` | OS/browser reduced-motion preference | Same ready/pending/resolved state | Use the same decision without travel animation | Drag with instant settle or use labelled actions | Motion preference changes presentation only, never the chosen value or commit boundary | No feature loss, animated prerequisite, or auto-commit |
| `SWIPE-08 Keyboard or switch equivalent` | `A-INTERACT`, `A-PLATFORM`, `A-WEB` | Keyboard, switch, or assistive operation of the current top card | Same pending/resolved state | Reach and submit either labelled meaning without precision motion | Use reachable labelled actions or contracted directional keys | Same explicit direction value enters the same completion boundary once | Focus remains on the current card/control; no forced literal touch emulation |

### Attached tools and card management

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `TOOL-01 Peek available` | `A-ACTION`, `A-LEARN` | Eligible unresolved current card | Same interaction state | Get a lightweight look without leaving the task | Peek; dismiss/return | Peek usage records only if separately contracted; it never completes the card | Failure closes back to the same card without blocking the primary action |
| `TOOL-02 Peek open` | `A-ACTION` | `TOOL-01` | Exact prior card phase | Understand the bounded revealed support | Read; close; return | No score, membership, or Space commit | Back/focus returns to the invoking control and current card |
| `TOOL-03 Hint available / hidden` | `A-ACTION`, `A-INTERACT` | Card declares attached hint | Same family state with hint revealed | Decide whether brief support is useful | Reveal hint | Hint is never a standalone card or completion | Missing hint does not show a disabled mystery control |
| `TOOL-04 Hint revealed` | `A-ACTION`, `A-INTERACT` | `TOOL-03` | Exact prior family state | Use the hint while keeping the task visible | Read; resume task | Usage may be part of the completion payload only when the eventual card event commits | Failure never replaces the task or exposes hint metadata |
| `TOOL-05 Favorite toggle pending` | `A-ACTION`, `A-SPACE` | Current card or selected Space card | Same card with canonical tag state | Add or remove a lightweight favorite tag | Toggle once; wait | Favorite changes only after the ordered action is durably acknowledged/reconciled | Preserve local intent; retry the same action; do not create a favorite container |
| `TOOL-06 Favorite resolved` | `A-ACTION`, `A-SPACE` | Accepted favorite action | Same current/selected card | See one truthful tag state | Continue; toggle again only as a new explicit action | The tag changes only after acknowledgement/reconciliation | If authoritative state differs after reconciliation, explain the current tag consequence and permit a fresh explicit action |
| `TOOL-07 Sleep pending` | `A-ACTION`, `A-SPACE` | Current card or owning box where sleep is meaningful | Same card/box, then refreshed Learning if requested | Understand that sleep will remove the card from Learning without deleting progress | Confirm sleep; wait | Learning eligibility changes only after authoritative acknowledgement and Learning refresh | Preserve origin and intent; retry the same sleep; do not skip to another local selection |
| `TOOL-08 Sleep resolved` | `A-ACTION`, `A-SPACE`, `A-LEARN` | Accepted sleep action | Originating card/box; if current card slept, truthful refreshed Learning state | See that the card is sleeping and how to reverse it | Return to Learning or wake where available | Authoritative sleeping state is the commit truth; learning state is not deleted | Reconciliation failure retains the affected object and retry path |
| `TOOL-09 Favorite exact duplicate` | `A-ACTION`, `A-SPACE` | Retry of the exact same favorite action after an uncertain outcome | Same current/selected card | See one final truthful tag state | Continue; a later toggle must be a new explicit action | Exact duplicate returns the already-authoritative result and causes no second transition | Hide action identity/deduplication mechanics; mismatch fails closed into reconciliation |
| `TOOL-10 Wake pending` | `A-ACTION`, `A-SPACE` | Selected sleeping card in its owning box/zone | Same selected card/box | Understand that the card is being returned to Learning eligibility | Confirm wake; wait | Eligibility does not change until authoritative acknowledgement/reconciliation | Preserve selected sleeping card and reversible intent; retry the same wake |
| `TOOL-11 Wake resolved` | `A-ACTION`, `A-SPACE`, `A-LEARN` | Accepted wake action | Same selected card/box, then future Learning selection when eligible | See that the card can participate in Learning again | Continue in Space or return to Learning | Authoritative awake state is the commit truth; it does not promise that this card is the immediate next selection | Refresh failure retains the object and retry path without locally inserting it into Learning |

### Attached audio

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AUDIO-00 Absent` | `A-AUDIO` | Card has no approved audio resource | Same card task | See no irrelevant media control | Continue the core interaction | Absence commits nothing | Never synthesize speech or show an unavailable placeholder |
| `AUDIO-01 Ready` | `A-AUDIO` | Card with approved attached resource | Same card with playback preparing | Know that optional audio is available for this card | Play explicitly | No playback before user action | If resource becomes unavailable, use recoverable error without exposing URLs/IDs |
| `AUDIO-02 Preparing` | `A-AUDIO` | Explicit play | `AUDIO-03` | Know that audio is opening | Wait; cancel if supported | Playback is not claimed until native player confirms it | Timeout moves to attached error/retry; the card task remains usable where content permits |
| `AUDIO-03 Playing` | `A-AUDIO` | Player confirms playback | `AUDIO-04`, completion, or interruption state | Listen while staying on the same card | Pause; continue card interaction when compatible | Playing state follows actual player state, never a timer-only simulation | System interruption updates truthfully and keeps the current card |
| `AUDIO-04 Paused` | `A-AUDIO` | User pause or resumable interruption | `AUDIO-03` or same card | Resume from a truthful paused state | Resume or leave audio paused | Pause/resume follows actual player state | Lost resource moves to error/retry without losing the Learning object |
| `AUDIO-05 Completed` | `A-AUDIO` | Natural playback end | `AUDIO-01` and same card | Know playback ended; decide whether to replay | Replay explicitly or continue task | Audio completion is not card completion | Card remains operable; no autoplay loop |
| `AUDIO-06 Interrupted` | `A-AUDIO`, `A-PLATFORM` | Call, route change, audio focus loss, background, or output change | Truthful paused/ready state on same card | Understand that playback stopped or paused | Resume explicitly when safe | Interruption never marks audio or card complete | Focus/output recovery must not start playback without a new learner action |
| `AUDIO-07 Error / retry` | `A-AUDIO` | Prepare/playback/cache failure | `AUDIO-02` then same card | Understand that audio could not play right now | Retry; continue card without audio when allowed | No playing claim or card result | Preserve card, transcript-on-back if approved, and learner action; hide asset, hash, manifest, URL, and cache details |

### Space hierarchy, mutation, and Learning continuity

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SPACE-01 Entry / library` | `A-SPACE`, `A-NAV` | Top-level Space or Learning continuity link | Chosen group, or original Learning card via return | Understand the current library and that cards have physical ownership | Browse a library/group; return to Learning | Browsing commits nothing | Load failure retains Space entry and offers retry; no flat favorite/sleep substitute |
| `SPACE-02 Group selected` | `A-SPACE` | Library or deep link | Chosen box or prior level | See groups as knowledge ownership, not study modules replacing Learning | Enter a box; go back | Selection/scroll is navigation state only | Invalid target falls back to nearest valid owning level with plain explanation |
| `SPACE-03 Box selected` | `A-SPACE` | Group, deep link, or Learning address | Contained cards or prior group | Understand this box's knowledge role and contained cards | Inspect card; browse supported zones | No card position changes from viewing | Empty/error/unavailable are distinct; preserve library/group/box address |
| `SPACE-04 Card selected` | `A-SPACE`, `A-ACTION` | Box contents or Learning continuity | Same box/card or exact Learning origin | See the card's physical address, favorite tag, sleep state, and allowed actions | Inspect; favorite; sleep/wake; return to Learning | Inspection commits nothing | Missing card refreshes the owning box; never expose card IDs or source versions |
| `SPACE-05 Learning-origin deep link` | `A-SPACE`, `A-LEARN` | Current Learning card address | Exact originating Learning card and phase | Locate this current card in its library/group/box | Inspect context; return to Learning | Navigation does not change learning or Space state | If location changed canonically, show current valid address while preserving return to Learning |
| `SPACE-06 External/deep Space link` | `A-SPACE`, `A-SHELL` | Valid signed-in deep link | Resolved card/box, or nearest valid owner | Understand the requested learner object | Continue within hierarchy | No mutation from link resolution | Auth first when needed; invalid/inaccessible target has a learner-safe fallback without raw key |
| `SPACE-07 Favorite mutation pending` | `A-SPACE`, `A-ACTION` | Selected card | Same card and box | Apply/remove the tag without changing ownership | Wait; no duplicate action | Commit only after canonical acknowledgement/reconciliation | Preserve selection, scroll, and intended tag; retry same action |
| `SPACE-08 Sleep mutation pending` | `A-SPACE`, `A-ACTION` | Selected card or sleep zone | Same card/box, then Learning if requested | Move into/out of sleep with visible Learning consequence | Confirm; wait | Commit only after canonical acknowledgement/reconciliation | Preserve origin, reversible intent, and current Learning card until refreshed truth is known |
| `SPACE-09 Exact duplicate mutation` | `A-SPACE`, `A-SHELL` | Retry of exact favorite/sleep action | Same reconciled selected card | See one final physical state | Continue | Duplicate returns the already-canonical result without another transition | Hide action IDs and merge rules; mismatched replay fails closed with retry/reconcile |
| `SPACE-10 Mutation failed / retry` | `A-SPACE` | Failed favorite/sleep action | Same card, same box, same intended action | Know the change is preserved locally but not yet confirmed | Retry or cancel intent if safe | No canonical state claim before acknowledgement | Later ordered mutations stay blocked; do not expose queue terminology |
| `SPACE-11 Mutation reconciled` | `A-SPACE`, `A-SHELL` | Favorite/sleep/wake acknowledgement followed by authoritative refresh | Same hierarchy/selection where still valid | Continue with the current confirmed tag/sleep state | Continue or perform a new explicit action | Authoritative state wins after ordered intent application | When selection no longer exists, return to the owning box and explain the learner consequence |
| `SPACE-12 Sleeping zone` | `A-SPACE`, `A-LEARN` | Owning box | Selected sleeping card or prior box | Understand that sleeping cards are kept here and excluded from Learning until restored | Inspect; wake | Viewing commits nothing; wake follows normal mutation boundary | Empty sleep zone is not the whole Space product and not a substitute top-level container |
| `SPACE-13 Box empty` | `A-SPACE` | Valid box with no accessible cards | Same box or parent group | Understand that this box currently has no available cards | Go back; continue Learning where useful | Valid empty state requires canonical content/entitlement context | Load failure must not masquerade as empty |
| `SPACE-14 Access limited` | `A-SPACE`, `A-MEMBER` | Free learner selects unavailable complete-Space object | Same Space object after access change, or exact limited context after cancel | Understand what is available now and what complete access adds | Review access; restore; return | No access change until canonical entitlement updates | Preserve hierarchy and selected object; never dump learner at Space root after cancel/error |
| `SPACE-15 Tablet hierarchy adaptation` | `A-SPACE`, `A-PLATFORM` | Any Space depth on tablet/split window | Same library/group/box/card selection | Understand the same ownership while context expands or collapses | Browse and inspect with platform-appropriate input | Pane changes commit nothing | Constrained width collapses context without losing selection, scroll, return target, or allowed action |
| `SPACE-16 Process or cross-device restoration` | `A-SPACE`, `A-SHELL` | Validated app restore, retry success, or cross-device refresh | Same hierarchy/selection where still valid | Continue at the closest valid owned object | Continue or choose a new explicit action | Restored authoritative hierarchy and physical state win; exact same-card cross-device resume is not claimed | If selection no longer exists or is inaccessible, return to the owning box with a learner-safe explanation |

### Statistics

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `STATS-01 Loading` | `A-STATS`, `A-NAV` | Top-level Statistics | Dated weekly view, empty, or recovery | Understand that recent study information is loading | Wait; leave route | No values appear as current before a valid read | Keep the route and offer retry without sync bookkeeping |
| `STATS-02 Weekly data` | `A-STATS` | Valid statistics read | Same route/date range | See a dated scale, today marker, concise trend, and useful activity context | Inspect dates; change supported range if contracted | Display only derived accepted activity, never client-supplied counters | Partial/unavailable data is identified in learner terms and not silently zeroed |
| `STATS-03 Empty` | `A-STATS` | Valid read with no accepted activity | Learning | Understand that learning activity will create useful history | Go to Learning | Empty is canonical, not inferred from a failed request | Failure remains `STATS-05`, never a false zero state |
| `STATS-04 Offline saved view` | `A-STATS`, `A-SHELL` | Connectivity loss after valid statistics read | Same dated view or retry | Know that the displayed view may not include the latest activity | Review saved view; retry refresh | No freshness claim beyond the saved snapshot | Never convert stale data into live counters |
| `STATS-05 Error / retry` | `A-STATS` | Failed read | Same Statistics context | Understand that recent activity could not load | Retry; go to Learning | No metric values are fabricated | Preserve date context; hide collection, aggregate, or route failures |
| `STATS-06 Large-text reflow` | `A-STATS`, `A-PLATFORM` | Any valid stats state with large accessibility text | Same state | Review dates, values, scale, and trend without clipping | Read and scroll in logical order | Reflow commits nothing | Values remain paired with dates/labels; no horizontal page scroll or hidden action |
| `STATS-07 Assistive navigation` | `A-STATS`, `A-PLATFORM` | Any valid stats state with assistive technology | Same state | Navigate the dated record and check-in in a meaningful order | Navigate by headings, lists, status, and controls | Assistive navigation commits nothing | State and date meaning do not depend on color, chart position, or visual-only labels |

### Simple daily check-in

This family is intentionally small. It records one explicit affirmative action for the China product day; it does not create a streak, reward, leaderboard, learning snapshot, or learner-supplied progress counter. Its remote/offline mechanics remain an implementation hypothesis until deployed and verified.

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CHECKIN-01 Available today` | `A-CHECKIN`, `A-STATS` | Valid signed-in Statistics read says the active account has not checked in for the current China product day, with no matching retained action | Same dated Statistics context | Mark today as checked in once | Check in | Merely rendering or tapping before durable local command capture does not claim check-in | If the day changes before capture, refresh the current product day rather than using the previous host-local date |
| `CHECKIN-02 Submit pending` | `A-CHECKIN`, `A-SHELL` | One explicit check-in action captured for the current account/day | `CHECKIN-03`, `CHECKIN-06`, or `CHECKIN-07` | Know that today is being marked | Wait; duplicate activation is disabled | Only one account-scoped command containing the exact product day is submitted; learning completion never creates it | Ambiguous failure retains the one command and returns to a retryable state without claiming success |
| `CHECKIN-03 Acknowledged, refresh pending` | `A-CHECKIN` | Strict matching `daily-check-in.v2` acknowledgement | `CHECKIN-04` after canonical refresh | Know that the action was received and the current view is being refreshed | Wait; do not submit again | The queued command may be removed only after the strict matching acknowledgement; the view is not yet called reconciled | Refresh failure preserves the acknowledged consequence and offers a narrow refresh retry, never a second check-in command |
| `CHECKIN-04 Reconciled today` | `A-CHECKIN`, `A-STATS` | The authoritative account refresh confirms check-in for the same account/day | Same dated Statistics context | See that today is checked in | Continue Learning or inspect activity | The authoritative checked-in result for the exact China product day is the displayed truth | Day rollover returns to the new day's available state; activity counts remain independently derived from accepted learning events |
| `CHECKIN-05 Exact duplicate acknowledged` | `A-CHECKIN` | Retry of the same account/day command after an uncertain prior outcome | `CHECKIN-03` then `CHECKIN-04` | Understand that today remains checked in once | Continue after refresh | Exact repeat returns the already-canonical acknowledgement and causes no second transition or count | Do not expose command IDs, deduplication, queue, or storage terminology |
| `CHECKIN-06 Offline queued` | `A-CHECKIN`, `A-SHELL` | Explicit action while offline after a valid account/day baseline | Same Statistics context, then `CHECKIN-02` when connection returns | Know that the action is kept for later confirmation | Continue safe use; retry connection | A credential-free account-scoped command stores only the exact day; this state is not canonical check-in success | Keep one matching intent across restart; do not infer check-in from learning events or device-local counters |
| `CHECKIN-07 Failed, retryable` | `A-CHECKIN` | Failed, cancelled, ambiguous, or stale-session submission/refresh | Same dated Statistics context | Know that today is not yet confirmed | Retry; sign in again only when the session actually ended | No canonical check-in claim; the exact matching command remains until strict acknowledgement | Preserve account/day intent; an account or day mismatch must not replay it into the new context |
| `CHECKIN-08 Matching recovery restored` | `A-CHECKIN`, `A-SHELL` | App restart with a persisted command matching the active account and bootstrap day | `CHECKIN-02`, or `CHECKIN-04` if canonical state already confirms it | Recognize that the earlier action is still being completed | Wait or retry connection | Recovery may continue only for the exact active account/day command | Without the validated account/day baseline, keep Learning blocked as contracted and do not show a false checked-in state |
| `CHECKIN-09 Stale recovery rejected` | `A-CHECKIN`, `A-SHELL` | Restart, account switch, or day rollover with no exact matching persisted command | Authoritative `CHECKIN-01` or `CHECKIN-04` for the active account/day | See only the current day's confirmed state | Check in only when the current authoritative result remains unchecked | Stale local presentation cannot override the current account/day result; derived activity never confirms check-in | Discard stale presentation safely; never transfer an intent across account or product-day boundaries |

### Mine and account

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `MINE-01 Account overview` | `A-MINE`, `A-NAV` | Top-level Mine | Selected account/settings destination | Recognize account identity, access state, and grouped settings | Open membership, sync, help, privacy, sign-out, or deletion | Viewing commits nothing | Missing account data offers refresh; never infer access locally |
| `MINE-02 Membership entry` | `A-MINE`, `A-MEMBER` | Account overview | Formal commerce or closed-beta read-only profile | Understand current access and available legitimate next action | Review plan, purchase/restore, or return according to environment | No entitlement change from opening | Refresh failure preserves last validated label with honest freshness/retry |
| `MINE-03 Sync healthy` | `A-MINE`, `A-SHELL` | Account overview | Same overview | Understand that learning is saved, without technical detail | Usually none; manual retry only when needed | Claim only after relevant canonical acknowledgement | Do not expose queues, sequences, collections, versions, or device credentials |
| `MINE-04 Sync waiting` | `A-MINE`, `A-SHELL` | Pending safe work while connectivity is available | Same overview after acknowledgement or retry | Understand that recent work is still being saved | Wait; retry only when offered | Do not claim remote save before acknowledgement | Membership and authentication remain separate from save progress |
| `MINE-05 Sync error / retry` | `A-MINE`, `A-SHELL` | Recoverable reconciliation failure | Same overview and affected object | Understand what learner action is needed, if any | Retry; revisit affected Learning/Space object | No loss/success claim without evidence | Preserve learner intent and avoid raw error codes |
| `MINE-06 Help` | `A-MINE` | Account overview or contextual help link | Exact origin | Get learner-oriented help | Read; contact supported channel; return | No product-state commit | Failed help content retains origin and safe return |
| `MINE-07 Privacy` | `A-MINE` | Account overview or consent context | Exact origin | Review privacy choices and consequences | Read or use separately contracted controls | Commit only explicit accepted privacy action | Failure does not sign out or alter learning state |
| `MINE-08 Sign-out confirmation` | `A-MINE`, `A-SHELL` | Account overview | Mine on cancel; Auth on confirm success | Understand that this device will require sign-in again | Cancel or confirm | No sign-out on opening/cancel | Confirmation preserves clear consequences without implying account deletion |
| `MINE-09 Sign-out pending` | `A-MINE`, `A-SHELL` | Confirmed sign-out | Auth | Know that this device is signing out | Wait; no duplicate confirm | Signed out only after required credential/account-bound cleanup boundary | Failure keeps a coherent signed-in or safely revoked state; no mixed shell |
| `MINE-10 Sign-out failed` | `A-MINE`, `A-SHELL` | Failed sign-out boundary | Mine or Auth according to actual credential state | Understand whether the account is still usable on this device | Retry or sign in again as appropriate | UI follows actual credential state, not the failed request label | Never expose secure-storage or revocation-marker details |
| `MINE-11 Delete-account confirmation` | `A-MINE` | Account settings | Mine on cancel; deletion pending on explicit reconfirmation | Understand permanent account/data consequence distinct from sign-out | Cancel or perform the separately contracted strong confirmation | No deletion on opening or first accidental tap | Keep destructive action visually/semantically distinct; no ambiguous primary action |
| `MINE-12 Delete-account pending` | `A-MINE` | Strong confirmed deletion | Auth or required final acknowledgement | Know that the request is being processed | Wait; no duplicate request | Completion only after authoritative deletion result | Failure preserves account access when still valid and gives a narrow retry/support path |
| `MINE-13 Delete-account failed` | `A-MINE` | Failed deletion request | Same deletion context or Mine | Know the account was not confirmed deleted | Retry or return | Never claim deletion or clear all state merely on transport failure | Preserve truthful session state; hide backend/job language |
| `MINE-14 Delete-account complete` | `A-MINE`, `A-SHELL` | Authoritative deletion success | Signed-out Auth entry | Understand that the account is no longer available | Return to Auth/help as contracted | Only authoritative success commits deletion | No stale signed-in shell, membership, or Learning object remains |
| `MINE-15 Sync offline` | `A-MINE`, `A-SHELL` | Connectivity loss with valid account context | Same overview after connection/retry | Understand which safe work is retained until connection returns | Continue safe offline use; retry connection | No remote-save claim while offline | Keep account/membership truth distinct from connectivity and preserve affected learner objects |

### Formal membership, contextual paywall, purchase, and restore

These states describe the formal commerce profile. They must not be mixed with the receiver-owned closed-beta profile below.

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `MEM-01 Trial not yet started` | `A-MEMBER` | Auth success, Mine, or pre-session Learning | Learning or Mine | Understand available access without false urgency | Enter Learning or return | Login alone does not start Trial | If Learning-session creation fails, keep Trial unconsumed and show plain retry consequence |
| `MEM-02 Trial active` | `A-MEMBER` | Canonical entitlement after eligible Learning-session entry | Originating Learning/Space/Mine object | Understand that the complete experience is currently available and time-bounded | Continue; review access details | Only canonical entitlement establishes active Trial and dates | Refresh failure does not silently downgrade or invent time remaining |
| `MEM-03 Free` | `A-MEMBER` | New/free account or Trial/Premium end | Available Learning/Space/Mine context | Understand that basic Learning and close to half the cards remain, while complete library, algorithm, and Space require access | Continue available learning; review access; restore | Canonical Free entitlement controls access; it is not a tiny demo | Capability fetch failure is not a Free-stage decision |
| `MEM-04 Premium` | `A-MEMBER` | Purchase, restore, Trial-independent entitlement, or shared cross-device refresh | Exact originating object | Understand that complete content, algorithm, and Space are available | Continue the preserved task; manage access in Mine | Only canonical Premium entitlement unlocks complete experience | Refresh failure preserves origin and does not claim purchase loss |
| `MEM-05 Membership ended reminder` | `A-MEMBER` | First relevant post-membership capability boundary or Mine | Same limited object or Mine | Understand that basic Learning remains and what complete access would restore | Continue Free; review access; restore | Reminder itself changes nothing | No countdown pressure, fake savings, or repeated blocking on every card |
| `PAY-01 Learning limit notice` | `A-MEMBER`, `A-LEARN` | Exact current Learning card/capability outside current access | Same card/phase after cancel; same task after entitlement update | Understand why this specific next action is unavailable and what remains usable | Continue available Learning; review access; restore | No membership change | Preserve selection/card/phase; never restart Learning or reveal runtime predicates |
| `PAY-02 Space limit notice` | `A-MEMBER`, `A-SPACE` | Exact library/group/box/card outside current access | Same Space address after cancel; same object after access update | Understand why this specific Space object is limited | Return to available Space; review access; restore | No membership or Space mutation | Preserve hierarchy, selection, and scroll |
| `PAY-03 Access comparison` | `A-MEMBER` | Mine or contextual limit notice | Exact origin | Compare truthful Trial/Free/Premium capabilities | Purchase, restore, continue current access, or return | Opening comparison commits nothing | Missing product/store data provides retry and preserves origin; no invented plan claims |
| `BUY-01 Purchase initiation` | `A-MEMBER`, `A-PLATFORM` | `PAY-03` | System/store presentation, then exact origin | Start the target's legitimate purchase flow | Choose offered product; continue; cancel | No entitlement change on tap alone | Store unavailable/offline keeps origin and offers retry/restore |
| `BUY-02 Store pending` | `A-MEMBER`, `A-PLATFORM` | Purchase confirmed in target store | Exact origin after canonical entitlement refresh | Know that purchase is being completed | Wait; respond in system store | Store presentation or local receipt alone does not establish product access | Dismissal/cancel/error are distinct; never expose receipt or transaction identifiers |
| `BUY-03 Purchase cancelled` | `A-MEMBER` | Learner/system cancels store | Exact originating card/Space object/Mine | Understand that no access change occurred | Continue current access; retry later | No entitlement commit | Do not render cancellation as payment failure, account rejection, or data loss |
| `BUY-04 Purchase recoverable error` | `A-MEMBER` | Store or validation failure | Exact origin and comparison | Understand that purchase was not confirmed | Retry; restore; continue current access | No Premium claim before canonical entitlement | Preserve origin; use plain consequence, not provider/status/receipt details |
| `BUY-05 Purchase success awaiting entitlement` | `A-MEMBER` | Store reports success | Exact origin after refresh | Understand that access is being updated | Wait; retry access refresh if delayed | Store success is not yet the in-product access commit | Preserve task and do not prompt a second purchase while outcome is unresolved |
| `BUY-06 Purchase and entitlement success` | `A-MEMBER` | Canonical Premium after purchase | Exact originating Learning card, Space object, or Mine | Continue with newly available complete access | Continue task | Canonical entitlement is the sole unlock truth | If origin content changed, return to nearest safe owning context with explanation |
| `BUY-07 Purchase offline` | `A-MEMBER` | Purchase start without required connectivity/store access | Exact origin | Understand that purchase needs connection | Retry when online; restore; continue Free/Trial | No purchase/access commit | Do not block already available Learning or mislabel authentication |
| `RESTORE-01 Restore available` | `A-MEMBER`, `A-PLATFORM` | Mine, access comparison, or contextual limit | Restore pending, then exact origin | Recover an existing purchase for this account | Start restore | Tap commits nothing | Store unavailable/offline preserves origin and current access |
| `RESTORE-02 Restore pending` | `A-MEMBER`, `A-PLATFORM` | `RESTORE-01` | Exact origin after result/refresh | Know that existing access is being checked | Wait; no duplicate restore | No Premium claim until canonical entitlement refresh | Cancellation/error/nothing-to-restore remain distinct and recoverable |
| `RESTORE-03 Nothing to restore` | `A-MEMBER` | Completed restore with no matching purchase | Exact origin and comparison | Understand that no matching purchase was found for the current store/account context | Check account; purchase; return | Entitlement remains unchanged | Do not imply account deletion or reject the learner; offer account-mismatch guidance without identifiers |
| `RESTORE-04 Restore success awaiting entitlement` | `A-MEMBER` | Store finds purchase | Exact origin after canonical refresh | Know that access is being updated | Wait; retry refresh | Store finding alone does not unlock product | Preserve object and suppress duplicate purchase pressure while pending |
| `RESTORE-05 Restore and entitlement success` | `A-MEMBER` | Canonical Premium after restore | Exact originating object | Continue with restored complete access | Continue task | Canonical entitlement establishes Premium across targets | Origin recovery follows `SHELL-08`; no home-route reset |
| `RESTORE-06 Restore error / retry` | `A-MEMBER` | Store/validation/refresh failure | Exact origin | Understand that restore was not confirmed | Retry; verify store account; continue current access | No entitlement change | Hide receipt, provider, endpoint, and transaction details |
| `RESTORE-07 Account mismatch` | `A-MEMBER`, `A-SHELL` | Restore finds a store/account context that cannot grant current canonical account | Exact origin or Auth/account-management path | Understand that the purchase is associated with a different sign-in/store context without exposing identifiers | Review account; sign in appropriately; return | Never transfer or fabricate entitlement client-side | Preserve origin; do not erase current data or call this payment rejection |
| `MEM-06 Cross-device entitlement refresh` | `A-MEMBER`, `A-PLATFORM` | Foreground, sign-in restore, Mine refresh, or capability boundary | Same object with actual canonical access | Receive the same membership stage on iOS, Android, and Web | Continue or retry | Server entitlement wins; exact cross-device card resume is not implied | Access refresh failure is separate from progress sync and retains a safe task |

### Closed-beta read-only access profile

These rows replace formal purchase controls only in a receiver-owned closed-beta environment. They never redefine the formal Trial/Free/Premium product model and remain gate-ineligible for launch claims.

| State | Authority | Origin | Return target | Learner intent | Action | Commit truth | Failure / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `BETA-01 Base access` | `A-BETA`, `A-MEMBER` | Signed-in closed-beta account without active beta grant | Same Learning/Space/Mine context | Understand the access currently available and what remains usable | Continue available product; refresh/sign in as supported | Client reads canonical base membership; it cannot grant Premium | No purchase or self-grant control appears in this profile |
| `BETA-02 Premium access active` | `A-BETA` | Canonical active beta entitlement | Exact originating object | Understand that complete access is available for the beta | Continue complete Learning/Space | Only canonical beta overlay establishes Premium; base membership is not overwritten | Refresh failure preserves last validated access honestly and offers retry |
| `BETA-03 Access refresh pending` | `A-BETA`, `A-SHELL` | App foreground, sign-in, or manual refresh | Same object | Know that access is being checked | Wait; retry | No grant/revoke outcome before canonical read | Keep product state and hide operator/audit/record details |
| `BETA-04 Grant absent or revoked` | `A-BETA` | Authoritative read resolves no active additional beta access | Same object under unchanged base membership rules | Understand the access now available and what remains usable | Continue base access; contact the declared beta support path if needed | Absence and revoke are observer-equivalent in the learner client: both reveal unchanged base membership, while a later non-beta Premium is not downgraded | Never present a client revoke/self-grant control or raw revocation reason |
| `BETA-05 Refresh error` | `A-BETA`, `A-SHELL` | Failed authoritative beta-access refresh while connected | Same object with last safe validated access, or blocked entry if none | Understand that access could not be refreshed | Retry; continue only safe validated capability | No access-stage change | Do not substitute formal purchase, fabricate Premium, or expose receiver environment details |
| `BETA-06 Mine read-only access detail` | `A-BETA`, `A-MINE` | Mine membership entry in closed beta | Mine or exact origin | Understand current beta access and support route | Return; refresh; open learner-safe help | Viewing commits nothing | No payment, plan-selection, grant, revoke, actor, reason, timestamp, or audit-history control/content is learner-visible |
| `BETA-07 Offline with last safe access` | `A-BETA`, `A-SHELL` | Connectivity loss after a previously validated access read | Same safe object, or blocked entry when no validated access exists | Understand that access cannot be refreshed and what remains safely usable | Continue only validated capability; retry connection | Offline state never changes base or additional access | Do not convert stale access into a fresh claim or expose receiver environment details |

## Learner-language and DOM containment contract

The ledger state IDs, authority shorthand, commit predicates, and recovery mechanics belong only in reviewer artifacts. Learner proofs and later product surfaces must obey all of the following:

1. No raw internal key or value may enter learner-visible text, the accessibility tree, hidden text, element title/description, URL query/hash, deep-link label, screenshot, or OCR surface. This includes every opaque identity, version/integrity value, synchronization marker, persistence/transport label, environment/profile value, commerce-provider value, storage reference, privileged-actor value, audit field, or repository path.
2. Learner documents contain only learner-safe display language for library, group, box, and card. Reviewer state IDs and internal object keys live in the physically separate reviewer matrix, never in the learner DOM, even as `data-*`, test selector, comment rendered into markup, or debug panel.
3. Runtime predicates such as context validation, selection generation, cursor persistence, canonical mapping, idempotency, entitlement overlay, signature/hash verification, and ordered replay may determine state transitions but may not appear in learner copy.
4. Failure copy states only: what the learner was trying to do, whether it took effect, what remains safe, and the next useful action. It does not narrate infrastructure.
5. Membership copy distinguishes authentication, connectivity, store cancellation, entitlement refresh, and access-stage consequences. None substitutes for another.
6. Human semantic review is required in addition to keyword scanning. A polished sentence that explains review criteria, servers, operators, product requirements, or internal capability plumbing still fails even if it contains no forbidden token.

## Platform and PC Web semantic parity ledger

Composition and input adapt; learner meaning, commit truth, and recovery do not.

| Capability | iOS / Android phone | iPadOS / Android tablet | Accepted PC Web | Required parity |
| --- | --- | --- | --- | --- |
| Auth | Successive phone then SMS-code full-screen gate | Same steps with adaptive keyboard/window behavior | Same successive gate; no operable signed-in shell behind it | Same validation, resend, offline, session-restoration, and continuation semantics |
| Top-level navigation | Four stable destinations in canonical order with platform-native behavior | Adaptive navigation with the same order and route identity | Accepted route rail in the same order | Route meaning and state ownership are identical; presentation is not copied |
| Learning | One current task and one strongest action | One bounded task plus context only when useful | One center workbench focal card with attached context rail | Same selected card, five families, result, continuation, recovery, and Space continuity |
| Interaction input | Touch plus labelled accessible alternatives | Touch, keyboard/pointer where available | Keyboard/mouse equivalents; no hover-only task | Same operation meaning and commit value; literal gesture need not be forced |
| Space | Progressive hierarchy with low operation cost | More simultaneous hierarchy when useful; collapse preserves selection | Accepted tree, box, and inspector composition | Same library/group/box/card ownership, favorite tag, sleep/wake consequence, and return origin |
| Statistics | Quiet dated weekly state | Same semantic ledger with adaptive presentation | Quiet daily/weekly ledger | Same accepted activity truth, dates, scale, empty/error distinction, and no dashboard primacy |
| Mine/account | Grouped account actions | Same actions adapted to window/input | One account object and grouped actions | Same identity, membership, sync consequence, privacy, sign-out, and deletion lifecycle |
| Membership | Contextual limit or Mine entry; system store where applicable | Same with origin preservation | Contextual limit or Mine entry; Web purchase authority equal | Same Trial/Free/Premium facts, canonical access, purchase/restore outcomes, and exact return target |
| Closed beta | Read-only canonical access profile | Same | Same only when the PC Web target is in the receiver-owned profile | No client self-grant/revoke and no substitution for formal commerce evidence |
| Audio | Card-attached native control | Same card ownership and native interruption truth | Accepted attached resource control | Same explicit start and ready/preparing/playing/paused/error lifecycle; implementation differs |

The mobile grayscale proofs do not redraw or supersede the PC Web Focused Workbench. Reviewers must instead map every shared state ID to the accepted PC Web artifact and record any absent capability/state as a parity gap. Mobile evidence alone cannot claim release-target completeness.

## Mandatory cross-state coverage

An exhaustive Cartesian product of every state, device, text size, connectivity condition, membership stage, motion preference, and input method would produce low-value repetition. This contract therefore uses risk-based coverage, but none of the following sets is optional.

### Tier 1 — every ledger state

Every state ID must have:

- at least one learner-only grayscale proof or exact state transcript;
- one reviewer-only mapping to authority, origin, return target, commit truth, and recovery;
- leakage review of visible copy, accessibility name/order/state, URL/deep link, and DOM/source separation;
- an explicit `covered`, `blocked`, or `not_applicable_with_authority` result. Silent omission fails the gate.

### Tier 2 — all four mobile device classes

Each of the following must be proven on iOS phone, Android phone, iPadOS tablet, and Android tablet:

1. Auth phone entry, keyboard-safe code entry, invalid/expired code, resend, offline retry, success continuation, and expired-session return.
2. Learning common loading, current/resumed card, commit pending, resolved result, error/retry, duplicate action, and post-ack refresh recovery.
3. Ready, active/selected, pending, correct/review result, and reduced-motion/accessibility alternative for all five interaction families.
4. Space root through selected card, Learning-origin return, favorite/sleep pending, failure/retry, duplicate/reconciled state, and constrained-window collapse.
5. Formal Free limit from both Learning and Space, purchase pending/cancel/error/success, restore pending/none/error/success/account mismatch, and exact origin return.
6. Audio absent, ready, preparing, playing, paused/interrupted, error/retry, and no-autoplay return.
7. Mine sign-out and deletion confirmation/pending/error truth; Statistics data/empty/error truth.

### Tier 3 — forced cross-state combinations

| Coverage ID | Owner | Required combination | Pass condition |
| --- | --- | --- | --- |
| `COV-01 Session × origin` | `A-SHELL`, `A-NAV` | Cold launch, restored session, deep link, foreground return, and expired session against Auth, Learning, Space, and membership origins | The exact safe origin/return target survives or falls back to its owning route with a learner-safe explanation |
| `COV-02 Connectivity × mutation` | `A-SHELL`, `A-LEARN`, `A-CHECKIN`, `A-SPACE`, `A-MEMBER` | Online, offline-before-action, lost-during-pending, retry, exact duplicate, process recovery, and post-ack refresh failure for Learning completion, daily check-in, favorite, sleep/wake, purchase, and restore | No duplicate commit, false success, cross-account/day replay, local replacement selection, or lost learner object |
| `COV-03 Family × lifecycle` | `A-INTERACT`, `A-LEARN` | Five interaction families across ready, manipulation/selection, submit pending, resolved, interruption, restore, and long content | Each family stays materially distinct while sharing truthful completion/recovery |
| `COV-04 Accessibility text × Four-choice` | `A-INTERACT`, `A-PLATFORM` | Default text, platform large text, and 200% equivalent with normal and unusually long approved options | No clipping/overlap/horizontal page scroll; any 2 × 2 to one-column exception is separately rendered, tested, and explicitly accepted before use |
| `COV-05 Motion/input × family` | `A-INTERACT`, `A-PLATFORM`, `A-WEB` | Default and reduced motion; touch, VoiceOver/TalkBack, switch/keyboard alternatives; PC Web keyboard/mouse | Same labelled meaning, focus recovery, and commit value without gesture-only or hover-only completion |
| `COV-06 Membership × origin` | `A-MEMBER`, `A-LEARN`, `A-SPACE`, `A-MINE` | Trial-not-started, Trial, Free, Premium against Learning, Space, and Mine origins | Access truth is canonical; cancellation/error/success returns to the exact object; runtime predicates never enter copy |
| `COV-07 Store outcome × refresh` | `A-MEMBER`, `A-PLATFORM`, `A-SHELL` | Pending, cancelled, error, offline, store-success-entitlement-pending, canonical success, and app restart | No second-purchase pressure or Premium claim before canonical access; origin is restored after refresh |
| `COV-08 Restore × account` | `A-MEMBER`, `A-SHELL`, `A-PLATFORM` | Current account with purchase, nothing to restore, store/account mismatch, offline, cross-device refresh, and restart | No client entitlement transfer/fabrication; plain recovery and same-origin return |
| `COV-09 Formal commerce × closed beta` | `A-MEMBER`, `A-BETA` | The same Mine/access-limit entry under formal and receiver-owned profiles | Formal targets retain purchase/restore; beta exposes read-only canonical access only; profiles never blend |
| `COV-10 Space depth × adaptation` | `A-SPACE`, `A-PLATFORM`, `A-LEARN` | Library/group/box/card, selected sleeping card, pending mutation, and Learning return across phone, tablet portrait/landscape, split window | Ownership, selection, scroll, allowed action, and return target survive expansion/collapse |
| `COV-11 Audio × card lifecycle` | `A-AUDIO`, `A-LEARN`, `A-PLATFORM` | Audio present/absent, all playback states, system interruption, route return, card commit, and resource failure | Audio remains attached, explicit, truthful, optional where permitted, and never becomes a sixth family/global player |
| `COV-12 Copy × exposure channel` | `A-SHELL`, `A-MEMBER`, `A-PLATFORM`, `A-VISUAL` | Every failure/recovery and membership state across visual text, accessibility tree, DOM, URL/deep link, screenshot/OCR, logs shown in product, and reviewer/learner document boundary | Zero internal key, predicate, review narration, implementation language, or reviewer control in learner evidence |
| `COV-13 PC Web parity` | `A-WEB`, `A-PLATFORM` | Every Tier 1 semantic state mapped to the accepted PC Web authority; high-risk Tier 2 flows exercised with keyboard/mouse and focus | No shared capability/state omission; PC composition remains independent and current evidence is cited |

### Required viewport and system stress

- Phone widths: 320, 360, 390/393, and 430 logical pixels where supported.
- Tablet: representative iPadOS and Android tablet portrait, landscape, split-window, and keyboard/IME-constrained states.
- Text: default, platform large accessibility sizes, and 200% equivalent.
- System UI: status/cutout, home/gesture, keyboard/IME, rotation, interruption, Android System Back and predictive Back, and focus restoration.
- Assistive technology: VoiceOver and TalkBack names, logical order, current/selected/expanded/busy/error states, live-result restraint, and non-color meaning.
- Input: touch, keyboard/pointer where available, and labelled alternatives for gesture families.
- Motion: default and reduced-motion state replacement for every travel, scale, or rotation.

Browser frames may support reflow and semantic checks but cannot be labeled native evidence. Final acceptance still requires real iOS/Android phones and representative real tablets, real store capability, and real attached-audio behavior.

## Grayscale gate and non-inheritance rules

1. Learner proofs use neutral grayscale only. They do not choose or hint at product, library, correctness, error, focus, membership, confident, or review colors.
2. No proof selects a type family, radius family, shadow/material package, ornamental motif, navigation appearance, persistent pane proportion, or branded icon system.
3. No geometry, ordering ratio, decorative device, named fragment, or token is copied from Aurora, editorial, Soft Spine, mvn-01–08, or any combined v4 candidate.
4. Product topology may still be tested: one focal task, the five distinct operation shapes, the Space ownership chain, and the default Four-choice 2 × 2 relationship. Topology is not permission to inherit a rejected candidate's drawing.
5. Reviewer controls and state IDs live in a physically separate reviewer artifact. Learner documents contain no candidate switcher, design rationale, viewport selector, state key, evidence badge, or reviewer navigation.
6. The first-read order must be assessed in grayscale through learner task recognition, not through brand color or decoration.
7. A technical pass, semantic pass, or relative improvement must never be called visual acceptance.

## Architecture gate decision

This state contract passes only when independent review confirms:

- all required domains and state rows are present;
- every row has a truthful authority, origin, return target, learner action, commit boundary, and failure recovery;
- formal commerce and closed-beta profiles are complete and physically/semantically separable;
- all mandatory cross-state combinations have an evidence owner;
- runtime predicates and internal keys cannot enter learner copy or learner DOM;
- the Four-choice large-text exception remains a separately accepted proposal rather than a hidden deviation;
- PC Web semantic parity is explicit without copying its wide-screen composition into mobile;
- no palette, geometry system, candidate lineage, implementation mapping, or React Native authority has been introduced.

Passing permits the next grayscale learner-proof checkpoint only. It does not permit visual-system candidate selection, implementation, promotion, merge into a mobile design canon, or leadership presentation as a finished product.
