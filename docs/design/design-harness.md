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

### Delivery Harness

Delivery harness 负责保真，不负责创造。

进入 RN 之前必须存在：

- accepted design artifact
- implementation mapping
- unimplemented design gaps
- design review checklist answers
- token / canon delta if any

同一 PR 中同时提交 design brief 和 RN 实现时，design brief 不应自动视为 accepted artifact。设计-only PR 可以创建 artifact；implementation PR 只能消费已接受 artifact，除非用户明确批准例外。

## Design Artifact Lifecycle

1. `briefs/`
   定义 surface 世界观、用户体验、信息目标、反方向。

2. `directions/`
   记录多个互相竞争的方向。方向必须真实不同，而不是换配色。

3. `decisions/`
   记录为什么选一个方向，为什么拒绝其他方向。

4. `rejected/`
   保存失败方向和失败理由。失败资产是 harness 的一部分。

5. `mapping/`
   把 accepted design artifact 映射到 RN、Web 或其他实现。

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
