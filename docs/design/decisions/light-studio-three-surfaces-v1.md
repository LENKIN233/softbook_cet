# 三端轻快风格 v1

## 决定来源与范围

用户从同会话三版 HTML 中选择 B「轻快」，随后要求按该风格重构三端并配置丰富、合理、合适的动画。本决定是 iOS、Android、Web 的共同表现基准，替代旧基准中的暖灰底色、较重字重和密集边框。产品语义仍由 `spec/product-core.json`、`spec/interactions.json`、`spec/space-operations.json` 负责。

渲染参考：`docs/design/visual-reference.html`。示例文字只说明视觉结构，不是运行卡库。真实内容来自现有导入链。

## 共同语法

- 浅紫灰背景，白色纸面；品牌紫只用于全局导航。学习和空间由当前学科的稳定身份色主导。
- 卡片 24、区域 20、操作 14、浮动导航 22 的圆角；手机侧边距 18，宽屏 28。以文字层级和间距组织内容。
- 章节色条在纸面上方，呈现课程、书架、分区、卡盒、真实进度和收藏。短内容自然收拢；长材料完整保留并滚动，动作区始终可达。
- 问题默认 20/600，正文 15/400，说明 13，标题 24。长题与系统大字号优先于默认尺度；禁止裁去题目、选项和解析。
- 手机胶囊导航、平板侧栏、Web 窄轨均使用学习／空间／统计／我的。登录、验证、退出、错误和空态沿用同一控件语言。
- Web 宽屏可在卡片旁显示安静的所属卡盒信息；窄窗移除该信息栏。上下文不得成为第二个学习任务。
- 四选一短选项使用两列，选项字母和文本形成层级；长选项、窄屏或大字号改成单列。其他四种交互保留独立轮廓与判定语义。
- 我的页按内容高度滚动，底部注销与退出入口保持可达；收藏与休眠成功以对象自身状态反馈，失败与恢复通知保留。
- 统计展示真实今日、待复习和累计记录；不添加虚构目标、进度曲线或奖励。

## 空间表现

沿用 `docs/design/physical-space/space-model-v1.md` 的书架→分区→卡盒→卡片关系。书架采用小色点的轻量标签，分区采用带下划线的选择器，卡盒采用顶部身份色的文件夹形块。打开的盒子显示所属位置和卡片；当前浏览卡完整展示，缩略卡允许摘要并可展开。浏览、收藏、休眠不能改变系统学习顺序或卡片归属。

## 动效与实现映射

动效 owner：`docs/design/interaction-motion/light-studio-motion-v1.md`。

| 内容 | iOS / Android | Web |
|---|---|---|
| 共享参数 | `src/visual/studio.ts`、`tokens.ts` | 导入同一 `studio.ts`，`visualTheme.ts` 映射 CSS 变量 |
| 品牌、登录、导航、我的 | `App.tsx`、`LocalStudyApp.tsx`、`StudioMark.tsx`、`StudioRouteIcon.tsx` | `App.tsx`、`StudioMark.tsx`、`styles.css` |
| 卡片与五种交互 | `learning/LearningSurface.tsx` | `App.tsx` 中 LearningSurface |
| 真实播放状态 | `audio/LearningAudioPlayer.tsx` | `StudioAudio.tsx` |
| 卡盒与卡片 | `space/SpaceSurface.tsx` | `App.tsx` 中 SpaceSurface |
| 实际统计 | `statistics/StatisticsSurface.tsx` | `App.tsx` 中 StatisticsSurface |
| 动作编排 | `learning/NativeMotion.tsx` | `motion.ts`、`styles.css` |

## 验收边界

以运行页面确认层级、完整材料、操作可达、安全区、播放及错误恢复；以连续操作检查中断、重复提交和减少动态效果。捕获绑定当前源码及运行环境。原生模拟器、Web 浏览器、单元测试和正式发布证据分别记录，参考图与作者说明不能证明体验通过。
