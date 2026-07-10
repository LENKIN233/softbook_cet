# Learning + Space Worldview

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`

## Product Truth

`learning` 和 `space` 必须是同一个世界观的两个面。

- `learning` 是用户每天推进的一张当前卡。
- `space` 是这张卡所在的知识坐标系。
- 卡片不是无根内容块；它来自 library / group / box / card 层级。
- 用户不是系统管理员；用户只做低负担学习动作和有限空间动作。
- 收藏是 tag，不是盒子；sleep 是影响学习流的空间状态，不是收藏夹。

## Design Thesis

软书的核心隐喻是：

> 一本有空间坐标的考试手册。

学习不是刷题瀑布流，而是翻阅一张被系统递到眼前的考试知识卡。空间不是目录页，而是这张卡背后的知识地图：它显示出处、位置、邻近关系和可被轻度调整的状态。

## Product Personality

应当像：

- 一本可信的 CET 备考手册
- 一张可操作的知识地图
- 一个安静的学习舱
- 一套有位置感的知识档案

不应当像：

- 背单词打卡工具
- 游戏化成就系统
- SaaS 数据 dashboard
- 课程平台首页
- 纯视觉实验或玻璃皮肤 demo

## Shared World Rules

### Rule 1: Card Has Address

每张卡都应该让人感觉它有地址。

地址不是每屏都完整展示，但用户应能在必要时理解：

```text
CET track -> library -> group -> box -> card
```

Learning 只露出轻量位置线索；Space 展开完整结构。

### Rule 2: One Current Object

Learning 的当前对象是当前卡。Space 的当前对象是当前卡所在区域。

屏幕不应该同时让多个卡、多个盒、多个统计指标抢主焦点。

### Rule 3: System Leads, User Nudges

系统负责排序、推进和默认位置。用户只做低负担动作：

- peek
- favorite
- hint reveal
- confident / review
- enter space
- inspect box
- move into / out of sleep

### Rule 4: Space Explains, Not Distracts

Space 的价值不是让用户自由整理，而是让用户理解知识归属和学习状态。

Space 应该回答：

- 我现在在哪个知识区域？
- 这张卡为什么属于这里？
- 哪些内容暂时被 sleep 影响？
- 我的轻动作怎样影响后续学习？

### Rule 5: Exam Trust Beats Novelty

创意必须服务考试信任。任何让产品像玩具、活动页或泛娱乐 App 的设计，即使漂亮，也不进入 accepted direction。

## Learning Surface

### Experience Goal

用户打开后不用选择模块，不用管理计划，只需要进入当前卡并完成一个低负担动作。

### Information Goal

必须可见：

- 当前卡的考试内容
- 当前交互动作
- 轻量知识位置
- peek / favorite / hint 的次级入口
- 学习后反馈或下一步

不应突出：

- 复杂统计
- 模块选择
- 大量算法解释
- 手动整理空间

### First-Read Path

```text
card content -> primary interaction -> light feedback / next card -> position hint
```

### Focal Object

当前卡。卡不是普通白色容器，应像一个可被翻阅、揭示、移动到空间中的知识物件。

### Emotional Target

安静、可信、被带着走。

用户应感觉：

> 我现在只要处理这一张，系统知道它为什么重要。

## Space Surface

### Experience Goal

用户看到当前卡在知识地图中的位置，并能做少量不会破坏知识归属的动作。

### Information Goal

必须可见：

- library / group / box / card 层级
- 当前卡位置
- box contents
- favorite tag
- sleep zone / wake action

不应突出：

- 任意拖拽整理
- 自定义知识体系
- 收藏盒替代知识盒
- 复杂统计热力图

### First-Read Path

```text
current position -> parent structure -> available low-cost operation -> return to learning
```

### Focal Object

当前卡所在的 box 或当前卡在地图中的位置。

### Emotional Target

清楚、有秩序、可探索但不需要管理。

用户应感觉：

> 这些知识是有位置的，我可以理解它们在哪里，但不用负责维护整张地图。

## Relationship Between Learning And Space

Learning 是空间中的前景物件。Space 是 Learning 的背景坐标。

两者的转换应该像：

- 从卡片正面抬头看见它所在的书架
- 从当前题目进入它背后的知识位置
- 从单点学习退一步看到结构

不应该像：

- 从学习 App 切到另一个管理工具
- 从卡片页跳到收藏夹
- 从题目页进入数据仪表盘

## Candidate Direction Seeds

后续 `directions/` 至少展开三个方向：

### Direction A: Editorial Exam Card

考试资料权威感最强。卡像精修讲义页，空间像目录索引与章节书架。

风险：可能过于传统，空间差异化不够强。

### Direction B: Knowledge Object

卡像可翻转、可拿起、可归档的知识物件。空间像卡片的真实坐标系。

风险：材料感过强会压过内容，容易变成视觉 demo。

### Direction C: Focus Console

行动效率最强。当前卡、当前动作、下一步反馈清楚，空间以轻量 overlay 或 drill-in 展示。

风险：容易滑向 SaaS 工具或普通练习 App。

## Rejected Premises

### Game Board

拒绝原因：会削弱考试信任，把学习动机错误地转成成就刺激。

### Dashboard Learning

拒绝原因：会把核心体验从“推进这一张卡”转成“管理学习系统”。

### Flashcard Stack Only

拒绝原因：太接近普通背单词工具，空间产品差异化消失。

### Freeform Knowledge Garden

拒绝原因：过度自由整理会违反 algorithm primary + partial user control。

## Design Review Checklist Answers

Q1: 当前 worldview 不绑定单一 library。后续单屏方向稿必须指定 current library，并遵守 Law of One。

Q2: 当前 worldview 的焦点是“有空间地址的当前卡”。首读路径是 card content -> primary action -> position context。

Q3: 当前 artifact 不是具体 interaction screen。后续 Learning 方向稿必须分别映射 flip / multiple_choice / lock / elimination / swipe 的 silhouette。

Q4: 当前 artifact 不产生视觉稿，无 forbidden design pattern。

Q5: 不适用。未渲染 phone frame。

Q6: 已声明 Learning 不能以模块选择为主路径；flip 的 2 档自评在后续方向稿中必须保留。

## Next Artifact

下一步不是 RN 实现，而是：

`docs/design/directions/learning-surface-3-directions.md`

每个方向必须给出不同的构图逻辑、交互隐喻、状态语言和失败风险。
