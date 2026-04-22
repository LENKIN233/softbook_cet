# 软书四六级

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`

## 当前阶段

- `product_truth`: 产品 scope 仍然是 `iOS + Android + Web`，且移动端优先；不能把产品做成泛英语教学系统。
- `implementation_hypothesis`: 先在 `apps/mobile` 落一个 React Native 原生工程，优先打通 iOS 开发闭环，再进入第一个业务模块。

## 目录

- `spec/`: 活跃产品与合同真相源
- `apps/mobile/`: React Native 移动端工程
- `docs/`: 工程协作约定与流程文档
- `scripts/validate_harness.py`: harness 校验脚本
- `scripts/bootstrap_mobile_ios.sh`: iOS 依赖重装脚本

## iOS 开发基线

当前仓库已经初始化为 React Native 0.85.x 工程，目录在 `apps/mobile`。

## 分支策略

分支策略文档见 [docs/branching-strategy.md](/Users/lenkin/programing/softbook_cet/docs/branching-strategy.md)。
原则是按需求域推进，一次只打磨一个模块，不设长期 `develop` 分支。

### 依赖前提

- Node.js `>= 22.11.0`
- Xcode 26+
- `watchman`
- `cocoapods`

### 重装依赖

```bash
./scripts/bootstrap_mobile_ios.sh
```

### 启动开发

```bash
cd apps/mobile
npm start
```

新开一个终端：

```bash
cd apps/mobile
npm run ios
```

### 学习卡源 runtime config

`apps/mobile` 现在会在启动时读取 `src/runtime/appRuntimeConfig.ts`，并把配置注入到全局 runtime。

- 默认配置是本地卡源：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = {
  learningSource: {
    mode: 'local',
  },
};
```

- 如果你要切到远端卡源，临时改成：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = {
  learningSource: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
};
```

不要把真实密钥提交进仓库；提交前请恢复成安全的默认本地配置。

### 常见恢复

如果 Xcode 报 iOS platform / simulator runtime 缺失，可以先执行：

```bash
xcodebuild -downloadPlatform iOS
```

然后再回到 `apps/mobile` 重跑 `npm run ios`。

## 当前不做

- 不提前搭 Android 开发环境
- 不提前搭 Web 端工程
- 不提前拆业务模块或共享包
