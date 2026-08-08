# mvn-04 — Focus Header

> **No advance — comparison only.** This candidate failed the final UI/UX
> advancement review and is not design or implementation authority.

## Candidate ID

mvn-04

## Provenance

- Tool or model: code-native responsive HTML composed from the v4 context pack and eight-system blueprint.
- Prompt: Render Focus Header as an ordinary high-quality CET4/6 mobile product with one task, truthful feedback, physical Space continuity, platform-specific navigation, and no internal language.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mvn-04-focus-header.html#mvn-04`
- Screenshots: no committed raster under the binary-evidence policy; reproducible exact browser states are recorded against the anchored Artifact at Learning, Result, Space, Auth, phone, and tablet sizes.

## Product Truth Fit

用低饱和色页头建立入口层级，下面保持紧凑白色工作面；不引入仪表盘和多个强动作。

This is a design-search rendering. Exact colors, typography, radius, material,
navigation treatment, breakpoints, and pane ratios remain
`implementation_hypothesis`; product order, interaction silhouettes,
self-assessment semantics, Space hierarchy, accessibility, and audience
separation remain `product_truth`.

## Focal Object

紧凑色页头下的白色答题工作面。页头说明“在哪”，正文说明“做什么”。

## First-Read Path

页头与今日步数 → 题目 → 操作 → 固定反馈位置 → 下一张；间距更紧但正文不低于 16px。

## Interaction Silhouette

工作面不统一装箱：选择题 2×2，锁定竖向，消除在句中，滑动单对象，flip 揭示后才出现两档。

## Spatial Model

Space 把页头转化为当前馆标题，下方用明显嵌套关系显示组、盒和卡；睡眠区仍留在盒内。

## State Language

当前馆砖红色属于 Learning/Space 主动作与当前路径；青绿色只留给系统、Auth 与辅助状态。低对比页头 tint 不承载正确/错误含义，mint“有把握”和 amber“再回看”保持独立。

## Motion Causality

页头保持稳定；任务内部仅在提交、展开提示、切换当前卡时发生小范围替换。

## Platform Strategy

iOS 页头跟随大标题折叠；Android 采用 64dp top app bar；tablet 头部不横跨所有内容，而是分别归属主栏与详情栏。

These are browser composition hypotheses, not verified native behavior; native safe-area, system-back, keyboard, and adaptive-window behavior remain open.

## Implementation Mapping

页头组合现有学习上下文；工作面映射各 Learning 交互；Space 复用层级数据；Stats/Mine 采用相同紧凑列表语言。 The rendered file is learner-only browser evidence; it does not
authorize RN work, claim native behavior, or replace real-device verification.

## Known Risks

页头若过饱和会重演色块压内容；紧凑节奏须在大字和 320 宽度验证；Android 返回顺序需真机确认。 The exact candidate proof passed browser reflow, target-size, and text-contrast checks at 320 and 1024 CSS px, including browser 200% text. Final browser terminal testing also passed for all eight candidates in iOS- and Android-framed 390 × 844 states: no horizontal overflow, the primary CTA remained clear of navigation, active controls met the 44px iOS / 48px Android floors, and multiple choice remained 2 × 2. Native safe-area, IME, reduced-motion, VoiceOver/TalkBack, physical-device, and real native 200% text verification remain open.

## Design Review Checklist Answers

Q1: The proof uses 当前馆 as the sole identity context;
only one brand/action hue is strong in Learning and the open Space path.
Sibling馆 colors appear only as narrow identity markers inside Space and remain below task/action weight. Mint and amber remain
small, labeled flip feedback roles.

Q2: 紧凑色页头下的白色答题工作面。页头说明“在哪”，正文说明“做什么”。 The first-read path is 页头与今日步数 → 题目 → 操作 → 固定反馈位置 → 下一张；间距更紧但正文不低于 16px。 A grayscale rendering must
preserve that order before color is considered.

Q3: 工作面不统一装箱：选择题 2×2，锁定竖向，消除在句中，滑动单对象，flip 揭示后才出现两档。 Audio remains an explicit resource control and never
becomes a sixth silhouette.

Q4: 没有渐变文字、勋章、XP、巨型胶囊或衬线。低饱和页头不是语义色大填充，若眯眼后强于题目则硬过滤。

Q5: Exact browser reflow and target checks completed at 320 and 1024 CSS px, including browser 200% text; the 80-case narrow method is recorded in `../browser-evidence.md#narrow-200-final`. The final iOS- and Android-framed 390 × 844 terminal states for all eight candidates also have no horizontal overflow, keep the primary CTA above navigation, meet 44px iOS / 48px Android active-control floors, and keep multiple choice at 2 × 2. Native safe-area, IME, VoiceOver/TalkBack, reduced-motion, physical-device, and real native 200% text verification remain open.

Q6: The rendered Learning path is system-sequenced and offers no module picker.
Flip result exposes exactly `有把握` and `再回看`; Statistics uses tabular
figure intent and a quiet daily ledger rather than a gamified dashboard.
