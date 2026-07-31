# 软书四六级 PC Web

PC Web 使用独立的 React + Vite 入口，并复用移动端的平台无关学习判定、会员访问与显示元数据。界面实现依据：

- `../../docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `../../docs/design/mapping/pc-web-core-implementation-map-v1.md`
- `../../docs/design/interaction-motion/learning-core-interactions-v1.md`
- `../../docs/design/physical-space/space-model-v1.md`

## 本地验证

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run dev` 仅在 Vite 开发模式使用仓库内结构化开发卡片。它不代表正式内容、内容批准、服务端调度或上线证据。

## 生产边界

生产构建默认关闭学习入口。部署系统必须在加载应用前替换 `public/runtime-config.js`，提供 HTTPS `baseUrl` 和 `remote` 模式；浏览器配置中禁止放 API key、私有下载密钥或供应商凭证。当前版本会对尚未完成的远端短信登录接线保持关闭，不会降级到本地账户。

生产可用仍依赖账户、canonical bootstrap、学习 session/events、会员、Space、私有音频、支付、正式内容、托管与运行证据。仅构建成功不能证明这些边界已上线。
