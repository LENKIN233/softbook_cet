# Mobile Visual Rebuild V3 — Acceptance Rubric

> **AP-23 token binding:** `有把握 = confident/mint (#22C58B)`; `再回看 = review/amber (#F5B100)`. Any rendered flip labels in this record inherit this fixed semantic/color mapping.

## Decision Model

This rubric defines two non-substitutable hard gates. It does not require
production React Native code in order to accept a design, and it does not treat
design acceptance as implementation or release approval.

- **Phase A — design promotion:** an exact code-native design proof demonstrates
  the intended roles, names, states, keyboard/switch alternatives, focus order
  and recovery, live updates, target widths, type scaling, contrast, and
  platform-specific composition hypotheses. Independent design/UX/accessibility
  review, representative-user task testing, and an explicit product-owner
  decision apply to the exact proof revision. A code-native proof may be an
  operable HTML/prototype artifact; it is not production RN or native-platform
  evidence.
- **Phase B — implementation merge/release:** a separate implementation PR
  consumes the already accepted artifact and proves the result in real iOS,
  Android, and tablet builds/devices, including safe areas, IME, back behavior,
  VoiceOver, TalkBack, native focus, async failure/retry, duplicate-action
  prevention, background/foreground handling, and persistence/restoration.

Phase A evidence cannot close Phase B, and Phase B work cannot be started to
manufacture authority for an unaccepted design. Product-owner acceptance closes
only the exact Phase A design decision; it is not release approval. No author
may self-approve, no automated or green gate may substitute for an independent
review or product-owner decision, and no product-owner decision may substitute
for Phase B native evidence.

- `P0`: non-negotiable blocker. A Phase A failure rejects the candidate or leaves
  design promotion unresolved; a Phase B failure blocks implementation merge
  and release. The two results must be recorded separately.
- `P1`: quality threshold. A shortlisted candidate must pass every P1 unless the product owner explicitly records a narrow exception with a follow-up owner and proof plan. Visual preference alone is not an exception.
- `P2`: refinement opportunity. It may remain as a named gap after product-owner acceptance, but it must not hide a P0/P1 failure.

No weighted average can offset a P0 failure. “Looks better” cannot offset broken task clarity, product distortion, accessibility, or platform composition.

## P0 — Product And Authority

| ID | Gate | Pass evidence |
| --- | --- | --- |
| P0-01 | CET specificity | Five-second study with at least 5 representative target users: at least 4 identify the current CET task and next action without facilitator explanation. No participant describes the surface primarily as a generic word-drill/flashcard app. |
| P0-02 | System-sequenced Learning | Learning opens into one current task. Module selection, statistics, and planning never become the primary path. |
| P0-03 | Single-card operability | Every Learning state names current card, primary task, primary action, ≤3 quiet secondary actions, feedback, recovery, and Space continuity. Exactly one primary decision is visible. |
| P0-04 | Five distinct silhouettes | At 12 px Gaussian blur or equivalent squint review, independent reviewers can distinguish flip, multiple-choice, lock, elimination, and swipe by structure, not labels/icons/colors. At least 4 of 5 reviewers identify at least 4 of 5 silhouettes. |
| P0-05 | Interaction semantics | Flip exposes exactly `有把握` / `再回看`; review is not red. Auto-scored interactions never reuse flip self-assessment. Hint remains attached enhancement; audio remains explicit resource and never autoplays. |
| P0-06 | Physical Space truth | Rendered proof visibly expresses library → group → box → card, favorite as tag, and sleep/wake as supported zone. No flat-list or favorite/sleep-bin reduction. |
| P0-07 | Learning ↔ Space continuity | From an inspected supported card/box, a user reaches relevant Learning context in ≤1 explicit action; back/return preserves the inspected context. A Learning result can state address/review implication without exposing algorithm or sync internals. |
| P0-08 | Content boundary | Proof uses existing repository fixture/approved payload only. No new CET candidate content is authored, approved, or represented as formal volume. |
| P0-09 | Quarantine | User-visible proof has zero internal metadata terms, raw exceptions, routes, paths, TODOs, or agent/harness language. |
| P0-10 | Authority | Candidate remains `candidate_exploration` until the named product owner explicitly approves the exact candidate and proof revision. No self-approval, inferred approval, or green-gate substitution. Design-only and implementation changes are in separate PRs. |

## P0 — Layout, Color, And Accessibility

| ID | Gate | Pass evidence |
| --- | --- | --- |
| P0-11 | Viewport containment | Across iOS and Android widths 320/360/393/430, tablet portrait 744 x 1133, and tablet landscape 1133 x 744: zero unintended horizontal overflow, clipped core text, system-chrome collision, covered CTA, or covered navigation. Purposeful pannable Space canvases must be bounded in their own viewport and expose non-spatial navigation. |
| P0-12 | Accessible reflow | At default, 130%, 160%, and 200%/maximum supported type: task, action, result, recovery, and navigation remain reachable and logically ordered. Zero hard-line truncation of question, option, analysis, or error meaning. |
| P0-13 | Contrast | Measured on final composited backgrounds: normal text ≥4.5:1; large text ≥3:1; meaningful non-text UI/focus/selected boundaries ≥3:1. Every brand, library, semantic, disabled, light, and dark pairing used in proof is measured. |
| P0-14 | Targets and spacing | Every interactive hit region is ≥44 x 44 logical pixels. Adjacent destructive/opposite choices have at least 8 pixels separation or another proven accidental-activation safeguard. |
| P0-15 | Accessible semantics and screen-reader operability | **Phase A — design promotion:** the exact code-native proof exposes a documented role, name, state, and disabled/busy/selected value for every control; all gestures have labeled keyboard/switch-equivalent controls; focus order/recovery and result/error/pending live updates are operable and independently reviewed. **Phase B — implementation merge/release:** real VoiceOver and TalkBack passes complete auth recovery, all five interactions, Space inspect → Learning, check-in, and account/membership on native builds. No focus trap, lost announcement, or gesture-only task exists. |
| P0-16 | Non-color/non-motion meaning | Correctness, selection, library position, disabled state, swipe direction, and completion are understandable with color removed and motion reduced. |
| P0-17 | Async and error recovery | **Phase A — design promotion:** the exact proof demonstrates pending, disabled, success, error, retry, and preserved-input/committed-truth states for request, verify, evaluate, commit, favorite, sleep/wake, and check-in; duplicate actions are visibly and programmatically blocked. **Phase B — implementation merge/release:** native/server execution proves those transitions under delay, failure, retry, offline, and duplicate input without app restart or false committed state. |

## P0 — Platform And Flow

| ID | Gate | Pass evidence |
| --- | --- | --- |
| P0-18 | iOS = Android capability | **Phase A — design promotion:** separate exact iOS and Android phone compositions cover 320/360/393/430 widths and explicitly model each platform's system chrome, keyboard/inset, back, focus, and screen-reader hypotheses while preserving the same routes and task outcomes. A relabeled shared screenshot is invalid. **Phase B — implementation merge/release:** real native iOS and Android builds/devices prove those routes and outcomes with observed safe-area, IME, back, focus, and screen-reader behavior. |
| P0-19 | Dedicated tablet composition | **Phase A — design promotion:** exact code-native portrait and landscape compositions behave as tablet workspaces, not phone UI beside a fixed sidebar; useful workspace ≥70%, unexplained blank region ≤20%, and text measure/action-to-object distance remain intentional. **Phase B — implementation merge/release:** real native tablet builds/devices in both orientations prove containment, safe areas, type reflow, input/focus behavior, and reachable actions. |
| P0-20 | Auth correction | After requesting a code, changing an incorrect phone number requires ≤1 explicit action. Expired code, wrong code, request failure, verification failure, and network loss each have an in-place recovery. |
| P0-21 | Answer → analysis → continuation | For auto-scored interactions, answer result and useful analysis are in the same task surface before `下一张` is dominant. For flip, reveal/analysis precedes exactly two self-assessment choices. No equally strong skip-analysis exit exists. |
| P0-22 | State preservation | **Phase A — design promotion:** exact state-transition proof preserves committed Learning results and meaningful inspected Space context across top-level navigation, Space drill-in, error retry, and type reflow. **Phase B — implementation merge/release:** native background/foreground, process recreation, storage, and restoration preserve the same committed truth and context. |

## P1 — Visual And Interaction Quality

| ID | Quality threshold | Pass evidence |
| --- | --- | --- |
| P1-01 | Recognizable brand system | Brand identity, library identity, and semantic feedback are separately documented and visibly distinct. In a no-logo comparison, at least 4 of 5 reviewers select the Softbook direction over generic study/dashboard decoys and explain a product-specific cue. |
| P1-02 | Color authorship | The system has an intentional chromatic identity beyond black/white/grey while maintaining long-form content comfort. Accent substitution is not the only distinction between libraries or states. |
| P1-03 | First-read hierarchy | Squint path is focal task → action/answer field → result/continuity → chrome. In a five-second test, at least 4 of 5 users identify both task and next action. |
| P1-04 | Phone composition | At 393 x 852 reference, current object plus action zone uses 55–70% of usable content height; meaningless blank space ≤12%; primary action is in the lower 35% when content length permits. Long content may scroll rather than violate these constraints. |
| P1-05 | Surface restraint | No more than three simultaneously legible depth levels, no more than two nested light-card layers, and no more than three base radii plus a pill radius in one system. Exceptions require a named semantic reason. |
| P1-06 | Control quality | Primary controls are visually at least 48 px high where practical; labels do not clip at 200% type; selected, pressed, pending, disabled, error, and focus states are visibly and programmatically distinct. |
| P1-07 | Feedback comprehension | In moderated task review, at least 4 of 5 users correctly state whether the answer registered, the outcome, the next action, and the card’s review/Space implication without seeing internal language. |
| P1-08 | Low operation cost | Median observed path: auth wrong-number correction ≤1 action after code request; Space inspected card → Learning ≤1; core answer → next card has no unnecessary intermediate navigation. |
| P1-09 | Stats restraint | Statistics communicates concise daily progress/review and check-in without a multi-panel control dashboard. Mine does not repeat the same progress hero/metrics. |
| P1-10 | Platform-native confidence | **Phase A:** independent reviewers find the iOS, Android, and tablet composition/behavior hypotheses deliberate rather than relabeled or stretched. **Phase B:** platform reviewers observe no foreign system-chrome, back, keyboard, focus, or navigation behavior in native builds; tablet action-to-object distance and line length remain readable in both orientations. |
| P1-11 | Motion causality | Motion explains flip, lock settling, elimination, swipe, or Space movement; no loop competes with study content. Reduced-motion proof preserves the same state comprehension. |
| P1-12 | Candidate distinctness | Eight candidates differ in composition, object model, type hierarchy, material, feedback language, navigation, and tablet adaptation. Reviewer consensus treats palette/radius-only variants as duplicates and removes them from population count. |

## P2 — Refinement Ledger

P2 gaps may include microcopy tuning, animation-curve tuning, rare device polish, illustration/detail refinement, or non-critical transition choreography. Each retained P2 must name:

- affected candidate/state/platform;
- user impact;
- owner;
- intended artifact or implementation PR;
- verification method;
- reason it does not conceal a P0/P1 failure.

“Polish later” without these fields is not a valid ledger entry.

## Required Evidence Matrix

### Phase A — Design Promotion

| Evidence | Minimum requirement | Reviewer independence |
| --- | --- | --- |
| Candidate proof | Stable, exact, code-native candidate proof for iOS phone, Android phone, tablet portrait, and tablet landscape; all critical states in `ux-state-matrix.md` are operable or linked to an exact state proof. Static rasters may support exploration but cannot close this row. | Candidate author may produce it; cannot be sole reviewer. |
| Hard-filter review | Every P0 id marked pass/fail with proof anchor and observed value. | One reviewer who did not author the candidate. |
| Visual pairwise review | All eight candidates covered; comparisons cite both exact proof anchors and name winner/risk/borrowable fragment. | At least one independent visual reviewer. |
| UX task review | Representative target users test first-read task recognition, auth recovery, five interactions, Space ↔ Learning, Statistics, and Mine against the exact proof. Observed success, confusion, recovery, and next-action comprehension are recorded. | At least one independent UX reviewer; candidate author cannot facilitate and sign the verdict alone. |
| Accessibility design review | Programmatic inspection records each control's role/name/state, keyboard/switch-equivalent path, expected and observed proof-level focus order/recovery and live updates, contrast measurements, type reflow, reduce-motion, and color-removal behavior. This is Phase A semantic design evidence, not a VoiceOver/TalkBack native-pass claim. | At least one reviewer not responsible for visual authorship; automated scan alone is insufficient. |
| Platform composition review | Exact iOS phone, Android phone, tablet portrait, and tablet landscape hypotheses are observed at named widths/orientations, with system chrome, safe area, IME/back/focus expectations documented. Relabeled/reused screenshots are invalid. | At least one independent reviewer; production-device ownership is not required for Phase A. |
| Product-owner decision | Exact candidate id, commit/proof revision, accepted scope, rejected alternatives, and unresolved P2s. | Product owner only. Agents and PR gates cannot fabricate this record. |

The same person may perform more than one independent review role only if they did not author the candidate. The candidate author cannot sign the hard-filter, UX, accessibility, and final design verdict alone.

An initial three-screen proof (for example one phone Learning screen, one phone
Space screen, and one tablet overview) is sufficient only to judge whether a
visual thesis deserves continued search. It does **not** satisfy this matrix,
close a Phase A P0/P1 gate, or authorize promotion.

### Phase B — Implementation Merge/Release

| Evidence | Minimum requirement | Reviewer independence |
| --- | --- | --- |
| Accepted-authority mapping | The implementation PR cites the pre-existing accepted artifact/revision and maps every implemented state without implementation-time visual invention. | PR author records the mapping; independent review checks parity. |
| Native platform review | Real iOS and Android phone builds plus real tablet portrait/landscape builds prove target routes, safe areas, system chrome, IME, back, rotation, type reflow, focus, and action reachability. | Real observation per platform by a reviewer who did not author the implementation; relabeled or browser-only proof is invalid. |
| Native assistive-technology review | VoiceOver and TalkBack complete the required product paths; switch/external-keyboard alternatives, focus recovery, and result/error/pending announcements are observed in native builds. | Independent accessibility reviewer; Phase A semantics or automated scans cannot substitute. |
| Native async and persistence review | Delay, offline, duplicate input, failure/retry, background/foreground, process recreation, and storage/restoration preserve truthful committed state and recovery across required flows. | Independent implementation/runtime reviewer with recorded build and scenario evidence. |
| Merge/release verdict | Applicable Phase B P0s, required implementation review, and repository release gates are all green for the same implementation revision. | Product-owner design acceptance and green design gates cannot substitute for this verdict. |

## Approval Sequence

1. Candidate author completes the eight-direction population and an exact,
   code-native, candidate-bound proof.
2. Independent reviewer runs Phase A P0 hard filters. Failed candidates stop.
3. Independent visual and UX reviewers perform pairwise comparison and exact
   proof walkthroughs; representative target users complete the named tasks.
4. Independent accessibility reviewer verifies Phase A roles/names/states,
   keyboard/switch equivalents, focus/live behavior, contrast, type reflow,
   reduced motion, and color-removal evidence. This step does not claim native
   VoiceOver/TalkBack passage.
5. Independent platform-composition review checks iOS, Android, tablet portrait,
   and tablet landscape hypotheses at the required widths/orientations.
6. The search records fragment harvest, targeted mutation, and a shortlist; no
   file is marked accepted.
7. Product owner reviews the exact proof revision and explicitly accepts it or
   rejects/revises the shortlist. This is Phase A design acceptance only, not
   implementation completion, merge approval, or release approval.
8. Only after acceptance, a later design-only change may promote/update the
   accepted artifact, lifecycle/manifest entry, interaction/motion proof, and
   implementation mapping.
9. A separate implementation branch/PR consumes that pre-existing authority and
   runs Phase B verification on real iOS, Android, and tablet builds/devices.
10. Independent implementation, platform, accessibility, async, and persistence
    review must close all applicable Phase B P0s before merge/release. Neither a
    green gate nor a product-owner design decision can substitute for missing
    evidence from the other phase.

## Product-Owner Decision Record Template

```text
Decision: accept | reject | revise
Candidate: <stable id>
Commit / proof revision: <exact immutable revision>
Accepted surfaces and states: <explicit list>
Phase A P0 result: <all passed / named blockers>
P1 result: <all passed / explicit narrow exceptions>
Retained P2 gaps: <ids and owners>
Rejected alternatives: <ids and reason>
Implementation authorization: not authorized | authorized only for a later separate PR
Release authorization: not granted by this design decision
Product owner: <human identity>
Date: <yyyy-mm-dd>
```

An absent, ambiguous, or agent-authored record means `candidate_exploration`, not acceptance.

## Design Review Checklist Binding

Every visual output must additionally answer the checklist in `spec/visual-language.json`:

- Q1: current library and single dominant accent;
- Q2: focal object and squint-path hierarchy;
- Q3: canonical interaction silhouette or justified deviation;
- Q4: forbidden pattern scan;
- Q5: viewport containment and safe area;
- Q6: exact two-choice flip self-assessment, tabular Statistics numerals, and no primary module picker.

These answers are necessary but not sufficient: design promotion must close all
Phase A P0s and applicable P1s, while implementation merge/release must later
close all Phase B P0s on the separate native implementation revision.
