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
- `spec/harness-architecture.json`
- `spec/harness-architecture.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`（仅在认证、账号删除、session revocation 或 SMS runtime 任务中读取；账号删除 worker、receiver timer 与真实删除演练边界以此为准）
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`（仅在 CET4 正式封闭内测 candidate、gate、receiver evidence、真机验收或 readiness 状态任务中读取；其 `ready` 不替代正式产品 launch readiness）
- `spec/release-operational-policy.json`（仅在上线证据、外部账号 capability、SLO、备份恢复、渗透或回滚演练任务中读取；定义不得降低的正式证据阈值、外部控制面检查、gate 非替代与模拟非正式边界）
- `infra/cloudbase/learning-events-v2-runtime-contract.md`（仅在 learning events 合同或实现任务中读取；当前为仓库内已实现、未部署的 runtime 边界）
- `infra/cloudbase/learning-session-v1-runtime-contract.md`（仅在服务端调度或 learning session 任务中读取；当前为仓库内已实现、移动端未接线且未部署的 runtime 边界）
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`（仅在音频资源、内容 manifest 或私有下载任务中读取；当前为后端、移动解析、原生缓存与显式播放适配已在仓库实现，但私有资源真机验证、发布 key 注入与部署未完成的 runtime 边界）
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`（仅在独立交付、正式内容发布、回滚或空白环境重建任务中读取；当前为 profile/bundle 校验、接收方 CloudBase adapter、统一交付命令、publisher 编排与仓库内模拟演练已实现，接收方正式演练未完成的 runtime 边界）
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`（仅在 CET4 受控产品试点的 120 卡 bundle、批准、音频 QC、运行模式或发布任务中读取；全部 artifact 均 `gate_eligible=false`，当前主线仅实现仓库内校验、发布排序与 runtime-mode 内容权威，接收环境和试点专用体验未部署）
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`（仅在封闭内测会员资格发放、撤销或审计任务中读取；当前为仓库内运维命令与服务端叠加读取已实现、接收方环境未执行的 runtime 边界）
- `infra/cloudbase/space-actions-v2-runtime-contract.md`（仅在物理空间 action、同步或调度联动任务中读取；当前为仓库内已实现、未部署的 runtime 边界）
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/doc-manifest.json`
- `spec/visual-language.json`（视觉实现假设锚，绑定 `docs/design/visual-reference.html`、`docs/design/canon.md` 与 `docs/design/design-harness.md`）
- 同级外部内容工作区：`/Users/lenkin/programing/card make`（卡片候选内容生产与审批边界；本仓库只消费其导出的卡片 payload）

## 读取顺序

- 原始需求校准：`requirement-memory`
- 权威定位：`authority-map`
- 产品/范围：`requirement-memory -> product-core`
- 认证/同步/购买：`requirement-memory -> account-sync-contract -> membership -> runtime-boundaries`（实现账号删除或 auth/session runtime 时追加 `infra/cloudbase/auth-v2-runtime-contract.md`；实现 learning events 时追加 `infra/cloudbase/learning-events-v2-runtime-contract.md`；实现物理空间同步时追加 `infra/cloudbase/space-actions-v2-runtime-contract.md`）
- 服务端学习调度：`requirement-memory -> product-core -> account-sync-contract -> membership -> runtime-boundaries -> infra/cloudbase/learning-events-v2-runtime-contract.md -> infra/cloudbase/learning-session-v1-runtime-contract.md`
- 物理空间 action 同步：`requirement-memory -> product-core -> account-sync-contract -> knowledge-map -> space-operations -> box-catalog -> runtime-boundaries -> infra/cloudbase/space-actions-v2-runtime-contract.md`
- 多端/端形态：`requirement-memory -> product-core -> platform-contract -> runtime-boundaries`
- 卡片/交互：`requirement-memory -> product-core -> action-surface -> card-system -> interactions`
- 音频资源：`requirement-memory -> product-core -> platform-contract -> card-system -> interactions -> runtime-boundaries -> infra/cloudbase/content-manifest-v1-runtime-contract.md`
- 卡片内容交接：`requirement-memory -> product-core -> card-system -> box-catalog -> runtime-boundaries -> agent-harness -> infra/cloudbase/mobile-runtime-contract.md -> /Users/lenkin/programing/card make`
- 物理空间/盒码：`requirement-memory -> product-core -> knowledge-map -> space-operations -> box-catalog`
- 会员/试用：`requirement-memory -> product-core -> membership`（涉及封闭内测资格发放、撤销或审计时追加 `account-sync-contract -> runtime-boundaries -> infra/cloudbase/beta-entitlement-v1-runtime-contract.md`）
- CET4 受控试点：`requirement-memory -> product-core -> account-sync-contract -> membership -> runtime-boundaries -> infra/cloudbase/learning-session-v1-runtime-contract.md -> infra/cloudbase/content-manifest-v1-runtime-contract.md -> infra/cloudbase/controlled-pilot-v1-runtime-contract.md`（正式发布非替代校验追加 `infra/cloudbase/release-bundle-v1-runtime-contract.md`）
- CET4 正式封闭内测 readiness：`requirement-memory -> product-core -> account-sync-contract -> membership -> runtime-boundaries -> cet4-closed-beta-readiness -> release-operational-policy -> infra/cloudbase/release-bundle-v1-runtime-contract.md -> agent-harness -> repo-delivery-contract -> evals`
- 交付 / PR / CI：`authority-map -> agent-harness -> repo-delivery-contract -> evals`（涉及接收方环境、正式内容发布或回滚时追加 `runtime-boundaries -> infra/cloudbase/release-bundle-v1-runtime-contract.md`）
- 上线证据 / 外部账号 capability / SLO / 恢复演练：`authority-map -> account-sync-contract -> runtime-boundaries -> release-operational-policy -> infra/cloudbase/release-bundle-v1-runtime-contract.md -> agent-harness -> repo-delivery-contract -> evals`
- Agent run records / context handoff：`authority-map -> agent-run-record -> workspace-boundary -> harness-architecture -> agent-harness -> repo-delivery-contract -> evals`
- 工作区边界 / agent 默认读取：`authority-map -> workspace-boundary -> agent-harness -> repo-delivery-contract -> evals`
- Harness 架构 / validator 分层：`authority-map -> harness-architecture -> workspace-boundary -> agent-harness -> repo-delivery-contract -> evals`
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
- 不要把 truth/workspace 纯检查、delivery 远端治理、design fixture 回归和 runtime smoke 混在同一 harness 层；按 `spec/harness-architecture.json` 分层
- 不要把 `scripts/run_local_gates` 的本地报告当作 GitHub required checks、Agent review、正式内容批准或 launch readiness；`dev` / `pr` / `release` profile 与 `local-gate-report.v1` 以 `spec/harness-architecture.json#local_gate_runner_contract` 为准
- 不要把仓库内存模拟、dry-run、任意 JSON 或仅有路径/哈希的文件当作正式上线证据；gate evidence 必须匹配 `launch-release-candidate.v1` 的单一 commit/profile/environment/release/build cohort，通过已注册类型语义，且 outer/raw 只能引用 tracked + regular + size/SHA-256 重验的 `repo://` 文件（远端大文件先进入 `evidence-archive` 已验证 manifest）、commit 可从验证 HEAD 到达、执行窗口有效、操作者与复核者不同；availability 必须逐 route 记录并重算 probe，备份每个必需 source dataset 必须非空；未实现类型语义时 fail closed，模拟始终 `gate_eligible=false`
- 不要把 CET4 受控试点的 120 卡、60 卡 free 子集、pilot profile/bundle/release/entitlement/outcome report 当作正式封闭内测或 launch evidence；当前仓库开发卡源、candidate handoff、dry-run 和 runtime fixture 也不得计入 120 张正式批准卡
- 不要把 CET4 closed-beta readiness 的 `ready` 当作正式产品 launch readiness；它只覆盖精确 CET4 1,180 卡/108 盒/301 音频与其封闭内测 cohort，不降低 CET6、公开分发、支付、合规或 `docs/release/launch-readiness.v1.json` 的任何 gate
- 不要为每个屏幕/每个 agent 各自重造视觉语言；视觉输出必须从 `spec/visual-language.json` 与 `docs/design/visual-reference.html` 继承 token 与剪影
- 不要直接用 RN 代码、截图或 agent 个人审美定义用户可见设计；任何呈现给用户的 screen / component / state / chrome 都必须先有已接受设计稿或等价设计基准，再进入实现
- 不要用同一 PR 内新增 / 修改的 design brief、direction 或 decision 为同一 PR 的用户可见 UI 实现背书；同 PR 设计稿只适用于 design-only PR
- 不要把 task-local design brief 当作 implementation PR 的正式设计权威；它只能作为探索草稿
- 不要把核心交互 / 小动效当作 UI 完成后的装饰；Learning 或核心交互实现必须先有 interaction/motion artifact 或 storyboard
- 不要把物理空间当作普通页面 UI；Space 实现必须先有 spatial model / state transition / Learning ↔ Space 连续性 artifact
- 不要在产出任何视觉稿（mock / screen / reference HTML 改动）后跳过 `spec/visual-language.json#design_review_checklist`；答案必须出现在 PR 描述或 agent 输出里，4 通用 + 2 条件（AP-22 / VL-AP-07）
- 不要把 self-assess 画成 4 档或用红色表达"再回看"；权威实现在 `apps/mobile/src/learning/LearningSurface.tsx`，2 档=有把握(mint)/再回看(amber)（AP-23）

## 工程治理约束

- 不要把 PR 绑定的治理、harness、用户可见 UI、runtime、卡片交接或多文件重构工作只留在聊天历史里；必须按 `spec/agent-run-record.json` 在 `docs/agent-runs/` 提交最小运行记录并在 PR 中引用
- `main` 是只读集成分支，不要直接在 `main` 上开发、提交、合并或推送
- 若本地 `main` worktree 存在且干净，merge 后只允许 fast-forward 到 `origin/main`；不要把 stale local main 或 worktree lock 当成远端 merge 失败
- 开发前先切到 `infra/*`、`shell/*`、`module/*`、`cross/*` 或 `fix/*`
- clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`
- 若发现本地 hooks 或 GitHub `main` 保护漂移，先修治理再继续功能开发
- 任何会持久化仓库改动的任务，除非用户明确要求只做本地修改，否则默认在 topic branch 上完成提交、开/更新指向 `main` 的 PR，并在 agent review 通过、PR 描述记录 passed review 且 required gates 全绿后自动合并
- 未完成 agent review、PR 描述未记录 passed review、required gates 未全绿，或权限/环境阻止 merge 时，不要提前合并到 `main`
- 如果权限或环境阻止创建 PR，必须明确交付 branch、commit、验证结果与阻塞原因

## 输出要求

- 若任务属于 PR 绑定的治理、harness、用户可见 UI、runtime、卡片交接或多文件重构，输出/PR 必须引用已提交的 `docs/agent-runs/*.md` 运行记录
- 先指出当前任务引用了哪些 spec
- 若任务会影响产品定义，先用 `spec/requirement-memory.json` 对齐原始需求
- 如果多个 spec 出现同一概念，严格以 `spec/authority-map.json` 指定的 owner 为准
- 默认只读完成任务所需的最小 spec 子集；只有跨域耦合或明确冲突时才升级读取范围
- 明确区分 `product_truth` 与 `implementation_hypothesis`
- 如果新增交互、盒码或访问规则，先更新对应 spec，再给结论
- 若任务包含持久化仓库改动，PR 描述必须包含引用 spec、变更摘要、验证、Agent review 与 Agent run record；若涉及用户可见 UI，必须写明设计稿来源、interaction/motion 或 physical-space artifact（如适用）、实现映射与未实现 gap，并回答 design review checklist；默认在 review + gate 通过后自动收口合并

## 压缩保留

- `spec/requirement-memory.json`
- `spec/workspace-boundary.json`
- 当前任务依赖的 spec 文件
- 当前关键决定与未决点
- 会员/试用结构
- 核心交互和空间语义
- `card make` 外部内容工作区边界
- 已修改文件列表
- 当前 agent run record 路径
