# softbook mobile

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`

## 当前基线

- `apps/mobile` 是 React Native 0.85.x 的 iOS 优先工程。
- 当前已覆盖手机号验证码登录门槛、学习主流、review flow、空间知识地图、统计签到、我的页、会员试用 / 付费墙。
- 当前分支把 `auth / membership / learningSource / progressSync / spaceState / learningState` 都统一到 runtime 配置下，默认仍走本地安全实现。

## 环境前提

- Node.js `>= 22.11.0`
- Xcode 26+
- `watchman`
- `cocoapods`

## 启动开发

```bash
./scripts/bootstrap_mobile_ios.sh
cd apps/mobile
npm start
```

新开一个终端：

```bash
cd apps/mobile
npm run ios
```

## 常用检查

```bash
cd apps/mobile
npm run lint
npm run typecheck
npm test -- --watch=false
```

## runtime config

应用启动时会读取 `src/runtime/appRuntimeConfig.ts`。

默认安全配置：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = {
  auth: {
    mode: 'local',
  },
  learningSource: {
    mode: 'local',
  },
  membership: {
    mode: 'local',
  },
  progressSync: {
    mode: 'local',
  },
  spaceState: {
    mode: 'local',
  },
  learningState: {
    mode: 'local',
  },
};
```

如果要临时切到远端认证 / 学习卡源 / entitlement / 日级同步 / 空间状态 / learning state：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = {
  auth: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
  learningSource: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
  membership: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
  progressSync: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
  spaceState: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
  learningState: {
    mode: 'remote',
    remote: {
      baseUrl: 'https://your-api.example.com',
      apiKey: 'your-dev-key',
    },
  },
};
```

提交前恢复为本地安全默认值，不要把真实密钥提交进仓库。

- `auth`：手机号验证码请求 / 校验仓储
- `learningSource`：学习卡源仓储；远端模式要求登录上下文，且 `auth.mode` 也必须是 `remote`
- `membership`：entitlement 读取、开始试用、开通会员、恢复购买提醒状态更新；远端模式要求 `auth.mode` 也必须是 `remote`
- `progressSync`：日级进展同步仓储；远端模式要求登录上下文，且 `auth.mode` 也必须是 `remote`
- `spaceState`：收藏/休眠等空间状态同步仓储；远端模式要求登录上下文，且 `auth.mode` 也必须是 `remote`
- `learningState`：逐卡学习作答状态同步仓储；远端模式要求登录上下文，且 `auth.mode` 也必须是 `remote`

## 默认本地会员宿主

- 试用在首个计入入口开始，不在安装或注册时偷跑
- 免费态保留基础学习，但完整卡库、完整空间和完整算法受限
- `space` 和 `review` 受 entitlement gate 影响
- “我的”页承接试用状态、开通会员和恢复购买提醒

这些是默认本地实现，用于验证产品合同；切到远端 runtime 后，真实计费与 entitlement 会由服务端合同回填。
