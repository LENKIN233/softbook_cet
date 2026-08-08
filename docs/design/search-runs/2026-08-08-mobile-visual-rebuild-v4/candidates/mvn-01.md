# mvn-01 — Native Focus

> **No advance — comparison only.** This candidate failed the final UI/UX
> advancement review and is not design or implementation authority.

## Candidate ID

mvn-01

## Provenance

- Tool or model: code-native responsive HTML composed from the v4 context pack and eight-system blueprint.
- Prompt: Render Native Focus as an ordinary high-quality CET4/6 mobile product with one task, truthful feedback, physical Space continuity, platform-specific navigation, and no internal language.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mvn-01-native-focus.html#mvn-01`
- Screenshots: no committed raster under the binary-evidence policy; reproducible exact browser states are recorded against the anchored Artifact at Learning, Result, Space, Auth, phone, and tablet sizes.

## Product Truth Fit

以平台熟悉度降低学习成本：单一任务卡、稳定动作区、标准四目的导航都服从系统排序；馆→组→盒→卡和两档自评保持不变。

This is a design-search rendering. Exact colors, typography, radius, material,
navigation treatment, breakpoints, and pane ratios remain
`implementation_hypothesis`; product order, interaction silhouettes,
self-assessment semantics, Space hierarchy, accessibility, and audience
separation remain `product_truth`.

## Focal Object

居中的当前学习卡。白色任务面、清晰词项和一枚当前馆砖红色主按钮组成最强剪影。

## First-Read Path

今日进度 → 当前词项与例句 → 查看答案 → 解释 → 两档自评；导航、账户和学习位置均后退一层。

## Interaction Silhouette

Flip 保持单面揭示后的两格自评；四选一保持 2×2；锁定为竖列；消除直接作用于句段；滑动保留顶层对象和有标签的等价按钮。

## Spatial Model

Space 用馆列表、当前馆强调、当前盒容器、卡片托盘和“稍后再学”区域形成四级包含，手机单列、平板三列。

## State Language

当前馆砖红色负责 Learning/Space 的主动作与当前路径；蓝色仅留给系统、Auth 和辅助状态。正确、错误、mint“有把握”、amber“再回看”各有文字与图形，不靠颜色独立传意。

## Motion Causality

提示从任务卡内展开；答案替换当前动作区；只有已确认结果才进入解释与下一张，Reduce Motion 时仅做即时替换。

## Platform Strategy

iOS 使用内收矩形 tab bar、较大标题和 44pt 控件；Android 使用标准底部导航、top app bar 节奏和 48dp 控件；tablet 改为导航 rail 与任务/解释双栏。

These are browser composition hypotheses, not verified native behavior; native safe-area, system-back, keyboard, and adaptive-window behavior remain open.

## Implementation Mapping

页头与当前卡映射 LearningSurface；解释与自评映射 flip result；馆列表和卡片托盘映射 SpaceSurface；其余页面分别映射 StatsSurface、MineSurface 与登录门。 The rendered file is learner-only browser evidence; it does not
authorize RN work, claim native behavior, or replace real-device verification.

## Known Risks

过度依赖平台惯例可能使品牌识别偏弱；平板右栏必须在作答前隐藏答案；Android 全宽导航是对旧 Aurora 假设的明确替换点。 The exact candidate proof passed browser reflow, target-size, and text-contrast checks at 320 and 1024 CSS px, including browser 200% text. Final browser terminal testing also passed for all eight candidates in iOS- and Android-framed 390 × 844 states: no horizontal overflow, the primary CTA remained clear of navigation, active controls met the 44px iOS / 48px Android floors, and multiple choice remained 2 × 2. Native safe-area, IME, reduced-motion, VoiceOver/TalkBack, physical-device, and real native 200% text verification remain open.

## Design Review Checklist Answers

Q1: The proof uses 当前馆 as the sole identity context;
only one brand/action hue is strong in Learning and the open Space path.
Sibling馆 colors appear only as narrow identity markers inside Space and remain below task/action weight. Mint and amber remain
small, labeled flip feedback roles.

Q2: 居中的当前学习卡。白色任务面、清晰词项和一枚当前馆砖红色主按钮组成最强剪影。 The first-read path is 今日进度 → 当前词项与例句 → 查看答案 → 解释 → 两档自评；导航、账户和学习位置均后退一层。 A grayscale rendering must
preserve that order before color is considered.

Q3: Flip 保持单面揭示后的两格自评；四选一保持 2×2；锁定为竖列；消除直接作用于句段；滑动保留顶层对象和有标签的等价按钮。 Audio remains an explicit resource control and never
becomes a sixth silhouette.

Q4: 无渐变文字、游戏化装饰、纯黑背景或四档自评。iOS 不使用巨型浮动胶囊；Android 保留平台标准底栏，这一差异被明确记录为替换已被产品 owner 否决的旧视觉假设。

Q5: Exact browser reflow and target checks completed at 320 and 1024 CSS px, including browser 200% text; the 80-case narrow method is recorded in `../browser-evidence.md#narrow-200-final`. The final iOS- and Android-framed 390 × 844 terminal states for all eight candidates also have no horizontal overflow, keep the primary CTA above navigation, meet 44px iOS / 48px Android active-control floors, and keep multiple choice at 2 × 2. Native safe-area, IME, VoiceOver/TalkBack, reduced-motion, physical-device, and real native 200% text verification remain open.

Q6: The rendered Learning path is system-sequenced and offers no module picker.
Flip result exposes exactly `有把握` and `再回看`; Statistics uses tabular
figure intent and a quiet daily ledger rather than a gamified dashboard.
