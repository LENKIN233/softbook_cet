---
authority: agent_entrypoint
audience:
  - agent
load_when:
  - every active task
depends_on:
  - spec/doc-manifest.json
status: active
---
# 软书四六级 Agent 入口

## 产品一句话

软书四六级是一个面向中国大学生的 CET4/6 备考产品：用单卡流、高价值交互和物理空间知识地图，让用户更轻松地通过考试。

## 活跃源

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/doc-manifest.json`
- `spec/visual-language.json`（视觉实现假设锚，绑定 `docs/design/visual-reference.html`、`docs/design/canon.md` 与 `docs/design/design-harness.md`）
- 同级外部内容工作区：`/Users/lenkin/programing/card make`（卡片候选内容生产与审批边界；本仓库只消费其导出的卡片 payload）

## 读取顺序

- 原始需求校准：`requirement-memory`
- 权威定位：`authority-map`
- 产品/范围：`requirement-memory -> product-core`
- 认证/同步/购买：`requirement-memory -> account-sync-contract -> membership -> runtime-boundaries`
- 多端/端形态：`requirement-memory -> product-core -> platform-contract -> runtime-boundaries`
- 卡片/交互：`requirement-memory -> product-core -> action-surface -> card-system -> interactions`
- 卡片内容交接：`requirement-memory -> product-core -> card-system -> box-catalog -> runtime-boundaries -> agent-harness -> infra/cloudbase/mobile-runtime-contract.md -> /Users/lenkin/programing/card make`
- 物理空间/盒码：`requirement-memory -> product-core -> knowledge-map -> space-operations -> box-catalog`
- 会员/试用：`requirement-memory -> product-core -> membership`
- 交付 / PR / CI：`authority-map -> agent-harness -> repo-delivery-contract -> evals`
- 工作区边界 / agent 默认读取：`authority-map -> workspace-boundary -> agent-harness -> repo-delivery-contract -> evals`
- 视觉输出/设计反推：`requirement-memory -> 相关产品 spec -> visual-language -> docs/design/design-harness.md -> docs/design/visual-reference.html`
- 交互 / 动效设计：`requirement-memory -> product-core -> interactions -> visual-language -> docs/design/design-harness.md -> docs/design/interaction-motion/README.md -> docs/design/storyboards/README.md`
- 物理空间设计：`requirement-memory -> product-core -> knowledge-map -> space-operations -> box-catalog -> visual-language -> docs/design/design-harness.md -> docs/design/physical-space/README.md`
- 用户可见 UI 实现：`requirement-memory -> 相关产品 spec -> visual-language -> 已接受设计稿 -> interaction/motion 或 physical-space artifact（如适用） -> implementation mapping -> runtime-boundaries`
- 实现：相关产品 spec -> 合同 spec -> `runtime-boundaries`（若需渲染用户可见 UI，追加 `visual-language`、已接受设计稿与 implementation mapping）
- 审查/验收：相关 spec -> `agent-harness` -> `evals`

## 硬约束

- 不要把产品写成泛英语教学系统或背单词工具
- 不要把物理空间缩成收藏/休眠二盒展示
- 不要把提示层写成独立卡型
- 不要把音频写成独立交互家族
- 不要把统计、计数器、复杂状态机写成产品核心
- 不要在 `softbook_cet` 内生产候选卡片内容、批准卡片批次或把 dev seed cards 当作正式内容量；候选内容生产和审批发生在同级 `/Users/lenkin/programing/card make`，本仓库只接收其导出的 payload、dry-run/import、audit、runtime smoke 和报告 coverage delta
- 不要默认读取 `archive/legacy-v3/` 或 `archive/transitional-vnext-prose/` 作为活跃真相源
- 不要默认把 generated / dependency / cache / machine-local / archive / external workspace 当作 agent 语义上下文；先按 `spec/workspace-boundary.json` 分类，再决定是否读取
- 不要为每个屏幕/每个 agent 各自重造视觉语言；视觉输出必须从 `spec/visual-language.json` 与 `docs/design/visual-reference.html` 继承 token 与剪影
- 不要直接用 RN 代码、截图或 agent 个人审美定义用户可见设计；任何呈现给用户的 screen / component / state / chrome 都必须先有已接受设计稿或等价设计基准，再进入实现
- 不要用同一 PR 内新增 / 修改的 design brief、direction 或 decision 为同一 PR 的用户可见 UI 实现背书；同 PR 设计稿只适用于 design-only PR
- 不要把 task-local design brief 当作 implementation PR 的正式设计权威；它只能作为探索草稿
- 不要把核心交互 / 小动效当作 UI 完成后的装饰；Learning 或核心交互实现必须先有 interaction/motion artifact 或 storyboard
- 不要把物理空间当作普通页面 UI；Space 实现必须先有 spatial model / state transition / Learning ↔ Space 连续性 artifact
- 不要在产出任何视觉稿（mock / screen / reference HTML 改动）后跳过 `spec/visual-language.json#design_review_checklist`；答案必须出现在 PR 描述或 agent 输出里，4 通用 + 2 条件（AP-22 / VL-AP-07）
- 不要把 self-assess 画成 4 档或用红色表达"再回看"；权威实现在 `apps/mobile/src/learning/LearningSurface.tsx`，2 档=有把握(mint)/再回看(amber)（AP-23）

## 工程治理约束

- `main` 是只读集成分支，不要直接在 `main` 上开发、提交、合并或推送
- 开发前先切到 `infra/*`、`shell/*`、`module/*`、`cross/*` 或 `fix/*`
- clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`
- 若发现本地 hooks 或 GitHub `main` 保护漂移，先修治理再继续功能开发
- 任何会持久化仓库改动的任务，除非用户明确要求只做本地修改，否则默认在 topic branch 上完成提交、开/更新指向 `main` 的 PR，并在 agent review 通过、PR 描述记录 passed review 且 required gates 全绿后自动合并
- 未完成 agent review、PR 描述未记录 passed review、required gates 未全绿，或权限/环境阻止 merge 时，不要提前合并到 `main`
- 如果权限或环境阻止创建 PR，必须明确交付 branch、commit、验证结果与阻塞原因

## 输出要求

- 先指出当前任务引用了哪些 spec
- 若任务会影响产品定义，先用 `spec/requirement-memory.json` 对齐原始需求
- 如果多个 spec 出现同一概念，严格以 `spec/authority-map.json` 指定的 owner 为准
- 默认只读完成任务所需的最小 spec 子集；只有跨域耦合或明确冲突时才升级读取范围
- 明确区分 `product_truth` 与 `implementation_hypothesis`
- 如果新增交互、盒码或访问规则，先更新对应 spec，再给结论
- 若任务包含持久化仓库改动，PR 描述必须包含引用 spec、变更摘要、验证、Agent review；若涉及用户可见 UI，必须写明设计稿来源、interaction/motion 或 physical-space artifact（如适用）、实现映射与未实现 gap，并回答 design review checklist；默认在 review + gate 通过后自动收口合并

## 压缩保留

- `spec/requirement-memory.json`
- `spec/workspace-boundary.json`
- 当前任务依赖的 spec 文件
- 当前关键决定与未决点
- 会员/试用结构
- 核心交互和空间语义
- `card make` 外部内容工作区边界
- 已修改文件列表
