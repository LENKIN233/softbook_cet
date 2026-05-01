# Branching Strategy

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

- 产品不是泛英语教学系统，而是 CET4/CET6 备考产品。
- `v1` 的核心交付围绕 `learning / space / statistics / mine` 四个顶层入口展开。
- `learning` 是最重要入口，`space` 必须是顶层入口，不允许被降级成附属盒子视图。
- 登录先于学习，主登录方式是手机号验证码。
- 会员、试用、购买、进度同步属于跨模块合同，不应被某个单一页面随意重写。
- 技术上是 `React Native`，但产品 scope 仍然是 `iOS + Android + Web`；当前开发顺序是 `iOS 优先`。
- 所有用户可见 UI 必须先经过已接受设计稿或等价设计基准，现有 RN 只能作为行为原型，不能直接成为视觉权威。

## implementation_hypothesis

- 使用 `main + 单活跃模块分支`，不设长期 `develop`。
- 同一时间只允许一个主模块分支处于开发中，保持“小步慢跑”和模块闭环。
- 分支名称直接映射需求域，而不是映射 UI 零件或临时实现细节。
- 只有明确跨域的工作才允许用 `cross/*`，否则必须落在单一模块分支里。

## 分支类型

- `main`
  - 永远代表当前最稳的集成基线。
  - 只接收已经完成模块闭环的合并。
- `infra/<goal>`
  - 环境、构建、CI、脚手架、工程结构。
  - 例：`infra/rn-ios-baseline`
- `shell/<goal>`
  - 应用骨架、导航骨架、占位页，不承诺完整业务能力。
  - 例：`shell/ios-nav-routing`
- `module/<domain>-<goal>`
  - 单一需求域的完整模块开发分支。
  - 例：`module/learning-single-card-flow`
  - 例：`module/space-knowledge-map`
  - 例：`module/statistics-checkin-basic`
  - 例：`module/mine-profile-page`
- `cross/<domain>-<goal>`
  - 明确跨域且由合同驱动的开发分支。
  - 例：`cross/auth-phone-sms-gate`
  - 例：`cross/membership-trial-paywall`
  - 例：`cross/sync-daily-progress`
- `fix/<goal>`
  - 已合并模块的缺陷修复，不引入新范围。

## 当前推荐推进顺序

按你现在的开发观念，建议只保持一个主线分支在推进，顺序如下：

1. `infra/rn-ios-baseline`
2. `shell/ios-nav-routing`
3. `cross/auth-phone-sms-gate`
4. `module/learning-single-card-flow`
5. `module/learning-core-interactions`
6. `module/space-knowledge-map`
7. `module/review-flow`
8. `cross/membership-trial-paywall`
9. `module/statistics-checkin-basic`
10. `module/mine-profile-page`
11. `cross/sync-daily-progress`

## 每个分支的范围约束

- 一个 `module/*` 分支只解决一个主需求结果，不同时包进多个入口。
- 若代码变更牵涉多个 spec owner，先确认 owner，再决定是否升级为 `cross/*`。
- 若某个分支需要改产品真相，先改对应 spec，再改代码。
- 不允许在 `module/learning-*` 里顺手做 `space` 或 `membership` 的产品扩展。
- 不允许为了“先跑起来”提前铺全量模块占位实现。

## 默认交付路径

- 会持久化 repo 改动的任务默认走 `topic branch -> commit -> PR(main)`。
- 若用户明确要求只做本地修改，才允许停在本地 handoff，不开 PR。
- PR 创建后，默认在 agent review 通过且 required gates 全绿时自动合并到 `main`。
- 只有当 agent review 有 blocking 结论、required gates 未通过，或权限 / 环境阻止 merge 时，才停在 PR handoff。
- 如果权限或环境阻止创建 PR，至少要明确交付 branch、commit、验证结果与阻塞原因。
- 涉及用户可见 UI 的分支，必须先引用已接受设计稿 / reference / design brief / decision，再做实现；同一 PR 内新增的 brief / decision 只能满足 design-only PR。
- Learning / core interaction UI 分支必须引用 interaction-motion artifact 或 storyboard；Space UI 分支必须引用 physical-space artifact 或 storyboard；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。

## PR 合同与 CI 门槛

- `.github/pull_request_template.md` 要求 PR 描述包含：`当前任务引用的 spec`、`变更摘要`、`验证`；若涉及用户可见 UI，必须补 `设计稿来源（用户可见 UI 如适用）`、interaction/motion 或 physical-space artifact（如适用）、实现映射、未实现 gap，并回答 `design_review_checklist（如适用）`。
- `.github/workflows/pr-gates.yml` 会在指向 `main` 的 PR 上运行 `python3 scripts/validate_pr_design_gate.py --base <base_sha> --head <head_sha>`、`python3 scripts/validate_harness.py --skip-remote-guard`、`cd apps/mobile && npm run lint -- --quiet`、`cd apps/mobile && npm run typecheck`、`cd apps/mobile && npm test -- --runInBand --watchAll=false`。
- merge 的默认前置条件是：agent review 无 blocking finding，且 required gates 全绿。
- 本地开 PR 前仍然应该执行完整的 `python3 scripts/validate_harness.py`，不要只依赖 CI 的 `--skip-remote-guard` 版本。

## 合并门槛

- iOS 本地可启动或可编译。
- 当前模块的 spec 范围闭合，没有偷偷引入下个模块的需求。
- lint / test / build 至少覆盖当前分支实际改动。
- README 或相关开发文档只补当前阶段必需信息，不提前写远期架构。

## 本地分支保护

- `main` 只用于查看和同步集成基线，不应直接承接开发改动。
- 运行 `./scripts/install_git_hooks.sh` 后，仓库会启用本地 hooks：
  - `pre-commit`：阻止在 `main` 上直接提交
  - `pre-merge-commit`：阻止在 `main` 上本地合并出提交
  - `pre-push`：阻止把本地 `main` 直接推到远端 `main`
  - `post-checkout`：当你切到带脏工作区的 `main` 时直接报错，干净切到 `main` 时也会提醒它是只读集成分支
- `python3 scripts/validate_harness.py` 会同时检查 hooksPath、hook wrapper 分发、以及 GitHub 上 `main` 的 branch protection 是否仍然符合 harness 合同。
- 只有在紧急修复且你明确知道自己在做什么时，才允许临时设置 `SOFTBOOK_ALLOW_MAIN_BYPASS=1` 绕过保护。

## 当前分支建议

当前仓库已经在做环境和 iOS 基线，建议把当前工作放在：

- `infra/rn-ios-baseline`
