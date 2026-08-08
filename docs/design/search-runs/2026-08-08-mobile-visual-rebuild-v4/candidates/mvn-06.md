# mvn-06 — Structured Blocks

> **No advance — comparison only.** This candidate failed the final UI/UX
> advancement review and is not design or implementation authority.

## Candidate ID

mvn-06

## Provenance

- Tool or model: code-native responsive HTML composed from the v4 context pack and eight-system blueprint.
- Prompt: Render Structured Blocks as an ordinary high-quality CET4/6 mobile product with one task, truthful feedback, physical Space continuity, platform-specific navigation, and no internal language.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mvn-06-structured-blocks.html#mvn-06`
- Screenshots: no committed raster under the binary-evidence policy; reproducible exact browser states are recorded against the anchored Artifact at Learning, Result, Space, Auth, phone, and tablet sizes.

## Product Truth Fit

用矩形信息块提高扫读效率，但每屏仍只有一个任务区和一个主动作，不变成统计后台。

This is a design-search rendering. Exact colors, typography, radius, material,
navigation treatment, breakpoints, and pane ratios remain
`implementation_hypothesis`; product order, interaction silhouettes,
self-assessment semantics, Space hierarchy, accessibility, and audience
separation remain `product_truth`.

## Focal Object

几何清晰的任务块；32px 方形标记、直边标题和紧凑进度构成独特轮廓。

## First-Read Path

进度块 → 任务块 → 动作块 → 结构化结果块；信息密度提升但不牺牲 16px 正文与目标尺寸。

## Interaction Silhouette

五类交互通过格子、竖条、行内标记、单对象层叠和揭示区获得不同几何，不通过换图标伪装。

## Spatial Model

Space 把馆、组、盒、卡做成不同尺度的嵌套矩形；当前卡只占盒内一格，睡眠区是盒底独立区域。

## State Language

当前馆砖红色用于 Learning/Space 主动作和当前边界；青蓝只用于系统、Auth 与辅助状态。正确/错误有图标文字；自评两块为 mint“有把握”/amber“再回看”，不复用动作色。

## Motion Causality

块只在数据因果明确时扩展或重新排序；任何 pending 都固定尺寸，避免界面跳动。

## Platform Strategy

iOS keeps looser spacing and a quiet bottom tab treatment; Android uses tighter geometry and a tonal selected state; tablet uses a white 88px navigation rail at 1024px with aligned task and context regions.

These are browser composition hypotheses, not verified native behavior; native safe-area, system-back, keyboard, and adaptive-window behavior remain open.

## Implementation Mapping

进度、任务、动作与结果块直接对应 LearningSurface 状态区域；空间块映射现有四级层级；统计块限制为单日事实。 The rendered file is learner-only browser evidence; it does not
authorize RN work, claim native behavior, or replace real-device verification.

## Known Risks

Too many bordered blocks can recreate card-within-card density and fragment the first read; the rebuilt tablet rail is white, so the remaining risk is structural density rather than a dark rail competing with the task. The exact candidate proof passed browser reflow, target-size, and text-contrast checks at 320 and 1024 CSS px, including browser 200% text. Final browser terminal testing also passed for all eight candidates in iOS- and Android-framed 390 × 844 states: no horizontal overflow, the primary CTA remained clear of navigation, active controls met the 44px iOS / 48px Android floors, and multiple choice remained 2 × 2. Native safe-area, IME, reduced-motion, VoiceOver/TalkBack, physical-device, and real native 200% text verification remain open.

## Design Review Checklist Answers

Q1: The proof uses 当前馆 as the sole identity context;
only one brand/action hue is strong in Learning and the open Space path.
Sibling馆 colors appear only as narrow identity markers inside Space and remain below task/action weight. Mint and amber remain
small, labeled flip feedback roles.

Q2: 几何清晰的任务块；32px 方形标记、直边标题和紧凑进度构成独特轮廓。 The first-read path is 进度块 → 任务块 → 动作块 → 结构化结果块；信息密度提升但不牺牲 16px 正文与目标尺寸。 A grayscale rendering must
preserve that order before color is considered.

Q3: 五类交互通过格子、竖条、行内标记、单对象层叠和揭示区获得不同几何，不通过换图标伪装。 Audio remains an explicit resource control and never
becomes a sixth silhouette.

Q4: 无渐变、游戏化、衬线或纯黑；矩形块不是等权卡片网格，若三个以上区域同权或 rail 强于任务即失败。

Q5: Exact browser reflow and target checks completed at 320 and 1024 CSS px, including browser 200% text; the 80-case narrow method is recorded in `../browser-evidence.md#narrow-200-final`. The final iOS- and Android-framed 390 × 844 terminal states for all eight candidates also have no horizontal overflow, keep the primary CTA above navigation, meet 44px iOS / 48px Android active-control floors, and keep multiple choice at 2 × 2. Native safe-area, IME, VoiceOver/TalkBack, reduced-motion, physical-device, and real native 200% text verification remain open.

Q6: The rendered Learning path is system-sequenced and offers no module picker.
Flip result exposes exactly `有把握` and `再回看`; Statistics uses tabular
figure intent and a quiet daily ledger rather than a gamified dashboard.
