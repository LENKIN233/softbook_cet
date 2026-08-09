# Mobile Visual Rebuild V4 — Phase 1 Context Pack

## 当前任务引用的 spec

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
- `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`
- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v3/`

## Status And Authority

- Lifecycle: `completed_no_promotion`. This pack was authored as the Phase 1
  architecture and evaluation input; the completed run retained it as
  provenance after all eight candidates failed advancement.
- Scope: architecture and evaluation constraints for iOS phone, Android phone,
  and touch tablet, plus semantic parity with the separately accepted PC Web
  direction. The pack itself does not create a visual candidate and mobile
  evidence cannot establish all-release-target completion.
- Authority: this pack cannot change the product, interaction, spatial, or
  platform owners named by `spec/authority-map.json`.
- There is no accepted replacement mobile direction. The current RN screens,
  the rejected Aurora reset, the rejected orange editorial proposal, and the
  v3 candidate are evidence only, never an implementation source.
- No palette, material, typeface, radius system, navigation treatment, logo, or
  decorative metaphor in this pack is accepted or implied.
- A later exact visual candidate still requires independent review and explicit
  product-owner acceptance. Only a separate later implementation change may
  consume it.

## Search Objective

Rebuild the mobile experience from task clarity outward. The learner should
immediately understand what to do now, receive trustworthy CET4/6 feedback,
and retain a low-cost sense that the current card belongs to a larger physical
knowledge space.

Phase 1 deliberately separates three questions:

1. Does the experience work in grayscale, without brand color or decoration?
2. Can color be assigned by stable roles without turning the app into a black,
   white, and gray shell or a saturated concept render?
3. Does each platform feel native while preserving the same product hierarchy?

Failure on the first question cannot be repaired by the second or third.

## Product Truth

The following claims are non-negotiable and come from owner specs:

- The product helps Chinese university students prepare for CET4/6 through a
  system-sequenced single-card flow, not a word-memorization tool, generic
  language platform, module picker, or learning-management dashboard.
- Learning has one current task, one identifiable primary action, bounded
  secondary actions, truthful feedback, recovery, and continuity into Space.
- The five core interaction families retain distinguishable silhouettes:
  flip, four-choice, lock, elimination, and swipe. A generic card frame with
  changed icons is not sufficient.
- Flip self-assessment has exactly two choices: `有把握` uses the mint semantic
  family; `再回看` uses the amber semantic family. Auto-scored interactions do
  not reuse those judgements.
- Space visibly preserves the library → group → box → card hierarchy. Favorite
  is a tag; sleep is a reversible spatial state or zone. Neither becomes a
  replacement top-level box.
- The top-level information architecture remains `学习 / 空间 / 统计 / 我的`.
  The composition and navigation component may differ by platform and window
  class.
- Authentication is required before Learning. The primary method is phone plus
  verification code. Authentication is a gate and recovery flow, not a fifth
  top-level destination.
- iOS and Android have equal priority. Phone and tablet require dedicated
  compositions; tablet is not a stretched phone.
- Color has distinct semantic duties. Current-library identity is stable and
  learnable; at most one library identity is dominant on a screen. Correctness,
  error, warning, selection, and self-assessment cannot borrow that meaning.
- Learner-facing UI must not expose internal process, engineering, content
  storage, evaluation, or review language. Leakage is a quarantine blocker
  before visual taste is considered.
- User-visible implementation requires a separately accepted design artifact,
  applicable interaction or spatial evidence, and an implementation mapping.

## Product Truth Versus Implementation Hypothesis

| Decision | Classification | Consequence in Phase 1 |
| --- | --- | --- |
| System-sequenced single-card flow | `product_truth` | Every grayscale frame names the current task and primary action. |
| Four top-level destinations and order | `product_truth` | All platform models preserve the same four destinations. |
| Five interaction silhouettes | `product_truth` | At least one grayscale state per silhouette; no shared generic shell. |
| Visible Space hierarchy | `product_truth` | Space proof shows containment and current-object ownership, not a list. |
| Stable library identity and semantic separation | `product_truth` | Role map is fixed; exact color values and application are not. |
| Exact hex values, material, radius, font, icon family, shadow, and chrome | `implementation_hypothesis` | Must be explored later and may not be inherited by default. |
| Native tab bar, navigation bar, rail, sheet, or pane selection | `implementation_hypothesis` constrained by platform principles | Prove separately per platform; do not force one custom component everywhere. |
| Exact phone margins, pane ratios, breakpoints, and motion timing | `implementation_hypothesis` | Record as measurable candidate choices with rollback conditions. |
| Brand expression through one accent, a non-color cue, or both | `implementation_hypothesis` | Test only after the grayscale hierarchy passes. |

## Historical Evidence — Diagnostic Only

The pre-cutover blind audit indexed 391 visual artifacts from 2026-06-26 to
2026-07-06, then compared them with the later v3 run. The history shows
recurring systems, not isolated bad screenshots:

- pale paper plus a black selected capsule;
- dense card-within-card dashboards;
- route-wide authentication workbenches with weak task focus;
- dark neutral chrome with competing coral, indigo, green, and amber fields;
- the same phone shell copied onto Learning, Space, Statistics, and Mine;
- a phone frame enlarged into tablet instead of a tablet composition.

No historical full screen, structure, order, object metaphor, or fragment is
eligible for revival. The comparison exposes only candidate-independent tests
that must be re-derived from active product and platform authority:

- the current Learning task dominates supporting context;
- Space makes parent/child ownership and the current object understandable;
- registered result, explanation, and continuation preserve the accepted
  Learning rhythm without becoming equal competing panels;
- Statistics remains subordinate to Learning and presents truthful dated
  activity without becoming an analytics dashboard; and
- authentication, pending, error, retry, and continuity behavior is complete.

The editorial hierarchy, shelf-desk relationship, answer-slip composition, and
ledger treatment that exposed those tests remain rejected historical geometry.
They may not be traced, reordered, or lightly restyled in grayscale.

The v3 direction is not a seed for v4. Its address and continuity ideas may be
translated back into an abstract UX requirement only. Its faux device chrome,
large decorative object, pin or spine ornament, saturated slabs, and capsule
navigation may not be copied or lightly restyled.

## Implementation Hypotheses Under Test

These hypotheses guide Phase 1 but do not select a final visual style:

- A correct product hierarchy can be demonstrated using only grayscale,
  typography weight, spacing, scale, order, and containment.
- The Learning first read should be `task → interaction → registered result →
  explanation → next`, with navigation and account status visually later.
- A familiar platform navigation component will reduce cognitive overhead more
  reliably than a custom floating product object.
- Color will feel credible when surfaces remain calm and each chromatic role is
  narrow, named, and testable; semantic colors should not become decorative
  backgrounds.
- Tablet can reveal useful context in a second pane while keeping one focal
  action, instead of adding dashboard modules.
- Learning and reviewer evidence can share a build source while remaining
  physically separate documents and accessibility trees.

## Phase 1 Deliverables

Phase 1 is complete only when the run contains:

- this context pack;
- `ux-architecture.md`, defining the grayscale task and state architecture;
- `platform-and-color-rules.md`, defining platform adaptation, color roles,
  accessibility floors, and the learner/reviewer boundary;
- later grayscale wireframes for the required surfaces and states, created in a
  separate task;
- a written hard-filter result for grayscale UX before any colored candidate is
  ranked.

Phase 1 does not include production RN, a candidate HTML proof, a shared review
cockpit, a promotion claim, or an accepted palette.

## Hard Constraints

A later candidate is removed before aesthetic comparison when it:

- cannot communicate the current task and next action in grayscale;
- needs color, a logo, a phone shell, or decorative metaphor to establish
  hierarchy;
- presents multiple prominent actions or large competing status fields;
- returns to universal rounded panels, oversized capsules, nested containers,
  tiny gray body copy, or a full-screen decorative object;
- treats a semantic state color as a large decorative fill;
- lets multiple library colors compete outside a true map overview;
- makes navigation look like a task action or makes a task action look like
  navigation;
- copies the same composition onto iOS, Android, tablet portrait, and tablet
  landscape;
- hides content or controls behind system bars, cutouts, home indicators,
  gesture areas, or software keyboards;
- depends on gesture, motion, position, or color as the only instruction;
- loses content or action at large text settings or a 320-wide proof;
- exposes reviewer or engineering language in visible copy, accessibility
  names, dynamic strings, generated content, screenshots, or error details;
- combines learner and reviewer UI into one document tree;
- claims acceptance, implementation readiness, or native behavior from a static
  browser proof.

## Success Signals

Phase 1 succeeds when an independent reviewer can answer, from grayscale
evidence alone:

- What is the current CET4/6 task?
- What should the learner do now?
- What changed after the action?
- What is the safe next or recovery action?
- Where does this card belong in Space?
- Which of the four destinations is active?
- Why is this composition native to its platform and window class?

Each answer must come from the learner surface, not from reviewer annotations.

## External Principle Anchors

These sources constrain usability and accessibility; they do not define the
Softbook visual style:

- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Android: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android: Adapt layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)
- [Android: Color](https://developer.android.com/design/ui/mobile/guides/styles/color)
- [Android: Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Stop Condition

Do not begin a colored visual search until the grayscale architecture passes
product-truth, first-read, platform-composition, overflow, large-text, target,
state-recovery, and leakage review. Passing Phase 1 does not accept a visual
direction; it only makes visual exploration safe to start.

The v4 candidate population was rendered only after this architecture and its
role rules were written. That sequencing authorizes comparison, not promotion.

## Surface

Mobile Learning, committed Result, Space, Auth, Statistics, Mine, and dedicated
touch-tablet composition for iOS and Android at design-evidence level.

## Accepted Baseline

There is no accepted mobile visual baseline. The baseline to beat is functional
product truth plus the explicitly rejected v3 direction; historical screens are
evidence, not visual authority.

## Soft Objectives

Measure immediate task recognition, comfortable 16px-or-larger body legibility,
platform interaction familiarity, recovery clarity, and origin/return
continuity. Do not preselect a radius family, flat or layered depth, a location
device, or another brand-expression mechanism here. A later visual population
must vary those axes at equal completeness rather than treating one as the
preferred grayscale architecture.

## Source Artifacts

The run consumes the owner specs listed above, the historical blind audit, the
frozen v3 proofs only as rejected evidence, `ux-architecture.md`,
`platform-and-color-rules.md`, and `candidate-blueprints.md`. The durable v4
learner evidence is the eight anchored exact files from
`candidate-proofs/mvn-01-native-focus.html#mvn-01` through
`candidate-proofs/mvn-08-adaptive-workspace.html#mvn-08`; reviewer-only
comparison uses the physically separate `candidate-proofs/reviewer-gallery.html`.
The exact files are comparison evidence, not accepted visual authority.

## Forbidden Drift

Do not revive Aurora glass, paper editorial styling, decorative spines or pins,
black selected capsules, saturated multi-color slabs, fake phone chrome,
dashboard density, tiny muted body copy, flat two-box Space, module selection,
four-level self-assessment, or any reviewer language in the learner document.

## Candidate Budget

Population size is eight materially different systems in one generation. Hard
filter keeps only product-truth-safe systems; pairwise review forms a connected
graph across survivors; the human checkpoint selects an exact revision or
rejects all. No mutation or synthesis can enter RN without a new frozen proof
and explicit product-owner acceptance.

The rebuilt cohort currently rejects all candidates at the advancement gate.
Product-truth and basic browser-operability defects are closed, but shared P1
gaps remain in platform iconography/differentiation, causal motion, Auth/Space
pending-error-retry coverage, full-library deep links, tablet quality, formal
audio assets, and native verification. Final browser terminal testing passed all
eight iOS- and Android-framed 390 × 844 states with no horizontal overflow, CTA
clearance from navigation, 44px iOS / 48px Android control floors, and 2 × 2
multiple choice; mvn-08's 1024 × 768 tablet Lock CTA stayed in the first viewport
at y=671–719 on iOS and y=689–737 on Android. Native safe-area, IME,
VoiceOver/TalkBack, physical-device, and real native 200% text verification
remain open. No v4 candidate or named combination forms a synthesis skeleton.
Only candidate-independent requirements remain: reachable phone action,
legible Space ownership, conditional tablet context, and readable four-choice/
body rhythm. The next architecture must re-derive their geometry. No current
candidate, ranking, or fragment has design authority.
