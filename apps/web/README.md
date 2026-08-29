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

生产构建默认关闭学习入口。部署系统必须在加载应用前原子替换 `public/runtime-config.js`，同时提供 `mode=remote`、`clientKind=web`、HTTPS `baseUrl`、`track` 和非空 Ed25519 公钥环。缺少任一字段、字段多出、格式错误都会整体关闭远端入口，不会拼接本地卡片、会员或账户状态。浏览器配置中禁止放 API key、访问令牌、刷新令牌、短信凭证、私有签名密钥或下载凭证。

仓库实现已经把短信 request/verify/refresh/logout、登录后 event replay → canonical bootstrap、服务端 Learning Session、selection-bound completion 持久化与确认、Space action、服务端会员 entitlement、签名 manifest 和私有音频接到共享 domain repository。Web 凭证只保存在当前进程内；无凭证 learning-event outbox 与 mutation queue 使用浏览器持久存储。401/403 或显式退出后，两个持久队列必须完整清理成功才会重新显示登录入口，同手机号新会话不能继承旧命令。free 账户仅看到稳定的可访问卡前缀和只读 Space 预览；trial/premium 才能看到并修改完整 Space。未确认的 Learning event 与 Space action 会在所有主路由保持“等待同步”，只有严格 ack 后才显示服务端已确认；queued Learning 会冻结最初持久化的答案并只允许用同一结果重试或重新读取。Space 的终止性 409 会持久进入隔离，每次重载仍明确显示“已被拒绝”，直到退出清理或未来明确的安全解决策略；旧 rejected 与更新的 pending 是两个并列事实，会同时显示而不会互相覆盖或降格成 confirmed。音频必须完整下载并核对签名描述的字节数和 SHA-256，随后只播放 Blob URL，不直接播放临时下载 URL。

生产可用仍依赖真实短信、正式内容、公钥注入、托管、支付、账户删除、浏览器运行与监控证据。仓库实现与构建成功都不能证明这些外部边界已经上线。
