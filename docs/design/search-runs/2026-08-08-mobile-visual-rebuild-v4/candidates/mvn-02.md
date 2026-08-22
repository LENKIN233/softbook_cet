# mvn-02 — Exam Canvas

> **No advance — comparison only.** This candidate failed the final UI/UX
> advancement review and is not design or implementation authority.

## Candidate ID

mvn-02

## Provenance

- Tool or model: code-native responsive HTML composed from the v4 context pack and eight-system blueprint.
- Prompt: Render Exam Canvas as an ordinary high-quality CET4/6 mobile product with one task, truthful feedback, physical Space continuity, platform-specific navigation, and no internal language.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mvn-02-exam-canvas.html#mvn-02`
- Screenshots: no committed raster under the binary-evidence policy; exact browser evidence records 320px initial Learning states, while separate 390px phone checks cover terminal Learning and representative Space/Auth paths. The available tablet query remains an unverified composition hypothesis; no 1024px measurement exists for mvn-02.

## Product Truth Fit

把学习内容视为一张连续答题画布，取消外围任务卡，但仍保留系统排序、单主动作和结果回执，不把产品变成题库选择器。

This is a design-search rendering. Exact colors, typography, radius, material,
navigation treatment, breakpoints, and pane ratios remain
`implementation_hypothesis`; product order, interaction silhouettes,
self-assessment semantics, Space hierarchy, accessibility, and audience
separation remain `product_truth`.

## Focal Object

无外框的连续内容画布与左侧细强调线；词项和例句本身成为焦点。

## First-Read Path

细进度线 → 题干 → 明确作答区 → 底部确认 → 行内解释 → 下一张，视觉 chrome 几乎退出首读。

## Interaction Silhouette

五类交互依靠工作区形状区分，而不是统一卡壳：2×2 网格、竖向锁列、可撤销句段、单对象滑动和揭示面。

## Spatial Model

Space 以分段目录和明确缩进展示四级关系；当前路径用一条结构线连接，而非彩色徽章堆叠。

## State Language

当前馆砖红色标记 Learning/Space 的主动作和当前路径；青绿色仅用于系统、Auth 与辅助状态。正确/错误只在提交后出现；两档自评仍是独立的 mint“有把握”和 amber“再回看”。

## Motion Causality

画布不漂移；提交后解释在原位置展开，焦点进入结果标题；返回学习时恢复未丢失的上下文。

## Platform Strategy

iOS 使用平面分隔与内收底栏；Android 使用清晰 top app bar 与 tonal indicator；tablet 的连续画布占 68%，侧栏只承载操作或已提交解释。

These are browser composition hypotheses, not verified native behavior; native safe-area, system-back, keyboard, and adaptive-window behavior remain open.

## Implementation Mapping

连续画布映射 LearningSurface 的内容区；动作 footer 映射各交互的提交接口；分段 Space 映射已有层级；Auth、Stats、Mine 复用相同平面分隔原则。 The rendered file is learner-only browser evidence; it does not
authorize RN work, claim native behavior, or replace real-device verification.

## Known Risks

过度扁平可能削弱当前任务边界；长文本需验证滚动与粘性动作；结构线不能退化为装饰。 Exact browser evidence covers this candidate's initial states at 320 × 844 with browser text at 200%, plus terminal iOS- and Android-framed 390 × 844 interaction states. Those checks found no horizontal overflow or CTA/navigation overlap, met the 44px iOS / 48px Android active-control floors, and kept multiple choice 2 × 2. No 1024px or tablet-grade evidence exists for mvn-02. Contrast, native safe-area, IME, reduced-motion, VoiceOver/TalkBack, physical-device, and real native text-scaling verification remain open.

## Design Review Checklist Answers

Q1: The proof uses 当前馆 as the sole identity context;
only one brand/action hue is strong in Learning and the open Space path.
Sibling馆 colors appear only as narrow identity markers inside Space and remain below task/action weight. Mint and amber remain
small, labeled flip feedback roles.

Q2: 无外框的连续内容画布与左侧细强调线；词项和例句本身成为焦点。 The first-read path is 细进度线 → 题干 → 明确作答区 → 底部确认 → 行内解释 → 下一张，视觉 chrome 几乎退出首读。 A grayscale rendering must
preserve that order before color is considered.

Q3: 五类交互依靠工作区形状区分，而不是统一卡壳：2×2 网格、竖向锁列、可撤销句段、单对象滑动和揭示面。 Audio remains an explicit resource control and never
becomes a sixth silhouette.

Q4: 无渐变文字、游戏化装饰或大面积语义色。底部导航遵循平台构图而非旧胶囊；候选不使用衬线，也不以黑白灰替代品牌色。

Q5: Exact browser reflow/target evidence covers initial states at 320 × 844 with browser text at 200%; the 80-case cohort method is recorded in `../browser-evidence.md#narrow-200-final`. Terminal iOS- and Android-framed 390 × 844 states also passed the recorded overflow, CTA/navigation, active-control-floor, and 2 × 2 multiple-choice checks. mvn-02 has no 1024px/tablet-grade or native acceptance evidence; contrast, safe-area, IME, VoiceOver/TalkBack, reduced-motion, physical-device, and real native text scaling remain open.

Q6: The rendered Learning path is system-sequenced and offers no module picker.
Flip result exposes exactly `有把握` and `再回看`; Statistics uses tabular
figure intent and a quiet daily ledger rather than a gamified dashboard.
