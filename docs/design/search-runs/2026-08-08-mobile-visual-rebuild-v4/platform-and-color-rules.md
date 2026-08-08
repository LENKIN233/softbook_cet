# Mobile Visual Rebuild V4 — Platform And Color Rules

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`

## Status And Intent

- Lifecycle: `completed_no_promotion`; these rules remain search provenance,
  not accepted visual authority.
- These rules constrained the rendered candidates; they did not choose a final
  palette, art direction, material, font, radius, or brand signature.
- A color candidate begins only after the grayscale UX gate passes.
- Platform familiarity is a quality floor, not a command to make every screen
  look generic. Product identity must sit above correct native behavior rather
  than replace it.

## Product Truth

- iOS, Android, and web ship the same core product capability; iOS and Android
  have equal mobile priority.
- Phone and tablet need dedicated UI and page composition.
- Top-level navigation order remains `学习 / 空间 / 统计 / 我的`.
- Current-library identity is stable and learnable. Only one library identity
  may dominate a screen; other library colors stay small in a true map context.
- Feedback color and library color are separate semantic systems.
- Flip uses exactly mint `有把握` and amber `再回看`; amber is not punishment
  and red is not a flip self-assessment option.
- Meaning is never communicated by color, gesture, or motion alone.
- User-visible internal-process or raw-data leakage is a blocking defect.

## Implementation Hypotheses

- Exact hues, tones, lightness, dark-mode values, tint strength, surface warmth,
  and brand accent remain open for later comparison.
- The current defaults in `spec/visual-language.json` are inputs, not an accepted
  mobile palette. A candidate may challenge them while preserving semantic
  bindings, explaining the scope, and defining a rollback.
- iOS may use system-adaptive materials and controls; Android may use Material
  color-role and adaptive-layout conventions. Neither is required to imitate
  the other's component geometry.
- Android dynamic color is optional. If offered, it must not reassign the stable
  library identities, correctness, error, warning, or flip meanings.
- A restrained non-color identity cue may support library recognition, but no
  decorative metaphor is selected here.

## Normal-App Color Role Model

A candidate must define tokens by role before assigning values.

| Role family | Purpose | Typical scale | Forbidden use |
| --- | --- | --- | --- |
| Page and surface | Content field, container, sheet, pane | most of the screen | pretending neutral alone is the brand; unnecessary nested panels |
| Primary ink | headings, body, labels | all content-bearing surfaces | pure visual aggression or weak gray-on-gray copy |
| Secondary ink | supporting copy and metadata safe for learners | limited | primary instructions, errors, disabled-looking active content |
| Primary interaction | current strongest action and active destination where platform-appropriate | one clear emphasis cluster | large decorative background, every button, navigation and action simultaneously |
| Library identity | location and mnemonic continuity | current library only; small peers in map views | correctness, error, membership, account state |
| Success | completed or correct state | local to the changed element | decorative green page, flip confidence outside its own control |
| Error | failure requiring attention or recovery | local and proportional | normal destructive-free navigation, general brand accent, incorrect-answer punishment wall |
| Warning or attention | reversible caution, waiting, review need | local and labelled | generic highlight, every pending state, flip meaning outside `再回看` |
| Information | neutral system guidance | restrained | competing with the primary task |
| Selection and focus | keyboard, assistive, or chosen state | around the relevant control | color-only state, low-contrast decorative glow |
| Disabled | unavailable action with reason | low emphasis but readable | hiding active actions or using opacity alone below legibility |

### Color Budget

- Surfaces occupy the majority of the screen and provide calm content contrast.
- One primary interaction or current-library cluster owns the strongest chroma.
- Semantic color appears at the source of the state: selected option, message,
  icon, border, or compact container. It does not wash the entire screen.
- A true Space overview may show several library identities, but non-current
  identities stay individually small and collectively subordinate to the
  current focus.
- Large saturated rectangles, multiple luminous accents, and black selected
  pills are not accepted shortcuts for hierarchy.
- Neutral colors can form the content foundation. They cannot be the entire
  identity, nor can a single accent mechanically recolor an otherwise generic
  rounded-card shell.

### Meaning Redundancy

Every colored state also has at least one of:

- explicit text;
- icon plus accessible name;
- selected mark or border with sufficient contrast;
- shape or layout change;
- announced state change.

Correct and incorrect, current and sibling, sleeping and active, selected and
unselected, pending and failed must remain distinguishable in grayscale.

## Light, Dark, And Increased-Contrast Modes

- Light and dark schemes are separately authored role maps, not literal
  inversion and not two different product identities.
- Dark mode avoids large near-black voids surrounding tiny dim content. Primary
  text, dividers, focus, selected states, and disabled states remain measurable.
- Surface elevation uses role differences that survive display variation; it
  does not depend only on blur or shadow.
- Increased-contrast settings must strengthen state boundaries without changing
  their meaning.
- System tint, transparency-reduction, bold-text, and color-filter settings are
  part of later native verification.

## iOS Rules

The iOS candidate must:

- respect safe areas, device cutouts, the home indicator, keyboard, rotation,
  and resizable iPad windows;
- use a recognizable tab-bar model for the four top-level destinations and keep
  task actions out of that navigation region;
- preserve tab navigation state and use conventional back and modal dismissal;
- support Dynamic Type without clipping, overlap, or inaccessible fixed chrome;
- provide at least 44 × 44 pt hit regions and visible pressed, selected,
  disabled, loading, and focus-equivalent states;
- prefer semantic system behavior for controls and accessibility even when the
  visible styling is custom;
- omit fake system bars, fake Dynamic Island, fake device bezels, and decorative
  gesture handles from learner proof.

An iOS screenshot must be recognizable as an app screen because of hierarchy,
navigation, typography behavior, and safe-area handling—not because it is
placed inside a drawn iPhone.

## Android Rules

The Android candidate must:

- draw edge-to-edge while applying status, navigation, gesture, cutout, and
  software-keyboard insets to interactive content;
- use a four-destination navigation bar on compact layouts and evaluate a rail
  for larger windows;
- implement System Back and predictive-back behavior, distinguishing Back from
  hierarchical Up;
- support compact, medium, expanded, portrait, landscape, split-window, and
  manufacturer aspect-ratio variation through reflow, reveal, or presentation
  change;
- use at least 48 × 48 dp touch targets and scalable text;
- map colors to semantic roles such as surface, on-surface, primary,
  on-primary, container, outline, error, and focus instead of hardcoded
  component colors;
- keep user wallpaper color from changing stable product semantics when dynamic
  color is enabled;
- avoid an iOS-style floating tab capsule pasted above the gesture area.

## Tablet Rules

Tablet candidates require four independent frames at minimum:

- iPadOS portrait;
- iPadOS landscape or a representative resizable window;
- Android tablet portrait;
- Android tablet landscape or split-window.

Each frame must demonstrate:

- navigation changing presentation when appropriate rather than stretching a
  phone bottom bar;
- a bounded readable main column or pane;
- a secondary pane that adds context, result, or object inspection without
  adding competing primary actions;
- preserved selection and scroll state when panes appear, disappear, or move;
- safe keyboard and focus behavior;
- no buttons, forms, cards, or explanations stretched across the full window;
- Space hierarchy remaining spatial and Learning remaining single-task.

Tablet layout is selected by available window and input conditions, not a model
name alone.

## WCAG And Platform Quality Floors

These are minimums for design proof; product review may require stronger values:

| Requirement | Floor |
| --- | --- |
| Normal text contrast | 4.5:1 against the final composited surface |
| Large text contrast | 3:1 against the final composited surface |
| Meaningful non-text UI and state contrast | 3:1 against adjacent colors |
| Text resize | 200% without loss of content or function |
| Reflow | no two-dimensional scrolling for ordinary content at 320 CSS px equivalent |
| iOS/iPadOS hit region | 44 × 44 pt minimum |
| Android touch target | 48 × 48 dp minimum |
| Focus | visible, not obscured by sticky chrome, and distinct from selection |
| Gesture | tap, keyboard, or accessibility-action equivalent where the gesture is required |
| Motion | reduced-motion path preserves order, result, and causality |
| Audio | user initiated; state and recovery remain perceivable without hearing alone |

Contrast is measured against the final composited background. Opacity on a
nominally compliant base color is not evidence.

## Learner And Reviewer Physical Isolation

Future interactive proof must produce separate artifacts:

```text
shared render source
  ├─ learner preview — learner copy and interactions only
  └─ reviewer harness — annotations, controls, measurements, verdicts
```

Required boundary:

- Learner preview declares `data-audience="learner"` and marks its application
  root with `data-learner-surface`.
- Reviewer harness declares `data-audience="reviewer"`.
- They are separate files, routes, document roots, accessibility trees, and
  browser histories. Hiding reviewer UI with CSS does not count as separation.
- The learner preview does not import, fetch, parse, clone, or execute reviewer
  markup, styles, or scripts.
- Reviewer evidence may consume the learner artifact or a shared build source;
  the dependency direction never runs from learner to reviewer.
- Reviewer controls cannot be focused, announced, copied, or discovered from
  the learner route.
- Query parameters and URL fragments may select a learner state only from a
  public allowlist; they may not inject labels or arbitrary visible text.
- The learner preview and reviewer harness receive independent leakage scans.
  Screenshot OCR and screen-reader output are sampled in addition to source
  scanning.
- A combined page, shared DOM, visually hidden review panel, or reviewer text in
  accessibility attributes is an automatic quarantine failure.

## Forbidden Learner-Visible Lexicon

The following are reviewer or engineering terms. They must not appear in screen
copy, accessibility names or descriptions, placeholders, generated content,
dynamic strings, loading or error details, paywalls, onboarding, or screenshots:

- `agent`, `harness`, `spec`, `validator`, `metadata`, `runtime`, `mock`,
  `prototype`, `seed`, `fixture`, `test data`, `debug`, `dev`, `TODO`;
- `implementation`, `repository`, `repo`, `pull request`, `PR`, `RN`,
  `endpoint`, `payload`, API route names, file paths, source paths, commit or
  build hashes;
- candidate IDs, audit IDs, P0/P1 labels, QA labels, acceptance scores,
  pass/fail verdicts, viewport names, breakpoint names, or contrast calculations;
- raw exception names, storage keys, raw content-location fields, non-public
  group or box labels, numeric card or box references, and internal English
  category labels;
- Chinese review narration such as `本原型`, `本证明`, `本测试`, `本审查`,
  `服务端`, `本地计数`, `完整算法`, `当前知识对象`, `当前对象`, `主动作`,
  `焦点已回到`, `焦点移到`, `重复操作`, `已阻止`, `状态已退出`,
  `操作已收起`, `未越过阈值`, `越过阈值`, `方向键预览`, `回车提交`,
  `键盘可用`, `按 Escape`, `认证门`, `自动内联解析`.

This list is a minimum, not a safe-copy dictionary. Any phrase that explains
how the artifact was made, reviewed, measured, or implemented instead of
helping the learner finish a CET4/6 task is blocked.

Canonical public library labels with the required `馆` suffix may appear when
they help orientation. Real group names, box names, internal identifiers, and
storage terminology remain forbidden.

## Leakage Review Procedure

Before a candidate enters pairwise visual review:

1. Scan learner HTML, SVG, Markdown-derived UI, accessibility attributes,
   generated strings, and inline dynamic copy.
2. Exercise loading, empty, offline, invalid input, permission, payment,
   timeout, retry, and restored-session states.
3. Inspect visible text and the VoiceOver or TalkBack accessibility tree.
4. Capture learner-only screenshots and run a human/OCR spot check.
5. Verify that no reviewer node, style, script, or URL-controlled string is
   reachable from the learner route.
6. Record the exact learner artifact revision separately from the reviewer
   artifact revision.

Any finding quarantines the exact artifact. A repaired artifact would re-enter
exploration as a new exact revision; it does not inherit the previous review
verdict or reopen this completed no-promotion run.

The completed v4 cohort did not finish the native accessibility and recovery
coverage required by this procedure before formal pairwise eligibility. Its
pairwise records are therefore preserved only as post-mortem diagnostic
comparisons; they do not establish survivor, shortlist, or promotion status.

## Color Review Gate

A colored candidate may proceed only when reviewers can answer yes to all:

- Does the same architecture still work when desaturated?
- Is there one chromatic emphasis cluster rather than several competing fields?
- Is current-library identity distinct from result, warning, error, focus, and
  membership state?
- Are success and error local, labelled, and proportional?
- Do light, dark, and increased-contrast schemes preserve meaning?
- Do iOS and Android use their own system behavior rather than cosmetic skins of
  one shared phone proof?
- Does tablet show a pane strategy instead of larger cards and larger empty
  space?
- Are exact contrast, target, reflow, focus, and leakage checks recorded for the
  learner artifact itself?

Failure returns to role assignment or UX architecture. It must not be solved by
adding more hue, more shadow, more glass, or more reviewer explanation.

## External Principle Anchors

- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
- [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Android: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android: Adapt layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)
- [Android: Color](https://developer.android.com/design/ui/mobile/guides/styles/color)
- [Android: Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
