# Learning Interaction Evolution Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/search-runs/2026-09-03-learning-interaction-evolution/promotion-record.md`

## Decision

Adopt the current paper-and-space revision in `docs/design/visual-reference.html`, after the 2026-09-10 review exposed repeated front guidance, weak result hierarchy, oversized nested surfaces and incomplete interaction meaning. The previous theatre proof remains historical comparison, not the current composition.

## Product Truth

- Learning remains one system-sequenced current CET card.
- The card retains a stable spatial address and physical identity.
- Flip, multiple choice, lock, elimination, and swipe keep their canonical operation models.
- Peek and favorite remain explicit but lightweight; hint remains conditional and attached.
- Flip alone uses `有把握` and `再回看`.
- Long content is never truncated, and support usage remains sticky for scheduling.

## Implementation Hypothesis

One opaque paper owns the current task, with a quiet library/box address and a stable action zone. A warm neutral surface surrounds it. The paper is not wrapped in another tinted stage, and paragraphs are not each separate raised cards.

### First read and help

Show the original prompt and distinct front material once. The runtime converter takes only authored front text, never back content or quality metadata. Hint is authored help; peek gives an exam strategy or orientation. Both remain explicit and lightweight, with sticky usage across collapse. Do not show missing audio or normal sync as permanent messages.

### Result

The first result layer shows the correct content and the learner's choice, followed by the key reason. The original question remains readable at lower emphasis. Detailed analysis is optional depth. A generic outcome title must not displace the answer.

### Interaction and continuation

- Flip reveals additional back content, followed by 有把握 / 再回看.
- Four options share a clear comparable layout; letter and text stay together.
- A sentence forms above the lock rows. The last correct lock immediately reveals a result; only Continue remains afterwards.
- Elimination strikes exact, non-overlapping spans in the original passage. Unmapped/ambiguous source retains its full passage and explicit candidate set.
- Swipe has a single prompt-bearing movable object and two accessible direction choices, without a duplicated large prompt.
- Every result uses the existing learning event and remote acknowledgement boundary. Animation never creates extra completion events.

### Density and platform

The phone paper and action anchors retain stable outer geometry. Internal layout follows actual reading content; there is no half-stage minimum for short text. Long material scrolls without clipping. At large system text, options can stack while actions remain reachable. Web keeps the card centered and moves secondary tools onto the paper, using a small context area rather than a permanent third column.

### Implementation mapping

`apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/learning/presentation.ts`, `apps/mobile/App.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`.

### Design review

Q1: shared library tokens across native and Web. Q2: prompt/answer, then action, then help/address. Q3: sentence, paper, option set and moving card have distinct operations. Q4: no reward or decorative motion. Q5: preserve complete material and reachable actions at phone/text-size constraints. Q6: two self-assess choices; system sequence remains primary. These are implementation targets; final acceptance requires actual captures.

## Running-product correction: readable material and answers

The 2026-09-05 native journey exposed two failures: dense interaction layouts
omitted authored front support containing the target sentence, and the stacked
answer rail allowed the explanation to cover the correct answer. The baseline
is revised with implementation under machine-acceptance's experience policy.

- Required front material stays in the reading sheet for every interaction.
- Opening a hint adds help without replacing the original material.
- Selected and correct answers take their intrinsic height before explanation;
  the sheet may scroll rather than overlap or hide either answer.
- Preserve the outer card identity, quiet hint edge and two-state self-assess.
- Verify actual screenshots with the reading journey, then let a model inspect
  the resulting states; passing component/style assertions is insufficient.
