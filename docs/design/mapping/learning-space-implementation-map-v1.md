# Learning + Space Implementation Map v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/machine-acceptance.json#harness_strategy.experience_acceptance`

## Product Truth

Learning follows the system's single-card sequence. Space makes each card's
library, group and owning box inspectable. Browsing a different box never
reassigns knowledge ownership or changes the active learning card. Favorite is
a tag; sleep remains a state inside the owning box. Flip alone asks for the two
self-assess choices 有把握 / 再回看. Account, scheduling and durable-event authority
remain with their existing contracts.

## Current Design Artifact Source

- `docs/design/visual-reference.html` and `docs/design/canon.md`
- `docs/design/decisions/learning-interaction-evolution-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-object-theatre-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/design-harness.md`

The September 2026 paper-and-shelf revision replaces the previous theatre and
shelf-desk composition. Older direction/search/phone mock files are comparison
artifacts; their stage ratios, nested panels and selector arrows are not current
implementation requirements. Non-ideal state semantics remain applicable.

## Implementation Hypothesis And Component Mapping

| User task | Native | Web / shared behavior |
| --- | --- | --- |
| Read one current question | `LearningSurface.tsx` owns one paper and a fixed outer action envelope; material can scroll | `App.tsx` LearningSurface and `styles.css` use one centered paper, with address above and tools attached |
| Read original material once | `presentation.ts#frontMaterial` suppresses exact repeats only | The same helper preserves every distinct support/context text; converter `buildFront` uses authored front fields only |
| Recognize what to remember | `ResultSummaryPanel` puts correct answer and differing selection first, original material and key reason next | `answerComparison` supplies the same comparison; optional details expand in place |
| Flip and judge | Same-object flip, then two self-assess controls | Mint 有把握 and amber 再回看; pending sync freezes the submitted judgment |
| Choose one of four | Option label and text remain together; selected state precedes submission | Same answer contract and accessible selected states |
| Form a sentence | Only the active lock row exposes choices; settled rows show accepted phrases | Last correct slot resolves once, without another confirmation; only Continue advances |
| Remove sentence components | `EliminationPassageText.tsx` wraps exact source segments with reversible phrase controls and strikes | `eliminationPassage` requires unique non-overlapping spans; otherwise retain full material and separate candidates |
| Judge left or right | One prompt-bearing draggable object, cancellation restores its neutral position | Accessible direction buttons use the same two-state answer; no duplicated outer prompt |
| Locate a card in Space | `SpaceSurface.tsx`: library tabs → group tabs → sibling box objects → opened tray | Web shows library/group containment and sibling boxes; card context is attached to the selected object |
| Inspect a box's contents | Preview uses actual authored front material, then one full-text paper with previous/next controls | `spaceCardPreview` favors the original sentence for lock/elimination and retains all remaining front material in detail |
| Change a card's state | Favorite and sleep actions target the inspected card ID under existing access gates | State writes retain durable enqueue and account authority; sleep region stays within the box |
| Return to the current task | Explicit return restores the same Learning card, draft or result | Shared transition identity is applied only to the same card; manual browsing never changes learning progress |

## Surfaces, Color And Motion

The app background is warm neutral; the task paper is opaque. Borders and
corners distinguish card and box objects rather than every paragraph. Text
hierarchy follows question/answer, material, action, help and address. All seven
library identities come from `visual/tokens.ts` on both platforms. Feedback
colors express outcome; navigation emphasis does not change a library's hue.

`NativeMotion.tsx` and Web `motion.ts` retain cancellable card/route transitions.
Strikes, lock feedback, hint expansion, flip and swipe follow their own object
operations. Reduced motion applies the same final state without depth or travel.
Motion never writes a learning record. Audio controls remain available on both
question and result when the card has audio; explicit playback and authorization
rules are unchanged. Normal sync and absent-audio notices do not occupy a
permanent secondary column; pending/error state remains visible when relevant.

## Non-Ideal States And Evidence Boundary

Loading, empty, cached error, access gates and sync recovery preserve the known
Space object. Inspection and long answers use intrinsic text height; previews
may be shortened only when their full material can be opened. Phone Space
scrolls within the shell; at accessibility text sizes it follows the shell's
scroll ownership. Tablet Space owns scrolling to keep long material reachable.

Design text and component tests are not device evidence. Capture actual
question, result, hint, box, inspection and return states, then perform the
model-first-pixels review described in `design-harness.md`. The reading runner
also checks the answer in the first result layer, not only expanded detail.
Local development examples and simulated audio tests do not establish formal
content quality, private audio playback, device, account or deployment facts.

## Design Review Checklist Answers

Q1: Native and Web inherit the same current library hue; semantic feedback has
its own limited role. Q2: The question/answer and selected box/card are the focal
objects. Q3: All five operations act on their actual learning object. Q4: No
reward bursts, idle motion or decorative containers are required. Q5: Stable
outer card/action positions coexist with complete, scrollable long material;
actual captures decide acceptance. Q6: Flip has exactly two choices and Space
browsing leaves the system learning sequence intact.
