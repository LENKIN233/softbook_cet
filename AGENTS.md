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

软书四六级面向中国大学生，以单卡学习、高价值交互和物理空间知识地图支持 CET4/6 备考。

## 工作方式

- 先确认用户目标、当前分支、HEAD 和已有改动；保留其他任务的工作。按当前任务执行，不从本文件推导新的业务或发布任务。
- 产品内部不存在人工或用户审核 gate。`spec/machine-acceptance.json` 是 model+harness 授权、验收和精简 harness 的唯一 owner；在用户授权范围内自主完成工作。
- 从 `spec/doc-manifest.json` 和 `spec/authority-map.json` 定位权威，只读取相关 owner。定义变更对照 `spec/requirement-memory.json`；实现方案可由运行结果修正。
- 同一规则只写一次。新增静态 guard 必须先有可复现失败与代表性 eval；优先验证行为与结果，清理重复流程时回跑受影响的代表性检查。

## 按任务读取

| 任务 | 入口 |
| --- | --- |
| 产品、交互、物理空间、会员 | `spec/product-core.json` 与 authority-map 中的对应 owner |
| 账号、同步、服务端与部署 | `spec/account-sync-contract.json`、`spec/runtime-boundaries.json` 及相关 `infra/cloudbase/*-runtime-contract.md` |
| 学习事件或调度 | `infra/cloudbase/learning-events-v2-runtime-contract.md`、`infra/cloudbase/learning-session-v1-runtime-contract.md` |
| 视觉或用户可见交互 | `spec/visual-language.json`、`docs/design/design-harness.md`、对应设计与实现；体验验收方式以 machine-acceptance 为准 |
| 卡片内容交接 | `spec/card-system.json`、`spec/box-catalog.json`、`infra/cloudbase/mobile-runtime-contract.md` 与外部内容工作区 |
| PR、CI、检查架构 | `spec/agent-harness.json`、`spec/repo-delivery-contract.json`、`spec/harness-architecture.json`、`spec/evals.json` |
| 上线、正式封测或媒体证据 | `spec/release-operational-policy.json` 与对应 readiness、media receipt、runtime owner |
| 工作区分类 | `spec/workspace-boundary.json` |

## 应保留的边界

- 候选卡片生产、审查和授权属于同级 `/Users/lenkin/programing/card make`；本仓库消费导出的 payload，并执行导入、审计和运行验证。开发 fixture 不计为正式内容。
- 外部账号、凭证、部署、真机与用户结果必须有实际证据。结构通过、模拟、dry-run、本地报告和历史批准各自只证明其覆盖的范围；不能替代正式发布或当前内容授权。
- 正式证据遵守对应 owner 的精确 commit、scope、hash、环境与产物绑定；不因入口精简而降低完整性、数据安全或恢复要求。
- 设计基准可由实际任务失败推翻；普通修复可在同一 PR 修改设计和实现。验证真实运行结果，设计文字和作者自评不替代体验证据。
- 默认不加载 archive、generated、dependency、cache 或其他工作区全量内容；需要时按任务读取。

## 验证与交付

- 选择与改动相关的验证和 required checks；具体命令、PR 字段与交付规则由 repo-delivery-contract 和 agent-harness 维护，避免在入口复制。
- `main` 用于集成，开发使用当前治理允许的 topic branch。新增 checkout 时按治理安装 hooks；merge 后仅在干净的本地 main 上 fast-forward。
- 用户要求本地修改时保持本地；适用完整交付的任务按 owner 完成提交、PR、精确 diff 审查、required checks 和自动合并，不额外索要主观审核。
- 不再要求新增 `docs/agent-runs/*.md`。普通 PR 只记录相关 spec、变更、验证与 Model review；正式外部事实写入对应 evidence schema。
- 最终说明完成内容、验证结果及确有证据的剩余限制。上下文交接保留目标、当前状态、关键决定、修改文件和未完成工作，不重复整个规则集。
