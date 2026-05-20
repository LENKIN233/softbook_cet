# Learning Card Rhythm Directions v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`

## Product Truth

Learning 是 system-sequenced single-card flow。用户每次处理一个 CET 知识对象，系统负责推进顺序；用户不应被要求管理模块、工程状态、数据来源或复杂统计。

本方向稿不修改 `spec/interactions.json`，也不授权 RN 实现。它只比较 Learning 单卡从进入、作答、揭示、记录到继续的状态节奏。

## Implementation Hypothesis

当前最需要被设计 harness 收紧的不是新视觉风格，而是单卡状态节奏：哪些信息先出现，哪些工具保持次级，哪些状态不能把工程词暴露给用户。

所有方向默认继承 `Addressed Exam Object`：

- 当前卡是第一读对象；
- 当前 library 只能有一个强 accent；
- `peek`、`hint`、`favorite` 是轻工具；
- `hint_layer` 是附着层，不是独立卡型；
- flip 只出现 `有把握` / `再回看` 两档自评，其中 `有把握 = mint` / confident，`再回看 = amber` / review；
- auto-scored interactions 不要求自评；
- address aperture 解释位置，但不变成模块选择。

## Direction A: Exam Page Rhythm

### Aesthetic Thesis

把单卡节奏做成一页可信考试资料的首读节奏：先读题与知识信号，再操作，最后看解析和下一步。

### First-Read Path

```text
library chip -> exam prompt -> interaction task -> analysis/reveal -> next
```

### Focal Object

当前考试题面。空间地址像页边索引，存在但不抢首读主线。

### State Rhythm

1. Orient: 显示当前 CET session、library 和一个短学习目标。
2. Act: 根据 interaction silhouette 展示操作区。
3. Reveal: 显示正确性或解析，保持资料页权威感。
4. Commit: 轻量确认本次结果已记录。
5. Continue: 下一张卡或进入 Space 查看位置。

### Strength

最能建立考试信任，适合承载高质量解析和易错点。

### Failure Risk

空间感容易退化成页边目录；如果 address 只是 breadcrumb，Learning 会像普通刷题页。

## Direction B: Addressed Object Rhythm

### Aesthetic Thesis

把单卡节奏做成一个有地址的知识物件被递到用户面前：用户先处理物件，再短暂看到它的位置和状态变化。

### First-Read Path

```text
current object -> interaction affordance -> support layer -> record/position response -> next object
```

### Focal Object

当前 addressed card。内容、操作、hint、peek 和位置反馈都围绕同一个对象，不拆成多个同权面板。

### State Rhythm

1. Place: 系统把当前对象放到主舞台，露出 current library accent 和轻地址。
2. Focus: 用户只看当前 interaction 所需信息。
3. Support: `hint` 或 `peek` 从对象边缘出现，帮助理解但不替代作答。
4. Resolve: auto-scored interaction 给出 answer reveal；flip 给出两档轻自评。
5. Settle: 结果以位置/复习节奏反馈落回这个对象，不暴露同步、缓存或数据源。
6. Continue: 下一个对象进入；Space continuation 仍是次级入口。

### Strength

最贴合软书差异化：卡片不是普通题目，而是有归属、可操作、会移动的知识对象。

### Failure Risk

如果物件感过强，可能压过考试内容；如果 settle 状态说得太多，可能重新变成系统状态展示。

## Direction C: Fast Action Rhythm

### Aesthetic Thesis

把单卡节奏压缩成极低负担的连续操作：读、做、看结果、下一张，尽量减少中间解释。

### First-Read Path

```text
task -> answer gesture -> result -> next
```

### Focal Object

当前动作。空间和资料权威都退为辅助，用户几乎不需要理解系统结构。

### State Rhythm

1. Start: 直接给任务。
2. Act: 操作区最大化。
3. Result: 正误或解析最短路径出现。
4. Advance: 自动引导下一张。

### Strength

最快、最轻、最适合碎片时间。

### Failure Risk

最容易变成普通练习 App。空间地址、知识归属和考试资料质感都会被压扁。

## Comparative Judgment

| Criterion | A Exam Page | B Addressed Object | C Fast Action |
|---|---:|---:|---:|
| CET exam trust | 5 | 4 | 3 |
| Physical-space continuity | 3 | 5 | 2 |
| Low operation burden | 4 | 4 | 5 |
| Avoids generic flashcard/drill | 4 | 5 | 2 |
| Keeps content first | 5 | 4 | 3 |
| Prevents system/meta leakage | 4 | 5 | 4 |
| Best as accepted rhythm | maybe | yes | no |

## Direction To Accept

Accept Direction B as `Guided Addressed Card Rhythm`, constrained by:

- Direction A's exam-page authority for prompt and analysis hierarchy.
- Direction C's fast-action discipline for not over-explaining system state.

## What This Rejects

- Any state rhythm where the user first sees module choice, data source, sync queue, cache state, internal identifiers or engineering labels.
- Any rhythm where `peek`, `hint`, `favorite`, stats, or Space entry compete with the primary interaction.
- Any reveal that turns auto-scored interactions into manual mastery judgement.
- Any motion or copy that celebrates completion like a game-style reward.

## Design Review Checklist Answers

Q1: The accepted direction inherits one current library accent only.

Q2: Focal object is the current addressed card. First-read path is current object -> interaction -> support/reveal -> continue.

Q3: The rhythm preserves interaction silhouettes from `visual-language.json#interaction_silhouettes`.

Q4: This prose artifact introduces no visual forbidden pattern and explicitly rejects game chrome and metadata copy.

Q5: Not applicable; no rendered phone frame is included.

Q6: Learning-specific rules are preserved: flip has exactly two self-assess pills, with `有把握 = mint` / confident and `再回看 = amber` / review; module selection is not primary.
