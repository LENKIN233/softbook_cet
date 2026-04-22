# Branching Strategy

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`

## product_truth

- 产品不是泛英语教学系统，而是 CET4/CET6 备考产品。
- `v1` 的核心交付围绕 `learning / space / statistics / mine` 四个顶层入口展开。
- `learning` 是最重要入口，`space` 必须是顶层入口，不允许被降级成附属盒子视图。
- 登录先于学习，主登录方式是手机号验证码。
- 会员、试用、购买、进度同步属于跨模块合同，不应被某个单一页面随意重写。
- 技术上是 `React Native`，但产品 scope 仍然是 `iOS + Android + Web`；当前开发顺序是 `iOS 优先`。

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

## 合并门槛

- iOS 本地可启动或可编译。
- 当前模块的 spec 范围闭合，没有偷偷引入下个模块的需求。
- lint / test / build 至少覆盖当前分支实际改动。
- README 或相关开发文档只补当前阶段必需信息，不提前写远期架构。

## 当前分支建议

当前仓库已经在做环境和 iOS 基线，建议把当前工作放在：

- `infra/rn-ios-baseline`
