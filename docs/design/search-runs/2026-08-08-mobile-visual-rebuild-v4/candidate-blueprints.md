# Mobile Visual Rebuild v4 — Candidate System Blueprints

## Status and scope

- Lifecycle: `completed_no_promotion`; these are the pre-render blueprints
  retained as provenance for eight rejected visual-system hypotheses.
- Purpose: define eight renderable and comparable visual-system hypotheses
  without changing product definition. “Renderable” never meant
  implementation-ready or accepted.
- This file is reviewer-facing design documentation. It is not a learner
  surface and does not authorize React Native implementation.
- Exact colors, measurements, type ramps, surface treatments, navigation
  treatment, and responsive compositions below are implementation hypotheses.
  They remain replaceable until the product owner accepts an exact rendered
  revision.

## Referenced product truth

- spec/requirement-memory.json
- spec/authority-map.json
- spec/product-core.json
- spec/interactions.json
- spec/knowledge-map.json
- spec/space-operations.json
- spec/platform-contract.json
- spec/visual-language.json
- docs/design/design-harness.md
- docs/design/single-card-ux-contract.md
- docs/design/interaction-motion/learning-core-interactions-v1.md

When the same concept is repeated, the owner declared by
spec/authority-map.json wins.

## Product truth shared by all eight candidates

1. The product is a CET4/6 preparation app for Chinese college students, not a
   generic English-learning or word-drill app.
2. Learning opens into the system-sequenced current card. Module selection,
   streaks, charts, and learning-plan management never outrank the current task.
3. One card is the current progress unit. The first-read path is context,
   current task, answer action, result, exam-oriented explanation, next card.
4. The five core interaction silhouettes remain visibly distinct:
   - flip: one large front/back object, then exactly 有把握 and 再回看;
   - multiple choice: prompt followed by a 2 × 2 option field;
   - lock: a vertical sequence of lock rows without card shells around each row;
   - elimination: a candidate set whose primary affordance is strike-through;
   - swipe: one top object over shallow trailing objects with two directions.
5. Hint is attached to the current interaction. Audio is explicitly started by
   the learner and is not represented as a sixth interaction family.
6. Auto-scored interactions never ask for 有把握 or 再回看. Flip uses those two
   choices only, with mint for 有把握 and amber for 再回看; 再回看 is never red.
7. Space visibly preserves library → group → box → card. Favorite is a tag.
   Sleep is a physical zone whose cards leave Learning until woken. Users may
   inspect and use supported position actions, but may not arbitrarily rewrite
   a card's knowledge ownership.
8. Top-level navigation order is 学习 / 空间 / 统计 / 我的. Auth precedes product
   navigation and uses phone number plus SMS code.
9. iOS and Android have equal product priority. Tablet is a dedicated
   composition, not a stretched phone frame.
10. One current library supplies the dominant learning accent. Other library
    identities are small, subordinate location cues only.

## Learner-surface content boundary

Rendered learner proofs must physically separate learner and reviewer
documents. Learner-visible text, accessibility labels, announcements, empty
states, errors, and generated content may contain only product meaning. They
must not reveal design-process terms, repository paths, implementation status,
test data labels, build information, algorithms, queues, synchronization
internals, service routes, raw exceptions, or unhandled placeholders.

Safe error language describes what the learner can do next, for example:
“暂时没能提交，答案已保留，请重试。” It never names an internal subsystem. A
result may explain the CET knowledge point and the card's visible Space
location; it may not explain why a scheduler selected the card.

## Shared implementation floors

- Body text: 16 pt preferred, 15 pt minimum only for secondary metadata;
  captions never below 13 pt.
- Touch targets: at least 44 × 44 pt on iOS and 48 × 48 dp on Android.
- Text contrast: at least 4.5:1; large text and meaningful non-text controls at
  least 3:1. Color is always paired with text, icon, shape, or position.
- Reflow: no horizontal clipping at 320 logical pixels or at 200% text scale.
- Motion: state change must remain understandable with Reduce Motion enabled.
- Chrome: no glass blur, decorative glow, gradient text, reward burst,
  universal capsule treatment, or novelty hardware decoration.
- Corners: circles are reserved for icons/avatars and pills for truly binary or
  status content. Containers and buttons use bounded radii.
- Bottom navigation: safe-area-attached, four equal destinations, and visually
  secondary to the current task. It is not a floating oversized capsule.

For the first rendered comparison, inherit the seven-category hue-family
mapping from the visual-language product truth, but recalibrate exact tones for
contrast and ordinary app appearance. Do not print raw category keys in
review-only swatches on a learner surface. Identity and feedback must remain
separable through placement, iconography, labels, and tonal treatment,
especially where a category hue is close to mint or amber. These proof tones
are not accepted canon.

## Candidate population at a glance

| ID | Working name | Dominant composition | Material model | Primary differentiation |
| --- | --- | --- | --- | --- |
| mvn-01 | Native Focus | centered task card + stable action footer | quiet native layers | lowest-learning-curve platform familiarity |
| mvn-02 | Exam Canvas | edge-to-edge content canvas + inset controls | continuous matte canvas | content reads as one uninterrupted task |
| mvn-03 | Library Rail | persistent colored address rail + asymmetric content | crisp panels and rules | location is encoded by structure, not badges |
| mvn-04 | Focus Header | current-library header field + white working sheet | tonal header over clean sheet | strong entry hierarchy without decorative shell |
| mvn-05 | Action Sheet | fixed prompt stage + contextual bottom work sheet | two-level stage and sheet | thumb action and feedback are the organizing system |
| mvn-06 | Structured Blocks | rectilinear prompt/action blocks | compact solid tiles | exam-tool precision and high scan efficiency |
| mvn-07 | Continuity Path | vertical progress path linking task and result | soft bands connected by a path | Learning-to-Space continuity is always legible |
| mvn-08 | Adaptive Workspace | phone task workspace; tablet master-detail workspace | restrained workspace panes | strongest dedicated tablet transformation |

---

## mvn-01 — Native Focus

### System thesis and material difference

Native Focus should feel immediately understandable to a normal iOS or Android
user. It uses familiar hierarchy, platform-native typography, a conventional
safe-area tab bar, one clear task card, and almost no bespoke chrome. Identity
comes from consistent library accent placement and excellent spacing, not from
a metaphor. It is materially different from the other seven because it
minimizes learned interface language and makes platform convention itself the
visual system.

### Foundation

- Color roles:
  - page: cool blue-white #F4F7FC;
  - primary surface: #FFFFFF;
  - primary ink: #172033; secondary ink: #566176;
  - system/brand blue for Auth and Mine only: #2563D9;
  - current-library accent: one calibrated member of the stable hue family;
    for the first comparison use coral #B9472B;
  - confident: dark mint #13795B on pale mint #DFF5EC;
  - review: deep amber #7A5200 on pale amber #FFF0C2;
  - error/incorrect: #B42318 with icon and explicit text;
  - correct auto-result: #147A54 with check and explicit text.
- Typography:
  - iOS: SF Pro with PingFang SC fallback;
  - Android: Roboto with Noto Sans SC fallback;
  - phone task title 24/31 semibold, question 20/30 medium, body 16/26,
    metadata 14/20, tab 12/16 medium;
  - numerals in Stats use tabular figures.
- Spacing: 4-point base; phone gutters 20; vertical rhythm 8/12/16/24/32.
- Radius: task card 18; option/control 12; small status 8; no giant pill
  containers.
- Material: opaque matte surfaces, one soft elevation level for the current
  task, hairline dividers elsewhere.

### Bottom navigation

A standard four-item safe-area bar is attached to the bottom layout. The
selected item uses filled icon plus label in the system blue outside Learning,
and current-library accent inside Learning/Space. Unselected items use outline
icons and secondary ink. On iOS the bar uses a top separator and subtle
translucency only if native system material preserves contrast; on Android it
uses an opaque Material surface and the selected item receives a compact tonal
indicator behind the icon, not behind the whole label.

### Page compositions

#### Learning

- Top context is one 44-point row: CET4/6 label, current library name, and
  “12 / 30”; no dashboard metrics.
- The current task card starts below 12 points of space and occupies the
  flexible center. Prompt and any explicit audio control are inside the same
  surface.
- The interaction-specific work area follows the prompt. The primary action
  stays in a stable footer immediately above bottom navigation.
- Secondary actions are a maximum of three quiet text-icon controls under the
  focal card: 提示, 收藏, and a context-appropriate more action.
- A one-line location cue such as “当前专项 · 当前知识盒” appears at the card
  foot and opens the matching Space address without leaving an unanswered
  confirmation in limbo.

#### Result

- Result replaces the action footer and expands a bounded analysis section
  inside the same current-card surface.
- Read order is 答对了/再看这一点 → correct answer → exam-oriented reason →
  下一张. Incorrect uses calm red only for the result label and selected error;
  the rest remains neutral.
- Space continuity is a small address row after the explanation, never a
  success dashboard.
- “下一张” is the only primary CTA; auto-scored results do not add self-assess.

#### Space

- A top-level library list uses seven full-width rows with a narrow identity
  stripe, library title, compact group count, and a clear disclosure affordance.
- Entering a library changes the screen to grouped sections; boxes are simple
  list cards with visible contained-card previews, not a flat card feed.
- Box detail has the box title, short knowledge description, then card rows.
  Favorite appears as a tag on the card row. Sleep is a named zone at the end
  of the box, visually enclosed and explaining that sleeping cards leave the
  Learning flow.
- Back navigation preserves hierarchy and scroll location.

#### Auth

- Centered wordmark, one concise benefit line, phone field, and one solid blue
  primary button. SMS code becomes a six-character accessible field on the
  next step.
- Terms remain readable body text; they do not compete with the CTA.
- Keyboard, resend countdown, expired code, and network recovery all keep the
  entered phone number and announce a clear next action.
- No product bottom navigation is visible.

#### Stats

- A quiet title and date range lead into one primary weekly minutes/cards
  comparison, followed by three small factual rows: 今日完成, 回看, 学习天数.
- No rings, medals, streak celebration, or oversized zero.
- Empty state says “完成第一张后，这里会出现今天的记录” with a direct return to
  Learning.

#### Mine

- Account identity row, 考试级别, 会员状态, then grouped settings
  lists. Purchase/restore is one normal list destination with a blue action,
  not a promotional hero.
- Check-in is a single truthful row if present. It is not the screen's focal
  object.
- Destructive account actions are separated at the bottom and use explicit
  confirmation.

#### Tablet

- Portrait: 88-point navigation rail on the left; the current task remains a
  centered 600–680 point column. Context and secondary actions use the spare
  right margin but never become a dashboard.
- Landscape: a 3:2 split. The main task occupies the larger left pane; the
  right pane holds explanation only after answer, or a collapsible Space
  address/secondary actions before answer. It never previews the answer.
- Space uses a three-column hierarchy browser: libraries, groups/boxes, and
  selected box contents.

### Core interaction treatment

- Flip is one elevated object; reveal changes the same surface, then a two-cell
  mint/amber assessment row appears in the stable footer.
- Multiple choice uses four equal 2 × 2 native tiles; selection uses border,
  radio mark, and tonal fill.
- Lock is an unboxed vertical row list with native switches/steppers suited to
  the slot content; unlocked state uses check plus text.
- Elimination uses readable sentence fragments with a visible strike and an
  undo action before submit.
- Swipe uses one top surface with shallow trailing edges; labeled left/right
  alternatives remain available for accessibility and Reduce Motion.
- Hint reveals inline from the bottom edge of the current task. Audio is a
  labeled play/pause row and never auto-plays.

### State feedback

Selection is immediate and reversible before commit. Pending disables only the
duplicate submit action and preserves the selected answer. Auto-result uses
icon, explicit label, answer evidence, and restrained semantic color. A
recoverable failure keeps the current answer and offers 重试; it does not revert
to an empty card. Route changes move accessibility focus to the destination
heading or current task.

### Platform differentiation

- iOS uses large-title collapse only on Space, Stats, and Mine; Learning keeps
  a compact context bar. Swipe follows iOS interactive spring behavior and
  respects swipe-back edge priority.
- Android uses Material ripple/state layer, predictive-back-safe navigation,
  48 dp targets, and tonal selected navigation icons. System bars are
  edge-to-edge but content respects insets.
- Native keyboards use platform phone/code input and never cover the primary
  Auth action.

### Risk and rejection conditions

- Risk: may feel competent but insufficiently ownable without strong content
  craft.
- Reject if a no-logo squint test cannot distinguish Learning from a generic
  study app, if the card becomes a generic shadow rectangle, or if Android is
  rendered as iOS with different icons.

---

## mvn-02 — Exam Canvas

### System thesis and material difference

Exam Canvas removes the “card floating on a page” default. The task is an
edge-to-edge matte content canvas, while controls and feedback are inset
functional regions within it. The experience resembles a polished document or
practice app rather than a stack of widgets. It differs from Native Focus by
making content continuous with the page and differs from Action Sheet because
its primary action is part of the task flow rather than a separate sheet.

### Foundation

- Color roles:
  - canvas: warm ivory #FBF8F2;
  - raised control region: #FFFFFF;
  - ink: #202534; secondary ink: #626A79;
  - brand teal outside library contexts: #00786F;
  - current-library accent for the first comparison: #C6532F;
  - neutral rule: #DDD7CC;
  - confident: #0F7456 on #E0F3EA; review: #765000 on #FFF0C4;
  - error: #B12B25; success: #167653, both always labeled.
- Typography: platform sans, with more generous long-form metrics: task 22/34
  medium, English passage 18/31 regular, Chinese analysis 16/28, context 14/20.
- Spacing: 6-point cadence; 18 phone gutter; 12/18/24/36 sections.
- Radius: canvas has none; inset controls 10; bottom button 12; analysis callout
  6 with a colored left rule.
- Material: continuous opaque canvas, no outer card, near-zero shadow.

### Bottom navigation

The four-item bar is a compact opaque strip separated from the canvas by a
hairline. Selected state is icon and label color only, plus a 3-point top
indicator aligned to the current destination. The bar uses no selected
capsule. This preserves a document-app feel and keeps the page visually
continuous.

### Page compositions

#### Learning

- Current library and light progress occupy a narrow top line inside the
  canvas. The prompt begins immediately beneath it.
- Long passages can scroll naturally; the current answer area is anchored
  after the relevant content, not forced above the fold.
- A sticky “继续作答” return affordance appears only after the learner scrolls
  away from the active answer area.
- Secondary actions are small labeled icons in the content margin. Location is
  shown as a two-line footer at the end of the task.

#### Result

- The selected response remains in place. A colored result rule and explicit
  label appear directly under the work area, followed by answer evidence and
  analysis as part of the same vertical document.
- “下一张” sits in a full-width bounded button at the document end and in a
  compact sticky return affordance while the learner reads long analysis.
- The result never jumps to a detached score screen.

#### Space

- Space begins with a horizontally scrollable but fully labeled library index.
  Selecting one updates the vertical canvas below; only the selected library
  owns the accent.
- Groups are section headings; boxes are bounded content sections with a
  colored rule, short knowledge-point description, and contained card rows.
- Box detail becomes a clean index page. Favorite is a trailing tag; the sleep
  zone is a distinct shaded appendix inside the current box rather than a
  peer library.

#### Auth

- A full-height warm canvas with a teal 4-point top rule, concise title, and
  vertically ordered phone/code form. Fields are underlined or lightly boxed,
  never giant capsules.
- SMS guidance and recovery are inline paragraphs. Errors sit next to the
  responsible field and preserve input.

#### Stats

- Stats reads as a weekly report: date heading, one restrained bar series,
  then a two-column factual ledger. Type hierarchy carries the page; cards do
  not fragment it.
- Definitions such as “回看” are available through an info disclosure without
  exposing system logic.

#### Mine

- Mine is an account document with section headings and rows separated by
  whitespace and rules. Membership status is a factual block near the top.
- Purchase, restore, notification, accessibility, and privacy use normal
  destination rows. No colored promo panel.

#### Tablet

- Portrait uses a centered 720-point content canvas with a narrow left
  navigation rail.
- Landscape uses a document-plus-margin composition: 68% content canvas, 32%
  contextual margin. Before answer the margin contains only actions and Space
  address; after answer it can hold a pinned outline of the analysis.
- Space uses a library index in the margin and the selected group's nested box
  document in the main canvas.

### Core interaction treatment

- Flip is a front document section that turns into its back using a depth-free
  crossfade or short vertical fold; the two assessments appear only after the
  analysis.
- Multiple choice remains a 2 × 2 inset field within the canvas.
- Lock rows span the canvas width and reveal each resolved clause below its row.
- Elimination works directly on sentence segments in the sentence line, with
  an explicit undo row.
- Swipe uses a bounded single object inset within the canvas so horizontal
  intent does not conflict with document scroll; labeled alternatives remain.
- Hint pulls a small note from the content margin. Audio is a normal media row
  above the audio prompt.

### State feedback

Feedback appears at the exact point of action in the document. Pending adds a
small progress state to the responsible control without blanking content.
Correct/incorrect retains the learner's response and appends evidence; retry
replaces only the failed submission row. Focus moves to the result heading, and
the long-document return affordance remains available without duplicating the
primary action.

### Platform differentiation

- iOS uses native scroll indicators, text selection behavior, and a bottom
  safe-area action only when the document CTA is offscreen.
- Android uses a small app bar on scroll, predictable back behavior through
  library/group/box depth, and Material field/error patterns in Auth.
- Tablet pointer hover may expose secondary location actions, but every action
  remains directly touch-accessible.

### Risk and rejection conditions

- Risk: continuous pages can become long and make the primary action feel far
  away.
- Reject if the active answer cannot be found within one gesture, if content
  looks like a PDF reader, or if the lack of an outer card erases the sense of
  one current knowledge object.

---

## mvn-03 — Library Rail

### System thesis and material difference

Library Rail turns current knowledge location into a persistent structural
edge. A 6-point current-library rail begins at the top context, passes the
focal task, and terminates at the Space address. The layout is intentionally
asymmetric: labels align to the rail while actions align to the thumb edge.
It differs materially because identity and continuity are spatial coordinates,
not chips, decorative objects, or header washes.

### Foundation

- Color roles:
  - page: #F7F9FC;
  - surface: #FFFFFF;
  - primary ink: #18243A; secondary ink: #59677A;
  - system navy for non-library destinations: #24466F;
  - current rail uses one accessible library hue; first comparison #B94C2C;
  - subdued structural blue: #D9E4F2;
  - confident: #14765A on #DFF4EB; review: #7A5200 on #FFF0C2;
  - error/correct use label, icon, and #B42318 / #147A54.
- Typography: platform sans; page title 26/32 bold, task 21/30 semibold, body
  16/25, rail/location label 13/18 semibold.
- Spacing: 4-point base, 24-point left content offset after the rail, 20-point
  right gutter; 8/16/24/32.
- Radius: task surface 14 with square rail-side corners of 4; controls 10;
  sheets 16; tags 6.
- Material: crisp opaque panels, strong alignment, one subtle shadow only on
  the active task.

### Bottom navigation

Navigation is a standard bottom bar, but the selected destination is marked by
a 3-point vertical indicator at the leading edge of its cell, echoing the
library rail. Icon and text remain centered. On Learning and Space, the
indicator uses current library color; on Stats/Mine it uses system navy.

### Page compositions

#### Learning

- A small library label anchors to the rail at top left; progress aligns at top
  right.
- The task surface touches the rail with a square leading edge and extends
  toward the thumb side. The interaction occupies the card's full internal
  width.
- A separated action block aligns to the right edge below the card, preventing
  the rail from being mistaken for a control.
- The rail ends in an address node labeled with group and box. Selecting the
  node opens that exact Space location.

#### Result

- The rail continues through a result node directly below the answer. The node
  carries check/correction icon plus text; color is semantic, not the library
  rail alone.
- Analysis sits in a flat, left-aligned section beside the rail. “下一张” is a
  solid right-aligned button.
- The address node updates only when the user continues or performs a supported
  Space action; it never claims hidden state changes.

#### Space

- The same rail becomes a visible hierarchy navigator. Library is the widest
  colored rail segment; group and box are nested thinner segments with text
  labels and indentation.
- The content area shows the selected level: library overview, group boxes, or
  box card positions. The hierarchy remains visible while drilling down.
- Favorite is a small tag attached to a card row. Sleep is a bounded region at
  the bottom of the selected box, joined to the hierarchy but clearly marked as
  state rather than knowledge ownership.

#### Auth

- No library rail appears before authentication. A system-blue progress rule
  at the top shows phone then code as two labeled steps.
- Form content is aligned to the same asymmetric grid, creating continuity
  without pretending a library is active.

#### Stats

- A system-blue rail marks the selected date range. Weekly bars extend
  horizontally from it, followed by a compact tabular ledger.
- The rail is not a progress streak. It is only a layout anchor and date
  selection indicator.

#### Mine

- A system-blue rail groups account, 会员, learning preferences, and
  support into four clearly labeled sections.
- Membership uses factual status text with a bounded action. No sales banner.

#### Tablet

- Portrait expands the rail into a 168-point labeled navigation column, with a
  560–640 point task pane.
- Landscape uses three aligned regions: top-level app rail, current hierarchy
  rail, and task/content pane. Learning keeps only app rail + task; Space uses
  all three.
- The task does not simply scale wider; its readable measure caps at 680 points.

### Core interaction treatment

- Flip uses one large surface touching the rail; the back preserves its exact
  position. Two assessment controls sit on the thumb edge after reveal.
- Multiple choice uses an asymmetric 2 × 2 grid with equal tile sizes despite
  the rail offset.
- Lock rows connect to small rail nodes, visually showing sequence without
  adding individual cards.
- Elimination candidates align in a clean column or grid; strike marks stop
  before the rail to preserve location meaning.
- Swipe trails are visible toward the open right side; the rail side remains a
  stable origin, with labeled controls below for alternate input.
- Hint expands into the margin between rail and task. Audio remains a labeled
  row within the task, not a node on the rail.

### State feedback

The rail always means location, never correctness. Correct, incorrect, pending,
favorite, and sleep/wake use separate labeled nodes or inline status surfaces.
A submission failure leaves the library rail and selected answer unchanged,
places 重试 beside the failed action, and announces the failure without
disclosing internal processing.

### Platform differentiation

- iOS keeps the leading rail clear of the system back-swipe zone by insetting
  interactive content; the rail itself is noninteractive except labeled nodes.
- Android uses the system back gesture and predictive-back preview between
  Space hierarchy levels; the rail visually contracts during preview.
- Android selection uses ripple within tiles; iOS uses highlight and subtle
  scale only when Reduce Motion is off.

### Risk and rejection conditions

- Risk: the rail could become a decorative brand stripe or consume scarce
  width at 320 pixels.
- Reject if labels clip at 200% text, if users mistake the rail for progress,
  or if Space hierarchy can no longer be understood without color.

---

## mvn-04 — Focus Header

### System thesis and material difference

Focus Header gives each task a calm, current-library-colored orientation field
at the top and a white working sheet rising directly below it. It is a familiar
consumer-app pattern used in finance, health, and productivity products: strong
context, clean work area, conventional controls. Unlike Library Rail it uses a
horizontal rather than vertical identity structure; unlike Native Focus, the
screen itself—not a floating card—creates the main hierarchy.

### Foundation

- Color roles:
  - base: #EEF3F8;
  - work sheet: #FFFFFF;
  - primary ink: #15243A; secondary: #5A687B;
  - brand blue-green outside library contexts: #087A76;
  - header uses a pale tint of current library; first comparison #FBE3D8 with
    accessible deep coral #A83F22;
  - confident: #116F54 on #DDF3E9; review: #765000 on #FFF0C2;
  - semantic error/correct: #B42318 / #147A54 with words and icons.
- Typography: title 24/30 bold; prompt 21/31 semibold; body 16/26; supporting
  label 14/20.
- Spacing: 8-point rhythm; 20-point phone gutter; 16/24/32.
- Radius: work sheet top corners 24, internal controls 12, subpanels 10.
- Material: solid tonal header plus opaque sheet; shadow limited to the sheet's
  upper edge.

### Bottom navigation

The standard four-item bar shares the white working-sheet material and remains
visually attached to it. Selected icon and label use the active destination
color; a small filled icon state replaces capsules. The sheet scrolls behind
neither bar nor unsafe area.

### Page compositions

#### Learning

- Header contains current library, short exam context, and light progress. It
  occupies 18–24% of phone height, never a full hero.
- The work sheet begins with the current prompt and interaction. Its top edge
  remains visible during short scrolls to preserve orientation.
- Primary action is at the sheet's bottom and may become sticky above
  navigation when analysis length requires scrolling.
- Space address is a quiet row at the transition between header and sheet.

#### Result

- Header shrinks to a compact context strip so the answer and analysis gain
  space.
- Result label appears at the top of the sheet; the selected work remains
  visible, followed by evidence and explanation.
- A solid “下一张” button sits in the stable bottom action area. Space address
  remains a secondary destination.

#### Space

- Header shows the selected library and its concise description. The white
  sheet contains group sections and box tiles.
- Entering a group keeps a compact header breadcrumb and turns the sheet into a
  two-column box field on wide phones, one column at narrow/reflow widths.
- Box detail lists its cards and visibly contains the sleep zone. Favorite is
  attached to card rows, not promoted to a tile.

#### Auth

- A brand-teal header carries the product name and a concise promise; the white
  sheet contains the phone/code form and terms.
- On keyboard appearance the header compresses instead of pushing the CTA off
  screen.

#### Stats

- A pale blue-green header gives the weekly range and one primary number in
  restrained scale. The sheet contains a simple bar chart and factual rows.
- The number never becomes a circular score or gamified level.

#### Mine

- Header contains avatar/account and 会员 status. The sheet contains
  grouped settings and purchase/restore actions.
- Membership state uses a small status block, not a bright marketing takeover.

#### Tablet

- Portrait: header becomes a 220-point left context panel; the work sheet is a
  right content pane. This is a deliberate recomposition, not a wider phone.
- Landscape: app navigation rail, context panel, and work pane form three
  regions. Space uses context panel for hierarchy and work pane for selected
  contents.
- Result may use a 55/45 split between retained answer and analysis.

### Core interaction treatment

- Flip occupies the upper half of the work sheet; reveal keeps the header
  stable, then exactly two self-assess buttons replace the reveal action.
- Multiple choice uses a 2 × 2 field that visually belongs to the sheet.
- Lock rows run down the sheet with a slim progress count in the header, never
  a ring.
- Elimination candidates use tinted strike states contained in the sheet.
- Swipe card sits partly against the header-sheet seam, emphasizing one current
  object while keeping labeled controls below.
- Hint unfolds from the sheet edge nearest the header. Audio is a single
  explicit media row beneath the prompt.

### State feedback

The header continues to encode library context while all response feedback
stays on the working sheet. Pending locks only duplicate commit. Result
reorders the sheet to result label, retained answer, evidence, analysis, and
next action. Recoverable errors preserve the sheet and input; destructive or
account errors require explicit confirmation and plain recovery copy.

### Platform differentiation

- iOS can use a native sheet-like large-radius transition while keeping
  navigation and safe-area behavior conventional.
- Android reduces the sheet radius to 20 dp and uses its small top app bar/back
  behavior within Space hierarchy. Elevation follows Material state layers.
- On both, keyboard opening compresses the header rather than scaling the
  content or hiding actions.

### Risk and rejection conditions

- Risk: a colored header on every page can become monotonous or resemble a
  banking dashboard.
- Reject if the header is visually louder than the CET task, if it consumes
  more than a quarter of the phone before scrolling, or if tablet simply
  preserves a huge top header.

---

## mvn-05 — Action Sheet

### System thesis and material difference

Action Sheet organizes the product around what the learner can do now. The
prompt occupies a stable upper stage; the interaction, submission, result, and
recovery occupy a thumb-reachable lower sheet whose content changes with task
state. It differs from Exam Canvas because content and action are intentionally
separated, and from Focus Header because the lower sheet—not the upper
context—is the dominant structural element.

### Foundation

- Color roles:
  - stage background: soft sky #EEF5FA;
  - action sheet: #FFFFFF;
  - ink: #142438; secondary: #5C6A7C;
  - system brand: ocean #0876A1;
  - current-library marker appears as a 4-point rule and selected controls;
    first comparison #B94A2A;
  - confident: #117154 on #DDF4E9; review: #765000 on #FFF0C2;
  - errors #B42318 and success #147A54 always paired with copy and icon.
- Typography: stage prompt 22/32 semibold; sheet title 18/25 semibold; body
  16/25; action 16/22 semibold.
- Spacing: stage 20-point gutter; sheet 20-point gutter; 8/12/16/24 rhythm.
- Radius: sheet top corners 22; controls 12; option tiles 12; status banners 8.
- Material: opaque two-plane layout; one top-edge shadow on the sheet.

### Bottom navigation

When the current task is unanswered, the four-item navigation remains visible
but muted beneath the action sheet. It is never replaced by task actions. A
separator and safe-area spacing distinguish app navigation from the sheet.
Selected destination uses icon/label color and a compact underline.

### Page compositions

#### Learning

- Upper stage contains library, progress, prompt, media, and only the content
  needed to understand the task.
- Lower sheet contains the interaction itself and one primary action. For
  choice, the 2 × 2 grid is entirely in the sheet; for long passage tasks the
  sheet can expand to full height while retaining a visible prompt anchor.
- Secondary actions live in a quiet row at the sheet top. Hint expands inside
  the sheet, never as a third layer.
- A compact location link at the stage-sheet boundary identifies group/box.

#### Result

- The sheet expands to about 60–75% of phone height and changes from work
  controls to result, evidence, analysis, and next action.
- The prompt remains visible as a compact strip above, so result context is
  never lost.
- The sheet can scroll internally, but the result label and “下一张” remain easy
  to recover. Dragging the sheet never dismisses a committed result.

#### Space

- Library and group selection occupy an upper context stage. Selected boxes and
  cards occupy a lower browse sheet.
- Entering a box expands the sheet rather than opening a generic detail page;
  the hierarchy breadcrumb stays on the stage.
- Sleep is an enclosed sheet section within the selected box. Favorite remains
  on individual card rows.

#### Auth

- Brand stage contains product identity and short trust copy. The lower sheet
  contains phone/code form, terms, error, resend, and CTA.
- The sheet rises with the keyboard and maintains a reachable CTA; it does not
  become a draggable dismissal surface during verification.

#### Stats

- Upper stage names the date period and shows one small bar sparkline. Lower
  sheet contains factual totals and daily rows.
- There is no celebratory completion layer; pending or empty state remains
  actionable and quiet.

#### Mine

- Upper stage contains account and 会员 summary. Lower sheet contains
  account, subscription, preferences, support, and legal groups.
- Purchase opens a dedicated bounded flow, not an overlay that obscures status.

#### Tablet

- Portrait places the stage in the upper 38% and a resizable work pane below,
  with a left navigation rail.
- Landscape turns the stage into a left prompt pane and the sheet into a
  persistent right action/result pane. This preserves the “understand then act”
  model without imitating a phone bottom sheet.
- Space uses left hierarchy and right box contents with a bottom state tray
  only for favorite/sleep operations.

### Core interaction treatment

- Flip front/back stays on the stage; reveal and exactly two assessments live
  in the sheet.
- Multiple choice's 2 × 2 work field and submit action live in the sheet.
- Lock rows make the sheet full-height and keep the prompt as a compact upper
  anchor.
- Elimination candidates live in the sheet with a persistent undo-before-submit
  row.
- Swipe uses the stage for the single top object and the sheet for labeled
  direction equivalents and result.
- Hint appears as a shallow inline expansion at sheet top. Audio stays on the
  stage and is explicitly controlled.

### State feedback

The lower work surface is the sole state-changing region. It clearly changes
from editable to pending to committed result, while the prompt stage stays
stable. Pending cannot be dismissed; failure returns the same sheet with the
learner's input intact and one retry action. Screen-reader focus enters the new
result title, then proceeds through evidence and next action.

### Platform differentiation

- iOS permits interactive sheet expansion with detents, but the primary CTA and
  result cannot be dismissed accidentally. VoiceOver order follows stage then
  sheet.
- Android uses a persistent bottom work surface rather than a modal bottom
  sheet, preserving predictive back. Ripples and state layers remain bounded
  to controls.
- On both, 200% text turns the layout into one vertical document; no nested
  scroll trap is allowed.

### Risk and rejection conditions

- Risk: nested scrolling, modal-sheet conventions, and keyboard interaction can
  make the system feel heavy.
- Reject if result can be accidentally dismissed, if the prompt becomes
  unreadably small, if 200% text creates two competing scroll containers, or if
  every destination is forced into the same sheet metaphor.

---

## mvn-06 — Structured Blocks

### System thesis and material difference

Structured Blocks is the most compact, exam-tool-oriented option. It uses
rectilinear blocks, strong baseline alignment, restrained borders, and clearly
numbered work regions. It feels like a polished utility app rather than a
luxury object. It differs through density and precision: fewer large empty
areas, smaller radii, and visible task structure, while still preserving one
focal interaction and a low operation count.

### Foundation

- Color roles:
  - page: pale blue #F1F6FA;
  - work blocks: #FFFFFF;
  - ink: #10243B; secondary: #56677A;
  - brand cyan-blue: #006F95;
  - current-library accent appears on block index, selected answer, and primary
    CTA only; first comparison #AD4628;
  - confident #0F7052 on #DCF3E8; review #735000 on #FFF0C4;
  - error #B42318; correct #147A54, paired with label and shape.
- Typography: platform sans; task 20/28 semibold; block label 13/18 bold;
  body 16/24; option 15/22 medium.
- Spacing: 4-point grid; phone gutter 16; blocks separated by 8 or 12.
- Radius: blocks 8; controls 8; primary button 10; status tag 4.
- Material: solid fills, visible 1-point boundaries, no drop shadow.

### Bottom navigation

A 56/64-point conventional navigation bar uses crisp icon-label pairs and a
2-point selected top rule. It is the least decorative of the population. At
large text, labels remain visible and the bar grows rather than clipping.

### Page compositions

#### Learning

- Block 01 is a compact context header: library, task type, progress.
- Block 02 is the focal prompt/media.
- Block 03 is the interaction field. It receives the only strong accent.
- Block 04 is the action/recovery row and appears only when required.
- The arrangement is compact enough for fragmented use but never adds
  unrelated metrics. Location is a small labeled row after Block 03.

#### Result

- Block 03 retains the work state. A new Block 04 contains result and evidence;
  Block 05 contains analysis and next action.
- Correct/incorrect state is readable through icon, title, border pattern, and
  text, not a full-screen color wash.
- “下一张” occupies the final full-width block. Space address stays secondary.

#### Space

- Libraries appear as seven labeled rows with small numeric codes and identity
  accents. Selecting one reveals group blocks; group selection reveals a grid
  of box blocks.
- Box detail uses a dense but readable card-position table with title, current
  status, favorite tag, and accessible action.
- Sleep is a clearly bounded region inside the box block. It is not counted as
  a library or favorite container.

#### Auth

- A compact brand header, then labeled blocks for phone, code, and action.
  Errors remain in the related block and preserve values.
- The structure works well with keyboard and autofill; there is no decorative
  hero.

#### Stats

- One small weekly bar block and a two-column ledger of tabular values. The
  layout emphasizes factual comparison, not a single oversized number.
- Empty and retry states replace only their block, preserving page context.

#### Mine

- Account, 会员, exam setting, accessibility, support, and legal are
  separate labeled blocks. Rows use visible separators and standard controls.
- Membership purchase/restore is factual, bounded, and never styled as a game
  reward.

#### Tablet

- Portrait uses a two-column block grid: prompt/context left, work/result right,
  with a persistent navigation rail.
- Landscape uses a 12-column grid. Learning allocates 5 columns to prompt and
  7 to work; Result allocates 4 to retained answer and 8 to analysis.
- Space uses 2/4/6 columns for library, box hierarchy, and card positions.

### Core interaction treatment

- Flip uses one large front/back block, then exactly two equal assessment
  blocks.
- Multiple choice naturally uses four equal 2 × 2 option blocks.
- Lock uses numbered full-width rows with leading locks and no individual card
  shells.
- Elimination uses compact candidate blocks with a strong strike-through and
  reversible selected state.
- Swipe deliberately breaks the static grid only for the single top object;
  trailing blocks and two labeled alternatives preserve its silhouette.
- Hint is an inset subsection of the current block. Audio is a compact labeled
  control row with time/status.

### State feedback

Only the affected block changes state. Selected, pending, correct, incorrect,
and retry each have distinct border/icon/text combinations; the page grid does
not flash or reorder unexpectedly. A completed block becomes read-only, and
the next action appears in a new final block. Plain-language labels prevent
compact visual codes from becoming learner-facing internals.

### Platform differentiation

- iOS uses 44-point minimum rows, focus/highlight states, and native navigation
  transitions without turning blocks into grouped Settings replicas.
- Android uses 48 dp rows, ripple/state layer, predictive back, and slightly
  stronger boundaries for varied displays.
- Tablet keyboard shortcuts can select options or advance, but the visible
  controls remain complete for touch.

### Risk and rejection conditions

- Risk: density can feel administrative or enterprise-like; numeric labels can
  be mistaken for internal codes.
- Reject if hierarchy resembles a debug console, if any learner-visible label
  uses system identifiers rather than plain CET language, if the focal task is
  not dominant when squinted, or if Stats and Learning become visually
  indistinguishable.

---

## mvn-07 — Continuity Path

### System thesis and material difference

Continuity Path makes the learner's immediate journey tangible with a quiet
vertical path: current task, answer, explanation, and visible Space address are
connected as stages of the same knowledge object. It is not a streak or
timeline of past activity. It differs materially because state transition and
physical location share one restrained visual grammar across Learning and
Space.

### Foundation

- Color roles:
  - page: pale aqua #F2F8F7;
  - surfaces: #FFFFFF;
  - ink: #142D32; secondary: #587075;
  - brand green-teal: #147667;
  - current-library path uses one identity hue; first comparison #B74B2D;
  - inactive path: #C9DAD6;
  - confident #116F53 on #DDF3E8; review #755000 on #FFF0C3;
  - error #B42318 and correct #147A54 with icon and explicit language.
- Typography: platform sans; task 21/30 semibold; stage label 14/20 semibold;
  body 16/26; location 14/21.
- Spacing: 8-point base; 20-point gutter; path column 24; content gap 12.
- Radius: surfaces 14; controls 10; path nodes circular only because they are
  positional markers.
- Material: opaque soft bands connected by a 2-point path; no floating stack.

### Bottom navigation

The four-item bottom bar uses standard icon-label pairs. Selection is a filled
icon and a short vertical stem above the icon, subtly continuing the path
language without turning navigation into a timeline.

### Page compositions

#### Learning

- The path begins at a small current-library node beside the context row.
- The current task is the only large surface beside the active node. Future
  stages are not shown as empty steps, avoiding process anxiety.
- After input becomes available, the primary action sits beside the next active
  node in the thumb zone.
- A final small address node names group and box. It is visible but secondary
  before answer.

#### Result

- The path grows only after state is committed: answer node, explanation node,
  and Space address node.
- Result uses semantic icon/text beside its node; the task's library path color
  remains unchanged, separating identity from correctness.
- “下一张” is a standard solid button after explanation. Continuing collapses
  the old path rather than showing an activity history.

#### Space

- Space reinterprets the path as nested containment: a library lane branches to
  labeled group lanes, then selected box and card positions.
- Only the current branch is expanded on phone. Back navigation restores the
  parent branch.
- Favorite is a tag on a card node. Sleep is a bounded side zone connected to
  the box; its explanatory text says sleeping cards pause from Learning until
  woken.

#### Auth

- A simple two-step phone → code path uses brand teal and plain labels. It
  shows only current and completed step, never hidden operational state.
- Errors attach to the responsible step and allow retry without clearing prior
  input.

#### Stats

- A seven-day path shows factual daily activity as short bars aligned to dates,
  not reward milestones.
- Totals sit in a small ledger below. No streak fire, medal, or future target
  pressure.

#### Mine

- Account settings use ordinary grouped rows. A short brand path only links
  account → 考试级别 → 会员状态 at the top; it does not organize every
  setting.
- Purchase and restore remain explicit destinations.

#### Tablet

- Portrait uses a left 200-point path/hierarchy pane and a right task pane.
- Landscape allows Learning's task, result path, and Space location detail to
  occupy three calm columns only after answer. Before answer, the result column
  is absent and the task expands.
- Space displays library lanes, group/box branches, and selected card detail
  simultaneously, with clear containment and no freeform node graph.

### Core interaction treatment

- Flip has one node for front, the same node transitions to back, then exactly
  two assessment actions form the next stage.
- Multiple choice uses a 2 × 2 field beside one active node; result creates the
  next node.
- Lock's native vertical rows align naturally to sequential path nodes but
  remain one interaction, not separate cards.
- Elimination candidates occupy one stage; strike-through changes candidate
  state without adding timeline steps.
- Swipe uses one top object with horizontal trails inside a single active
  stage; the vertical path does not compete with the gesture.
- Hint branches briefly from the active node and closes without advancing.
  Audio is an explicit media control inside the task.

### State feedback

The path grows only for committed learner-visible events. Pending stays on the
current node, correct/incorrect creates one labeled result node, and retry
returns focus to the same action without erasing the answer. Favorite and
sleep/wake appear only at their card or zone location. No invisible scheduling
or synchronization event creates a path node.

### Platform differentiation

- iOS path transitions use restrained matched-position movement or crossfade;
  swipe-back remains unblocked.
- Android path state uses Material state layers and predictive-back collapse
  between Space levels.
- Reduce Motion replaces path growth with immediate node appearance and focus
  movement; meaning never depends on drawn animation.

### Risk and rejection conditions

- Risk: the path can be mistaken for gamified progress, a workflow tracker, or
  extra steps.
- Reject if future stages are shown before they are relevant, if learners think
  they must manage the path, if the line outranks the card, or if Space becomes
  a freeform diagram rather than library/group/box/card containment.

---

## mvn-08 — Adaptive Workspace

### System thesis and material difference

Adaptive Workspace is designed from phone and tablet as two related but
distinct compositions. Phone is a focused single-task workspace with a narrow
context toolbar. Tablet is a true master-detail environment in which Learning
and Space continuity can coexist without exposing answers early. It differs
materially by treating responsive composition—not a decorative motif—as the
core visual system.

### Foundation

- Color roles:
  - workspace background: soft periwinkle #F2F4FB;
  - task pane: #FFFFFF;
  - secondary pane: #E8EEF9;
  - ink: #17223C; secondary: #5A6580;
  - brand indigo-blue: #3D5CC9;
  - current-library accent owns task focus and location; first comparison
    #B84A2B;
  - confident #117255 on #DDF3E9; review #765000 on #FFF0C2;
  - error #B42318 and correct #147A54 with explicit icons/text.
- Typography: platform sans; task 22/31 semibold, pane heading 18/25 semibold,
  body 16/25, toolbar 14/20.
- Spacing: 4-point base; phone gutter 18; tablet pane gap 16; 8/12/16/24/32.
- Radius: phone task 16; tablet panes 12; controls 10; tags 6.
- Material: opaque panes with borders; subtle elevation only for the active
  pane.

### Bottom navigation

Phone uses a standard safe-area bottom bar. Tablet replaces it with a persistent
72–88 point left navigation rail in the same order. Selection uses filled icon,
label, and a narrow indigo or current-library edge—not a capsule. Navigation
never floats over content.

### Page compositions

#### Learning

- Phone: compact context toolbar, one full-width task pane, stable bottom action
  row, then navigation. The toolbar can reveal Space address in a secondary
  disclosure.
- The task pane internally adapts to each interaction silhouette rather than
  forcing a universal template.
- Secondary actions occupy a small trailing toolbar menu with visible labels
  when expanded.

#### Result

- Phone: result and analysis replace the task pane's lower half while the
  answered work remains above. Next action stays in the stable action row.
- Tablet: answered task remains in the main pane; a result/analysis pane opens
  to the right. Before answer that pane contains only neutral location and
  secondary actions, never answer hints.
- Selecting the Space address changes the right pane to the exact box context
  while preserving return to result.

#### Space

- Phone: progressive drill-down with a persistent breadcrumb toolbar and
  distinct screens for library, group, box, and card.
- Tablet: three panes—library/group navigator, box list, selected box/card
  detail. Selecting sleep reveals an in-pane zone, not a modal storage page.
- Favorite remains a tag in card detail and list summaries.

#### Auth

- Phone: compact centered form with brand indigo CTA.
- Tablet: a two-pane composition with calm product value on the left and phone/
  code form on the right. The value pane contains no review claims, technical
  status, or invented testimonials.
- Keyboard and orientation changes keep the form pane within readable width.

#### Stats

- Phone: one weekly bar view plus factual rows.
- Tablet: date controls and summary ledger occupy a narrow left pane; daily
  bars and selected-day details occupy the main pane. Statistics never becomes
  the default landing view.

#### Mine

- Phone: ordinary grouped settings.
- Tablet: settings categories in a left pane and selected settings in the right
  pane, matching platform settings conventions without copying one OS exactly.
- Membership state is factual; purchase and restore are explicit actions.

#### Tablet

- Portrait widths below roughly 800 logical pixels use navigation rail +
  single main pane, with a temporary detail pane when space permits.
- Wide portrait and landscape use navigation rail + 320-point master pane +
  flexible detail pane. Learning may collapse master to a 220-point context
  pane to keep the task dominant.
- Text measure caps at 680 points. Panes stack vertically at 200% type rather
  than shrinking type or clipping actions.
- Pointer, keyboard, and touch states are all specified; no hover-only action.

### Core interaction treatment

- Flip uses one task pane; tablet analysis opens in detail after reveal, and
  exactly two assessment controls remain adjacent to the task.
- Multiple choice keeps a true 2 × 2 field in the main pane; result opens in
  detail only after scoring.
- Lock uses the main pane's vertical rows; resolved-row detail can appear in
  the secondary pane without making each row a card.
- Elimination keeps candidate strike-through in the main pane; explanation
  appears in detail after submit.
- Swipe stays a single top object with trails; tablet does not spread left and
  right choices into separate panes because that would change the silhouette.
- Hint is attached within the main pane. Audio is explicit and synchronized
  only at the user-visible media-control level.

### State feedback

Phone feedback remains inline in the active task pane. Tablet feedback opens a
detail pane only after commit; accessibility focus and assistive traversal move there
explicitly. Pending preserves both panes and disables duplicate submit. Error
and retry never replace a truthfully committed answer, and a collapsed detail
pane exposes a labeled control to restore it.

### Platform differentiation

- iPad uses a navigation split-view behavior and supports keyboard focus/arrow
  movement without hiding touch controls.
- Android tablet uses adaptive navigation rail and pane behavior while
  preserving Material back-stack semantics.
- iPhone and Android phone remain independently composed around safe areas,
  system bars, keyboard, and platform navigation feedback; neither is a
  screenshot relabel.

### Risk and rejection conditions

- Risk: this is the highest responsive engineering burden and can make tablet
  appear more capable than phone if parity is not carefully maintained.
- Reject if tablet is only a widened phone, if a secondary pane leaks the
  answer before commit, if phone hides important actions in an unlabeled menu,
  or if pane behavior breaks assistive traversal for accessibility tools.

---

## Cross-candidate interaction-state requirements

Every rendered candidate must prove the following, even when the system
blueprint emphasizes only one primary phone state:

| Capability | Minimum states to render or operate |
| --- | --- |
| Learning entry | loading, current card, recoverable unavailable state |
| Flip | front, back, 有把握 pending/success/error, 再回看 pending/success/error |
| Multiple choice | empty, selected, correct, incorrect, next card |
| Lock | untouched, partial, incorrect retry, complete |
| Elimination | untouched, struck, undo, submitted result |
| Swipe | neutral, below threshold, committed, cancelled, reduced-motion controls |
| Hint | absent, closed, open |
| Audio | idle, loading, playing, paused, unavailable/retry; explicit start only |
| Space | library, group, box, card, favorite tag, sleep, wake, return to Learning |
| Auth | phone invalid, code entry, resend cooldown, expired code, recoverable failure |
| Stats | empty, factual data, retry while preserving prior data |
| Mine/会员 | active, free, purchase recovery, restore recovery |

Pending and error states preserve committed learner truth and prevent duplicate
submission. They never display internal names or raw service failures.

## Material-difference checks for the renderer

The first proof pass must not flatten these into one template with swapped
colors. At minimum, screenshots should make these differences visible with
color removed:

1. mvn-01 has a centered elevated task and native page hierarchy.
2. mvn-02 has no outer task card; it is a continuous content canvas.
3. mvn-03 is asymmetric and anchored by a persistent vertical address rail.
4. mvn-04 is organized by a horizontal tonal header and rising work sheet.
5. mvn-05 separates prompt stage from a thumb-oriented work/result sheet.
6. mvn-06 uses a compact rectilinear block grid with small radii.
7. mvn-07 connects committed stages with a quiet vertical continuity path.
8. mvn-08 makes tablet master-detail transformation the defining composition.

If two proofs share the same DOM/layout skeleton and differ mainly by tokens,
at least one is not a valid candidate.

## Comparative risk ranking

Rank 1 is the lowest combined product, visual, and implementation risk. This is
a prioritization for rendering and review, not an acceptance decision.

| Rank | Candidate | Risk | Why | Highest-value proof |
| --- | --- | --- | --- | --- |
| 1 | mvn-01 Native Focus | low | familiar behavior, clear accessibility path, least bespoke chrome | no-logo recognition and Space distinctiveness |
| 2 | mvn-04 Focus Header | low–medium | strong hierarchy with conventional behavior | confirm header never outranks task or resembles finance app |
| 3 | mvn-02 Exam Canvas | medium | excellent content continuity but action recovery can weaken on long content | 320 px + 200% text long-passage test |
| 4 | mvn-06 Structured Blocks | medium | efficient and easy to map, but can feel administrative | normal-user trust test and internal-code leakage scan |
| 5 | mvn-08 Adaptive Workspace | medium | strongest tablet logic, higher engineering and accessibility burden | real iPad/Android tablet pane and assistive-traversal test |
| 6 | mvn-03 Library Rail | medium–high | ownable and spatial, but scarce-width and progress-confusion risk | grayscale 320 px comprehension test |
| 7 | mvn-05 Action Sheet | high | thumb-friendly, but nested scroll/keyboard/modality risk | iOS/Android keyboard, back, 200% text, and screen-reader test |
| 8 | mvn-07 Continuity Path | high | strongest Learning↔Space idea, greatest chance of workflow/gamification misread | representative learner interpretation without explanation |

## Recommended rendering order

1. Render mvn-01 first as the normal-consumer-app control.
2. Render mvn-04 and mvn-02 to compare horizontal hierarchy against a
   continuous content model.
3. Render mvn-03 and mvn-06 to compare spatial identity against compact exam
   utility.
4. Render mvn-08 on phone and tablet before judging it.
5. Render mvn-05 and mvn-07 only with their failure-prone interaction states,
   not as attractive static home screens.

No candidate should advance from a single Learning screenshot. Each must be
judged on Learning, committed Result, Space hierarchy, Auth with keyboard,
quiet Stats, factual Mine, and a genuinely recomposed tablet view.

## Blueprint-level review checklist

- Q1 — Current library and Law of One: every Learning/Result/Space composition
  names one current library accent. Other library colors are subordinate
  navigation/location cues. Auth, Stats, and Mine use a system brand role and
  do not pretend a library is active.
- Q2 — Focal object and first-read path: the current CET task is the focal
  object in all phone Learning candidates. The shared path is prompt → work →
  registered result → exam explanation → next card; chrome and statistics are
  tertiary.
- Q3 — Interaction silhouettes: every candidate preserves the five canonical
  silhouettes and treats hint/audio as attached capability, not a new card
  family.
- Q4 — Forbidden patterns: the blueprints reject gradient text, gamification,
  glass/glow, universal capsules, oversized floating tab bars, and serif
  novelty. Exact HTML/CSS still requires automated and independent review.
- Q5 — Constrained viewport: this prose file contains no rendered frame.
  Candidate proofs must demonstrate 320/360/393/430 phone containment, safe
  areas, keyboard, 200% text, and reachable CTA/navigation before survival.
- Q6 — Surface-specific truth: flip has exactly 有把握 / 再回看; auto-scored
  interactions do not. Stats uses tabular figures and remains quiet. Learning
  never promotes module selection over the system sequence.

The final cohort did not satisfy the complete Q5 survival condition: browser
320px/200% and 390px floors were measured, but the full width set, native safe
area, IME, assistive technology, and physical-device evidence remain open.
Accordingly, the later pairwise files are retrospective diagnostic comparisons,
not comparisons among advancement survivors.

## Promotion boundary

These blueprints are structured inputs to candidate production. They are not
accepted visual authority. Promotion requires exact learner-only proof files,
reviewer-only comparison evidence, hard-filter and pairwise records,
representative-person comprehension checks, product-owner acceptance naming an
exact revision, quarantine clearance, and a later implementation mapping. No
React Native work may cite this file alone as authorization.
