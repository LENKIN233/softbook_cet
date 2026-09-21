# 旧本机记录查看与恢复工具

这不是产品的默认运行方式。当前本地后端与上线方向见 [本地后端联调](local-backend.md)。保留此独立工具用于读取和导出已有本机记录。

本地版内置四级、六级卡片与音频，不需要手机号。每组最多 5 张，按学科短块交替并保留各学科内的原有顺序；已到复习时间的卡片会在后续安排中优先出现。复习间隔是目前的基础规则，不表示已经验证了考试提分效果。

学习记录、当前答案、复习前的位置、收藏和暂停状态均保存在当前设备。返回首页或重新打开应用不会清除记录。四级与六级分别保存，入口和“我的”都能切换。

## Web

在仓库根目录执行：

```sh
npm --prefix apps/web run build:device
SOFTBOOK_LOCAL_PORT=4174 npm --prefix apps/web run start:device
```

打开 http://127.0.0.1:4174 。这是已编译的本地版本，不依赖 Vite、远程后端或互联网。启动静态服务仍需要本机 Node.js。停止服务不会删除记录。

此前 4173 端口的浏览器记录仍保留；如需导出，应先停止后端，再以 SOFTBOOK_LOCAL_PORT=4173 启动此工具。记录属于当前浏览器及访问地址；换浏览器、电脑或端口前应导出备份，再在新位置导入。直接打开 HTML 文件不受支持。

## Android

```sh
ANDROID_HOME="$HOME/Library/Android/sdk" npm --prefix apps/mobile run android:device
```

安装包位于 `apps/mobile/android/app/build/outputs/apk/local/app-local.apk`。包名为 `com.softbook.cet.local`，与在线版分开。独立包不会自动读取旧应用的数据，需要从旧应用导出后导入。它自带 JavaScript 和音频，不需要 Metro。本地包使用开发签名，仅供本地使用，不是商店发布包。

## iOS 模拟器

```sh
node scripts/build_ios_local.mjs --device-only
```

需要本机已安装 Xcode、iOS 模拟器运行时、Pods，并由用户完成 Xcode 的首次设置。产物位于 `exports/repair-and-build/ios-derived/Build/Products/Debug-iphonesimulator/SoftbookCET.app`。本地入口使用独立包名和内嵌脚本，不访问远程配置。本命令不生成可安装到真实 iPhone 的签名包。

## 备份与恢复

- “我的”提供导出、导入和查看已有备份。网页导出 JSON 文件；手机使用系统分享保存备份内容，导入时粘贴完整内容。
- 换设备可手动导入相同考级的备份。这不是自动云同步。
- 卡库更新时，只恢复内容未变化卡片的答题状态；其他旧记录保留在备份中。旧格式缺少兼容性依据时会提示，不能直接把旧答案套到新题上。
- 记录无法读取时，不会自动删除。可先导出原始内容，再使用“备份后重新开始”。
- “查看已有备份”可恢复兼容的历史记录。移除本机旧备份前应先导出；这个独立操作不会删除当前档案。
- 保存失败时页面会明确提示。未显示保存成功的记录不能视为已经落盘；可重试或先导出本页进度。

## 在线版边界

普通 `build` / `build:bundle` 仍保留远程账号、内容授权与发布配置要求，不会自动变成本地版。当前远程服务的考级范围由接收端授权和部署配置决定。本地版编译、模拟器测试和本地数据恢复，不构成线上发布、支付、真实短信或真机签名证据。
