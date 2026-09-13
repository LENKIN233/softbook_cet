# Learning Core Interaction + Motion v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Product Truth

Learning 是 system-sequenced single-card flow。核心交互不是按钮装饰，而是用户处理当前 CET 卡片的低负担操作模型。

本 artifact 不改变 `spec/interactions.json`。如果交互合同要变，先更新 owner spec。

## Implementation Hypothesis

每个 core interaction 在 RN / Web 中必须保留可辨认 silhouette。具体 easing 和毫秒数可以微调，但操作、反馈、失败恢复和 reduce-motion fallback 不能被省略。

## Interaction Models

### flip

- Operation model: 用户先读正面内容，再翻面查看背面解析或答案。
- Feedback model: 翻面后只出现两档轻自评：`有把握` / `再回看`。
- Failure / recovery: 如果背面内容未加载，保留当前正面对象并给出轻量重试，不跳出学习流。
- Motion intent: card object 做一次 280-360ms 翻面或深度 crossfade，强调同一知识对象的正反面。
- Interruptibility: 翻面中可取消后续自评动作；自评未提交前不推进卡片。
- Reduce motion fallback: 翻面替换为 opacity crossfade + content swap。

### multiple_choice

- Operation model: 顶部题干，下面 2x2 option grid；用户选择一个选项。
- Feedback model: auto scoring immediately reveals correct / incorrect state and short exam-oriented explanation.
- Web correction includes an explicitly labelled selected/correct answer comparison; color alone is insufficient.
- Failure / recovery: 未选择时 CTA 不推进；远端同步失败只进入队列，不回滚本地结果。
- Motion intent: selected tile 120-180ms settle；correct answer gets restrained accent rim, wrong answer demotes without punishment animation.
- Interruptibility: reveal 后可以直接进入下一张，不要求额外 mastery 判断。
- Reduce motion fallback: option state changes are instant with color and border only.

### lock

- Operation model: 一组 vertical lock rows，用户按顺序解锁或选择 row。
- Feedback model: accepted phrases form the sentence in place. The final correct slot immediately reveals the answer and original sentence. Continue is the next action; there is no redundant confirmation.
- Failure / recovery: 选错时保留 row context and allow retry or reveal according to card contract. Completing after a mistake says “已解锁，稍后再回看”; the attempt remains review-needed without another rating or a visible mistake counter. Leaving and returning must preserve that attempt evidence.
- Motion intent: each unlocked row expands 120-220ms; no per-row card shell.
- Interruptibility: 未完成时可以离开当前卡，但返回后仍看到 row progress.
- Reduce motion fallback: expansion becomes immediate row height/content reveal.

### elimination

- Operation model: 用户直接划掉原句中的可操作成分，保留文本和划线痕迹；再次点击可撤销。只有源文本匹配唯一且片段不重叠时才原位映射，否则保留完整原句与独立候选项。
- Feedback model: remaining candidates become the answer set; auto reveal confirms final state.
- Failure / recovery: 用户可撤销最近一次 strike before submit; submit 后只显示轻量 correction.
- Motion intent: strike line draws 100-180ms, candidate opacity lowers; no reward burst.
- Interruptibility: strike state is reversible before final submit.
- Reduce motion fallback: strike-through and opacity update instantly.

### swipe

- Operation model: exactly one top card object visible, with left/right trail hints.
- Feedback model: direction resolves to the card's two-state answer contract; the answer comparison appears before explicit continuation.
- Failure / recovery: ambiguous or cancelled drag snaps card back to center; no answer is recorded.
- Motion intent: drag follows finger/mouse; release settles 180-260ms; next card enters as continuation of the same object stack.
- Interruptibility: before release, user can return to neutral.
- Reduce motion fallback: directional buttons or discrete left/right choice replace drag travel.

### hint_layer

- Operation model: hint is an attached layer on the current object, not an independent card type.
- Feedback model: reveal makes a small piece of exam-relevant support visible without solving the card.
- Failure / recovery: if hint is absent, no placeholder panel is shown.
- Motion intent: hint layer slides or fades from the object edge in 120-200ms.
- Interruptibility: hint layer can be closed without changing answer state.
- Reduce motion fallback: hint text appears inline under the trigger.

## Learning Low-Burden Rule

Android system Back returns from result detail to the same resolved card, from
the Space card list to its overview, and from supporting routes to Learning.
It does not submit, advance, discard an answer or clear pending sync. At the
Learning root, use the normal system Back behavior. Native modals retain their
own close/submission rules. The platform contract owns this order.

Flip feedback keeps 有把握=confident/mint (#22C58B) and
再回看=review/amber (#F5B100).

- The primary action is always the interaction's own operation.
- `peek`, `hint`, `favorite`, and contextual `sleep` stay secondary.
- Auto-scored interactions must not ask the user for `有把握` / `再回看`.
- The complete analysis keeps every answer line readable at ordinary and large text sizes. A provided audio transcript has an explicit disclosure after resolution, collapsed initially, and is never shown on an unanswered front.
- The accessible swipe object includes its actual question in the spoken name; direction choices and selection status remain available without dragging.
- No interaction may introduce gamification chrome, reward bursts, or extra state counters as the main feedback.

## Design Review Checklist Answers

Q1: Current library accent is inherited per card; only one library accent may dominate a screen.

Q2: Focal object is always the current CET card; secondary tools and chrome must stay visually lighter.

Q3: This artifact binds the five canonical silhouettes from `spec/visual-language.json#interaction_silhouettes`.

Q4: No forbidden patterns are introduced; this is a prose interaction artifact.

Q5: Not applicable; this artifact contains no rendered phone frame.

Q6: flip uses exactly two self-assess pills, and module selection is not part of the primary learning path.

## Runtime motion implementation — 2026-09

The implementation now follows one cancellable object rhythm. A card exits before
Continue changes the current card; the next ready card enters from the opposite
side. An unsuccessful remote continuation restores the current object instead
of leaving an empty animated surface. Flip uses a short depth turn with the
answer swap at the hidden midpoint. Selection feedback, opening lock shackles,
reversible per-line strikes, attached help reveals and result settling are
separate motions; they do not add scoring events or additional confirmations.

Leaving the route, changing card identity, or enabling reduced motion cancels
unfinished visual callbacks. Repeated activation during an outgoing motion
cannot submit or advance twice. Reduced motion applies final state immediately.

Learning → Space pulls back to the containing hierarchy; Space → Learning
focuses the current object. Web uses shared view-transition identity where the
browser supports it, with a direct accessible fallback. Native uses a paired
outgoing/incoming route transition while keeping the navigation chrome fixed.
Route entrance starts only after the new identity commits; deferred navigation
keeps the outgoing page hidden, and animation cleanup never restores old pixels.
Long lock choices wrap inside their row instead of crossing its border; the outer card keeps its resting geometry. Card content, formal audio/content approval and scoring rules are unchanged.

Implementation mapping: `apps/mobile/src/learning/NativeMotion.tsx`,
`apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/App.tsx`,
`apps/web/src/motion.ts`, `apps/web/src/App.tsx`, and `apps/web/src/styles.css`.
