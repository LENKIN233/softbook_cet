# Mobile Visual Rebuild — Next Synthesis Plan

## Status

- Lifecycle: `proposal_only_after_completed_no_promotion`.
- This plan does not accept mvn-01–08, create a shortlist, replace the active
  product specs, or authorize React Native work.
- The next output is a new exact visual synthesis. It is not an in-place polish
  of Aurora, the orange editorial proposal, Soft Spine, or any v4 candidate.
- Product-owner acceptance must name one exact rendered learner revision and
  its evidence revision before a separate implementation mapping can begin.

## Referenced Authority

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `visual-history-audit.md`
- `strict-review.md`
- `fragment-harvest.md`
- `browser-evidence.md`

## Decision From The Audit

The mobile problem is not a missing coat of polish. Repeated directions changed
surface material, accent color, radii, or panel arrangement while retaining too
much of the same rounded-card web-demo grammar. The result repeatedly looked
like a concept board, an internal tool, or a themed responsive page instead of
a mature consumer app.

Therefore the next synthesis starts with information hierarchy and native
behavior, then adds a restrained product identity. It deliberately does not
inherit the following visual packages:

- frosted Aurora fields, floating blobs, universal 28px cards, and oversized
  floating navigation capsules;
- warm-paper editorial styling, serif novelty, and orange margin devices;
- navy/rose/lime Soft Spine, long decorative rails, apertures, pins, and
  reviewer-like explanatory chrome;
- v4's generic glyphs, mixed accent systems, cosmetic platform skins, equal
  panels, browser-only tablet workspaces, or browser speech synthesis.

The v4 fragments that may inform structure are limited to mvn-05's reachable
phone action order, mvn-07's Space containment, mvn-08's task/context separation
on tablet, and mvn-01's default 2 × 2 option density and body scale. Every exact
color, icon, material, radius, sheet, rail, ratio, and motion choice is redrawn.

## Product Truth Versus Design Hypothesis

### Product Truth

- Learning is a system-sequenced single-card flow with one current CET task,
  one strongest action, truthful feedback, recovery, and continuation.
- Flip, four-choice, lock, elimination, and swipe remain materially distinct.
- Flip alone uses exactly `有把握` = confident/mint and `再回看` =
  review/amber. Auto-scored interactions do not reuse those judgements.
- Space visibly preserves library → group → box → card. Favorite is a tag;
  sleep/wake is a reversible physical-space state.
- Top-level order remains `学习 / 空间 / 统计 / 我的`.
- Phone login is a successive phone-number → SMS-code gate before Learning.
- iOS and Android have equal priority; tablet receives a dedicated composition.
- No learner surface may expose design, review, repository, data-pipeline, test,
  or implementation language.

### Design Hypothesis To Prove

- A clear consumer-app blue can establish product trust on neutral routes,
  while the current library color owns Learning and Space emphasis.
- Native navigation, system typography, moderate geometry, and fewer containers
  will read as more mature than another decorative brand metaphor.
- Phone should be a focused vertical task flow; tablet should add context only
  when that context helps the current task, not resemble an enterprise console.
- Visual identity can come from disciplined color roles, type rhythm, icon
  consistency, and interaction response instead of glass, gradients, large
  pills, or ornamental hardware.

These are hypotheses. The exact token set must survive rendered comparison,
contrast measurement, platform review, and explicit acceptance.

## Proposed Visual Direction: Clear Study System

### Desired Feeling

The app should feel calm, capable, contemporary, and encouraging: a trustworthy
CET coach for university students, not a school worksheet, game dashboard,
luxury editorial object, or productivity admin tool.

### Color Roles

Use semantic roles rather than recoloring every component with one theme color.
The first exact values below are test values, not accepted tokens.

| Role | Test direction | Usage boundary |
| --- | --- | --- |
| Product/system primary | clear medium blue around `#316DFF` | Auth, neutral-route primary actions, account/system links; not a second dominant Learning accent |
| Page | very light blue-gray around `#F7F9FC` | main field; never pure white over the whole app |
| Surface | white and low-chroma blue-gray tiers | content grouping with borders or tonal separation, not nested card stacks |
| Primary ink | deep blue-navy around `#172033` | headings and body; avoid harsh pure black |
| Secondary ink | cool slate around `#667085` | supporting copy only; never tiny low-contrast instructions |
| Current library | its stable library hue family | current task, selected option, current Space path, and strongest route-local action |
| Confident | mint, current reference `#22C58B` | Flip `有把握` only; label and selected mark remain visible without color |
| Review | amber, current reference `#F5B100` | Flip `再回看` only; never red or punishment language |
| Error | accessible red role | local failure plus recovery copy; never a full-screen wash |
| Focus | high-contrast platform focus role | keyboard/assistive focus; does not replace selection semantics |

Learning and Space obey the Law of One: the current library is the dominant
route accent. Product blue becomes subordinate there. Statistics, Mine, and
Auth may use product blue because no library identity owns those routes. Sibling
library hues appear only as small map objects in a true Space overview.

For the current 仔细阅读馆 prototype, test the existing coral identity as a
tonal system rather than a large saturated fill: a pale current-library
container, a strong coral edge/mark, and either dark ink or a separately tested
dark coral CTA. White-on-bright-orange is not assumed to pass contrast.
Do not inherit v4's dark brick-red family: across all eight candidates it made
the primary action feel dated, destructive, or enterprise-like. Keep only the
stable coral hue-family meaning and redraw tone/chroma with deep navy on-color.

Two existing semantic collisions require dedicated proof: 选词填空馆 identity
versus confident mint, and 语法馆 identity versus review amber. The library and
Flip states must differ through tone/chroma, label, icon, control shape, and
location. A shared hue alone is never sufficient.

### Typography

- iOS uses the platform system text family and Dynamic Type behavior; Android
  uses the platform system/Material type family and scalable text.
- Chinese body copy starts at a comfortable native body size; supporting copy
  is not reduced to 11–12px to make a frame fit.
- Use at most three weights in one screen. Hierarchy comes from size, spacing,
  and position before extra weight or color.
- Use stable platform weights such as 400/500/600/700; do not depend on
  browser-only intermediate values whose native rendering varies.
- English exam text receives generous line height and a bounded readable line
  length. Statistics uses tabular numerals and a meaningful date/scale axis.
- Do not import a novelty display face as the mobile identity. The product must
  still look intentional with system fonts at large accessibility sizes.

### Shape, Surface, And Depth

- Start with 12–16px containers and 8–12px controls; reserve full pills for
  short chips, segmented choices, and the two Flip judgements.
- One screen has at most one focal container. Supporting information uses
  spacing, type hierarchy, and fine dividers before receiving another card.
- Replace the universal floating capsule with platform-normal bottom navigation.
- Prefer one page field, one focal task region, and one attached result region.
  Avoid a card inside a card inside another tinted card.
- Use thin borders and tonal surfaces before shadow. One subtle elevation level
  is enough for a temporary sheet or lifted current object.
- No glass blur, luminous blobs, gradient text, giant empty hero regions, black
  selected capsules, fake device chrome, or decorative connector lines.

The existing floating-capsule and universal-radius guidance is a rejected mobile
implementation hypothesis, not product truth. If the exact replacement is
accepted, the later design-only authority update must reconcile that stale
guidance before implementation.

### Icon System

- No Unicode symbols, emoji, or improvised line drawings.
- iOS maps the four destinations and actions to one coherent SF Symbols family;
  Android maps them to one coherent Material Symbols family.
- The semantic mapping stays stable across platforms, while fill, stroke,
  selected treatment, ripple/press response, and optical sizing follow the
  platform.
- Every icon has a learner-facing accessible name. Color is not the only
  selected, favorite, sleep, playing, or error signal.

## Platform Composition

### iOS Phone

- Use a recognizable safe-area-aware tab bar for the four top-level routes.
- Keep the navigation bar visually stable across Learning states; task actions
  never enter or overlap the tab region.
- Use conventional back, sheet dismissal, keyboard avoidance, pressed state,
  and focus restoration.
- The current task begins near the top content safe area, not under a decorative
  status capsule or oversized brand banner.

### Android Phone

- Use an edge-to-edge Material navigation bar for four destinations with proper
  system insets, selected indicator, 48dp targets, ripple/pressed state, System
  Back, and predictive-back behavior.
- Do not paste the iOS tab treatment above the gesture area.
- Dynamic color may tune neutral/product roles only if stable library,
  correctness, error, warning, and Flip semantics remain unchanged.

### Tablet

- iPadOS and Android tablet receive separate exact frames in portrait and
  landscape/split-window states.
- Navigation adapts to a sidebar/rail appropriate to each platform.
- Learning uses a bounded task canvas plus one conditional contextual region.
  The region appears only after a result exists or an object is selected, never
  as a permanent empty pane; it introduces no second primary action and
  collapses when text or keyboard space is constrained.
- Space uses hierarchy + current box + selected-object inspection, preserving
  selection and scroll position as panes appear or collapse.
- Avoid the v4 enterprise-workspace look: no permanent three-column dashboard,
  dense rails, or equal-weight information panels.

## Surface Architecture

### Auth

First read: product identity → phone task → one primary continuation.

Prove phone entry, invalid phone, sending, code entry, invalid/expired code,
resend countdown and availability, edit phone, keyboard-safe back, duplicate
tap prevention, offline retry, and authenticated continuation. Auth is a real
full-screen entry, not a floating card over a fake signed-in shell.

### Learning

First read: current library/context → CET prompt → interaction → registered
result/explanation → one next action.

- The current task owns the first viewport. Progress and location are compact
  context, not a dashboard header.
- Secondary tools remain attached and quiet. Audio appears only when the card
  has an approved resource.
- Result appears where the action occurred; it does not become a second report
  page. After commit, one continuation is visually strongest.
- Long explanation may scroll vertically. Navigation and task CTA cannot cover
  focused or readable content.
- Learning context ends with the Learning route. Its title, current library,
  and progress cannot leak into Space, Statistics, or Mine chrome.

### Space

First read: current library/group → current box → contained cards → selected
state/action → return to Learning.

- Use nested spatial containment, not a flat list, metric dashboard, or two-box
  favorite/sleep shortcut.
- Favorite is an attached tag on the card. Sleep/wake remains under its owning
  box and exposes a reversible action.
- Prove every library entry, deep link, pending mutation, duplicate action,
  failure, retry, restored state, and return to the originating Learning card.

### Statistics

- Keep the route quiet and useful: a dated weekly view, visible scale, today
  marker, tabular numerals, and one concise trend explanation.
- Do not turn streaks, counters, or progress rings into the product center.
- Empty and unavailable states explain the next useful action without exposing
  system bookkeeping.

### Mine

- Use a clear account header followed by grouped native settings rows.
- Membership, sync, help, privacy, sign-out, and account deletion have distinct
  hierarchy and complete pending/error/confirmation states.
- Avoid a stack of equal rounded cards and avoid oversized account-status pills.

## Interaction And Motion Contract

| Family | Distinct operation shape | Causal response |
| --- | --- | --- |
| Flip | one face changes to its answer face | reveal follows the user's tap/gesture; then exactly two labelled mint/amber judgements appear |
| Four-choice | default 2 × 2 option field | selection attaches to one option; commit reveals selected and correct states locally |
| Lock | vertically related slots/rows | each adjustment moves its own slot; full resolution occurs only when the pattern is complete |
| Elimination | readable candidates with removable interference | strike/removal stays anchored to the chosen text and preserves the remaining sentence |
| Swipe | one directional object with two meanings | object follows the pointer, cancels below threshold, commits above threshold; labelled button alternatives remain |

Motion exists only to explain cause, ownership, and continuation. Use short,
interruptible transitions roughly in the existing 120–220ms guidance, then tune
on device. Provide a reduced-motion state replacement for every travel, scale,
or rotation. No looping attention motion, celebratory reward burst, decorative spine travel, or
motion that announces success before the result is known.

At extreme text size or unusually long approved content, controls may reflow
while preserving operation meaning. Any proposed 2 × 2 → one-column
accessibility adaptation must be shown and explicitly accepted rather than
hidden as an implementation exception.

## Formal Audio Boundary

Use the accepted attached audio control sequence: ready → preparing → playing ↔
paused, with recoverable error/retry and explicit user initiation. The control
stays attached to its card and never becomes a global player or a sixth
interaction family. Browser speech synthesis is excluded from product evidence;
the final proof must bind an approved content resource, private delivery/cache
behavior, native interruption handling, and real playback states.

## Required Exact Evidence

### Design Evidence Before Selection

1. Freeze one complete UX state matrix in grayscale for Auth, all five Learning
   families, Space depth/recovery, Statistics, Mine, and membership interruption.
2. Generate at least eight materially different visual systems from that same
   state matrix. Difference must be visible in type hierarchy, surface grammar,
   navigation treatment, color-role strategy, and interaction response—not
   merely hue or panel order.
3. Hard-filter product distortion, leakage, generic glyphs, non-native chrome,
   weak contrast, overflow, and incomplete states before pairwise review.
4. Render each surviving exact system on iOS phone, Android phone, iPadOS, and
   Android tablet. Reviewer controls remain in physically separate documents.
5. Add causal-motion storyboards and reduced-motion equivalents before any
   finalist can advance.
6. Run an independent UI/UX review on the exact files. A shared P0/P1 means no
   promotion, even if one direction wins relative pairwise comparisons.
7. Ask the product owner to accept or reject the exact learner revision. Silence,
   a technical pass, or a relative winner is not acceptance.
8. Run blind task tests with 6–8 representative CET4/6 students. Candidate IDs
   and reviewer materials remain unavailable to participants. Proposed minimums
   are: at least 80% identify the current task and next action within five
   seconds; at least 90% complete the core Learning action without instruction;
   at least 80% locate the current card and complete sleep/wake return; zero
   participants mistake the primary action for deletion, warning, or error.

### Native Acceptance Matrix Before Implementation Is Called Complete

- Widths: 320, 360, 390/393, and 430 logical pixels where supported.
- Text: platform large accessibility sizes and 200% equivalent stress; no
  horizontal page scroll, clipping, overlap, or hidden action.
- Targets: at least 44 × 44pt on iOS and 48 × 48dp on Android; WCAG minimum
  target and spacing checks remain an additional floor.
- Insets: status, cutout, home/gesture, keyboard/IME, rotation, split window,
  and predictive back.
- States: default, pressed, selected, focus, disabled, loading, empty, offline,
  error, retry, duplicate action, restored session, and reduced motion.
- Assistive technology: VoiceOver and TalkBack names, order, state, live result,
  focus restoration, and non-color meaning.
- Contrast: measured final composites, including disabled, focus, selected,
  library, confident mint, review amber, and error roles.
- Leakage: visible text, accessibility tree, screenshots/OCR, deep links, query
  strings, and every failure/recovery state.
- Devices: real iOS and Android phones plus representative iPadOS and Android
  tablet; browser frames remain supporting evidence only.

## Immediate Rejection Signals

Any P0 signal stops the revision: two equal accent systems in Learning/Space;
library color used as correctness/error/self-assessment; Flip judgements on an
auto-scored family; Space reduced to a list or favorite/sleep boxes; Auth with
no operable recovery; module/statistics management replacing the current task;
learner-visible review/internal language; or RN work before exact acceptance.

Any P1 signal blocks advancement: dark brick-red primary actions; Unicode icons
or Space represented as Home; platform variants that differ only by radius or
font; Learning chrome on another route; a permanent blank tablet pane; three or
more nested rounded containers; prototype/workspace narration; browser speech
synthesis presented as formal audio; normal-state-only proof; or a technical
pass described as visual approval.

## Delivery Sequence And Stop Gates

1. **History and failure freeze — complete.** Preserve v1/editorial/v3/v4 as
   rejected or no-promotion evidence.
2. **UX architecture.** Produce the grayscale state matrix and platform layouts.
   Stop if the first read is not one task or Space loses ownership hierarchy.
3. **Visual systems.** Build the role-based color, typography, geometry, and
   platform icon candidates. Stop any direction that reads as a web demo,
   internal tool, enterprise console, or decorative concept.
4. **Exact rendered proof.** Cover all required surfaces, states, phone sizes,
   and tablet compositions in physically separate learner documents.
5. **Motion and audio proof.** Bind causal storyboards, reduced motion, and the
   formal attached-audio lifecycle.
6. **Independent UI/UX review.** Record findings against exact artifact hashes;
   relative pairwise success cannot hide a shared blocker.
7. **Product-owner decision.** Accept or reject one exact learner revision.
8. **Separate design authority and mapping.** Only after acceptance, reconcile
   stale mobile visual hypotheses in the visual language and create an
   implementation mapping in a later design-only change.
9. **Separate RN implementation.** Implement, run the native matrix, perform a
   second independent review, and only then assess leadership readiness.

## External Principle Anchors

- [Apple HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): top-level destinations should remain stable and recognizable.
- [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/): familiar, perceivable, and adaptable behavior is part of the design, not post-build polish.
- [Apple HIG — Icons](https://developer.apple.com/design/human-interface-guidelines/icons): icon families require consistent metaphors, optical treatment, and platform behavior.
- [Android Developers — Navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar): compact layouts use three to five consistent destinations with explicit selected state.
- [Android Developers — Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3): color, type, shape, navigation, and adaptive layouts use semantic roles rather than ad hoc component colors.
- [Android Developers — Accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views): interactive targets need at least 48dp focusable areas and meaningful descriptions.
- [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): non-exempt content must preserve information and function at a 320 CSS-pixel equivalent without two-dimensional page scroll.
- [W3C — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): target size and spacing are measurable interaction requirements.

## Design Review Checklist Answers

- Q1: Learning and Space use only the current library hue as the dominant route
  accent. Product blue is subordinate there; sibling library hues are confined
  to small true-map objects.
- Q2: Learning's focal object is the current CET task; Space's is the current
  box or selected contained card; Auth's is the current authentication step;
  Statistics and Mine remain supporting routes.
- Q3: The plan preserves all five Learning silhouettes and the visible Space
  hierarchy, including favorite tag, sleep/wake, and Learning continuity.
- Q4: The plan explicitly rejects glass, blobs, giant pills, universal large
  radii, nested cards, black selected capsules, generic glyphs, decorative
  spines, fake device chrome, dashboard-first layouts, and internal-language
  leakage.
- Q5: No new rendered visual is promoted by this plan. The required phone,
  tablet, reflow, target, contrast, native inset, assistive-technology, and
  leakage evidence is specified before later acceptance.
- Q6: Flip remains exactly `有把握` = confident/mint and `再回看` =
  review/amber; Statistics requires tabular numerals and meaningful dates/scales;
  Learning remains system-sequenced rather than module-first.

## Stop Boundary

This plan is the proposed route out of the failed visual lineage. It is not a
design selection. Do not change user-visible RN code, update an implementation
mapping, or claim leadership readiness until a different exact learner artifact
passes the stated gates and the product owner explicitly accepts it.
