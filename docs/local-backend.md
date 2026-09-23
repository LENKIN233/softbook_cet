# 本地后端联调

本地后端是上线前的临时运行环境。产品仍要求手机号验证码登录，学习事件、空间状态、签到与会员状态由服务端统一管理。客户端使用与部署版相同的 v2 接口和账号隔离规则，上线时切换正式服务配置，不把单机档案当作账号数据。

## 启动网页与后端

```sh
npm --prefix apps/web run build:local
npm --prefix apps/web run start:local
```

打开 http://127.0.0.1:4173/ 。手机号输入框、验证码验证、会话和服务端学习流程都保留。当前联调用测试验证码，启动终端会显示；不会向手机号发送短信。正式上线必须接入真实短信服务。

服务只监听本机 127.0.0.1。生产包仍要求正式 HTTPS 配置。临时 HTTP 媒体例外只对显式后端联调包启用，且限制为所配置本机端口的签名音频地址；不会允许任意公网 HTTP 地址。

## 记录与身份

`.tmp/local-backend/` 保存后端账号、会话和学习记录，以及独立身份密钥。服务串行执行请求，写入并同步磁盘后才返回成功；异常数据不会自动清空。重启服务不会清除记录。备份后端时应先停止服务，再备份整个目录，恢复时也应整目录恢复；单独丢失密钥不能保证账号身份和会话连续性。

网页版按现有账号策略只在内存中保留登录凭据，刷新页面后需要重新登录；服务器上的学习记录会保留。原生客户端重启后可以恢复登录和学习进度。

这些数据尚未迁移到正式服务器。上线前需要单独制定迁移、备份、域名、短信、支付和分发方案；本地联调不是已发布或生产运维验收。

此前纯本机版本的浏览器记录和 `.local` 应用数据保留，不会被自动合并进账号。纯本机工具仅用于查看或导出旧记录，见 `docs/local-study.md`，不再作为默认产品入口。

## Android 与 iOS

先启动上述后端，它会生成仅含地址和公钥的 `apps/mobile/backend-runtime.local.json`，再编译：

```sh
ANDROID_HOME="$HOME/Library/Android/sdk" npm --prefix apps/mobile run android:backend
npm --prefix apps/mobile run ios:backend
```

Android 调试设备还需要连接本机端口，例如 `adb -s emulator-5582 reverse tcp:4173 tcp:4173`。APK 位于 `apps/mobile/android/app/build/outputs/apk/backend/app-backend.apk`，使用独立 `.backend` 包名和开发签名。

iOS 模拟器应用位于 `exports/local-backend/ios-derived/Build/Products/Debug-iphonesimulator/SoftbookCET.app`，同样使用独立 `.backend` 包名。当前命令生成模拟器应用，不生成真实 iPhone 的签名包。

两个客户端都内嵌脚本，无需 Metro，但必须能连接正在运行的本机后端。更换端口或后端公钥后要重新生成配置并编译。
