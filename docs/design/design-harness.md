# 软书四六级 Design Harness

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`

## Product Truth

软书四六级不是“好看的学习 App”。它是一个面向 CET4/6 备考的低负担知识操作系统：用户被温和但坚定地带着前进，知识卡有考试价值、空间归属和可操作状态。

设计 harness 的目标不是让 AI 直接生成 UI，而是让 AI 在一个有审美命题、方向竞争、失败沉淀和工程保真的系统里工作。

## Implementation Hypothesis

当前 RN 界面只作为行为原型与 smoke harness。任何用户可见 UI 实现都必须来自已接受设计 artifact；实现不能反向定义设计。

## 三层 Harness

### Design Quarantine Harness

Design Quarantine 负责阻断含元信息泄露或用户不可操作的设计内容。它先于审美判断和实现映射执行。

隔离规则在 `docs/design/design-quarantine.md`。任何 artifact 如果把 agent、harness、spec、validator、metadata、runtime、mock、prototype、seed、fixture、debug、dev、raw exception、API route、repo path 或 TODO 之类内部语义放入用户可见层，就不能作为 implementation authority。

隔离状态：

- `accepted_authority`：可以被 implementation PR 消费。
- `candidate_exploration`：可以参考，不能背书实现。
- `quarantined`：必须先修复和复审。
- `rejected`：保留为失败资产。

### Single-Card UX Contract Gate

单卡流不是“一屏塞满”。它必须是用户可操作的 focused flow。

合同在 `docs/design/single-card-ux-contract.md`。Learning 或核心交互设计必须声明 current card、primary task、primary action、secondary actions、feedback state、escape or recovery、Learning ↔ Space continuity。

如果一个设计只是一张漂亮但不可操作的一屏展示稿，不能作为用户可见 UI 实现依据。

### Creation Harness

Creation harness 负责产生有差异的方向，不负责批准实现。

输入：

- 产品真相与相关 spec
- 目标 surface
- 审美命题
- 参考类型，不是复制对象
- 反方向约束

输出：

- surface brief
- 3 个方向稿
- 每个方向的世界观、构图骨架、交互隐喻、失败风险
- rejected directions 初稿

禁止：

- 直接输出 RN 组件树
- 直接进入 token 微调
- 把现有 RN 截图当视觉权威
- 用“现代、简洁、高级”这类空泛词替代设计判断

### Judgment Harness

Judgment harness 负责杀掉平庸方向。

每个方向必须回答：

- 是否一眼知道下一步？
- 是否降低考试焦虑？
- 是否像 CET 备考产品，而不是泛英语工具？
- 是否避免普通背单词卡感？
- 是否保留物理空间的差异化？
- 模糊截图后，是否还能认出它属于软书？
- 是否能扩展到 phone / tablet / pc web？
- 是否会让后续内容生产变重？

评价顺序：

1. 产品真相
2. 审美命题
3. 交互清晰度
4. 信息负担
5. 视觉系统一致性
6. 工程可映射性

### Design Evolution Engine

Design Evolution Engine 负责在核心 surface 进入 accepted artifact 之前，让 AI 通过受约束搜索逼近更符合需求的设计内容。它不替代 Creation / Judgment / Delivery，而是把 Creation 和 Judgment 连接成可迭代的优化循环。

核心循环：

```text
constraints
  -> generate candidate population
  -> hard-filter product and layout violations
  -> pairwise-rank surviving candidates
  -> harvest strongest fragments
  -> apply targeted mutations
  -> repeat until a candidate beats the accepted baseline
  -> promote one accepted artifact
  -> sediment failures back into the harness
```

使用条件：

- 新核心 Learning / Space / interaction / motion / platform surface；
- 重大 redesign；
- 现有 artifact 只有单稿或证明不足，不能支撑高信心实现；
- 需要比较 Codex / Figma Make / Stitch / v0 / external design file 等 AI 设计产出质量。

禁止：

- 把第一轮生成稿直接当 accepted artifact；
- 用单一 aesthetic score 代替 pairwise review；
- 用 "make it better" 这类空泛 prompt 代替 targeted mutation；
- 只选 winner 而不记录 borrowable fragments / rejected fragments；
- 让 search-run 中间稿授权同 PR 用户可见 UI 实现。

Design Evolution Engine 的记录格式在 `docs/design/search-runs/README.md`。完整 run 至少需要 context pack、8 个候选、pairwise reviews、fragment harvest、mutation log、promotion record 与 rendered proof / external prototype 证据。

### Delivery Harness

Delivery harness 负责保真，不负责创造。

进入 RN 之前必须存在：

- accepted design artifact
- quarantine status showing the artifact is not blocked
- implementation mapping
- unimplemented design gaps
- single-card UX contract answers for Learning or core interaction UI
- design review checklist answers
- token / canon delta if any

同一 PR 中同时提交 design brief 和 RN 实现时，design brief 不应自动视为 accepted artifact。设计-only PR 可以创建 artifact；implementation PR 只能消费已接受 artifact，除非用户明确批准例外。

## 产品能力设计系统

软书设计不能按通用 UI 分类平铺。每个 design artifact 必须说明它服务哪个产品能力系统：

1. Learning 推进系统
   用户如何被系统带着处理当前卡，而不是自己管理模块、计划或统计。

2. Card / Content 表达系统
   CET 题干、解析、易错点、hint、音频和背面内容如何成为考试知识卡。

3. Interaction + Motion 系统
   `flip` / `multiple_choice` / `lock` / `elimination` / `swipe` / `hint_layer` 的操作模型、反馈模型、失败态、小动画和 reduce-motion fallback。

4. Physical Space 系统
   library / group / box / card 的空间结构、当前卡地址、box inspect、favorite tag、sleep / wake，以及 Learning ↔ Space 连续关系。

5. Surface Experience 系统
   Learning、Space、Stats、Mine、Paywall、Auth 等页面如何承载上层产品能力。

6. Visual Language 系统
   Aurora Glass、Law of One、学科色、材料、排版和 forbidden patterns。它统一气质，但不能替代 surface / interaction / space 设计。

7. Platform Adaptation 系统
   phone / tablet / pc web 的布局、输入和信息架构差异。

8. Implementation Mapping 系统
   accepted artifact 如何映射到 RN / Web，哪些 gap 未实现。

如果一个 artifact 只描述“好看的界面”，但不能说明它服务哪个产品能力系统，它不合格。

## Design Artifact Lifecycle

1. `briefs/`
   定义 surface 世界观、用户体验、信息目标、反方向。

2. `directions/`
   记录多个互相竞争的方向。方向必须真实不同，而不是换配色。

3. `decisions/`
   记录为什么选一个方向，为什么拒绝其他方向。

4. `search-runs/`
   保存 Design Evolution Engine 的 context pack、candidate population、pairwise review、fragment harvest、mutation log、promotion record 和 rendered proof。它是 accepted artifact 之前的优化证据，不直接授权 implementation PR。

5. `rejected/`
   保存失败方向和失败理由。失败资产是 harness 的一部分。

6. `mapping/`
   把 accepted design artifact 映射到 RN、Web 或其他实现。

7. `interaction-motion/`
   定义核心交互的操作、反馈、失败态、小动画、可中断性和 reduce-motion fallback。

8. `physical-space/`
   定义空间模型、层级、位置状态、favorite tag、sleep / wake 和 Learning ↔ Space 连续性。

9. `mocks/`
   保存核心 surface / state 的可渲染视觉稿或外部设计稿索引。核心 UI 实现不能只靠 prose direction 声称高审美完成。

10. `storyboards/`
   保存交互、动效、空间转场和状态变化的 storyboard。

11. `design-quarantine.md`
    定义哪些 artifact 因元信息泄露、用户可见内部术语或不可操作 framing 被隔离。

12. `single-card-ux-contract.md`
    定义单卡流的可操作结构，防止把 single-card flow 误画成一屏信息海报。

`task-local design brief` 只能作为探索草稿；它不能作为 implementation PR 的正式设计权威。核心 UI implementation PR 必须消费已存在的 accepted artifact，并声明 mapping 与 gap。

## 软书的审美命题

主命题：

> 让考试资料拥有空间感，让知识卡成为可操作物，让学习推进像翻阅一本有生命的备考书。

它同时要求：

- 考试信任：像可信资料，不像游戏或营销页。
- 低负担推进：下一步明确，不让用户管理系统。
- 空间差异化：知识不是列表，而是有位置、归属、移动和痕迹。
- 克制材料感：材料服务内容，不喧宾夺主。

## 方向竞争规则

每个核心 surface 至少产出 3 个方向：

- 一个偏内容权威
- 一个偏空间物件
- 一个偏效率操作

方向稿必须包含：

- aesthetic thesis
- first-read path
- focal object
- interaction silhouette
- state language
- what it rejects
- why it can belong to 软书

如果该 surface 进入 Design Evolution Engine，方向竞争升级为 candidate population：至少 8 个候选、同一 context pack、硬约束过滤、pairwise review、fragment harvest 与 targeted mutation。3 个方向仍是最低探索下限，不足以证明重大 redesign 已经逼近最佳方案。

## 创意突破规则

允许突破现有 token 或 canon，但必须写清：

- 为什么现有规则不够
- 突破只适用于哪个 surface 或状态
- 如何验证它没有破坏产品真相
- 回滚条件
- 是否需要沉淀进 `spec/visual-language.json` 或 `docs/design/canon.md`

没有这些解释的突破只是漂移。

## 合格输出标准

一个 design artifact 合格，不是因为它漂亮，而是因为它让后续判断更少依赖个人口味。

合格 artifact 必须让读者知道：

- 这是什么产品人格
- 为什么这个 surface 必须长这样
- 用户第一眼看哪里
- 用户下一步做什么
- 哪些方向已经被明确拒绝
- 实现时哪些偏差会改变设计本意
