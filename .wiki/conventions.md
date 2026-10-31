# 约定与坑（改代码前必读）

## 硬约束

1. **`@tiptap/*` 依赖精确锁版本、不带 `^`**。pnpm 宿主项目里 caret 会解析到与宿主锁不一致的小版本，ProseMirror 插件状态跨小版本不兼容（0.19.1 事故）。新增依赖后自查 `package.json` 的 `@tiptap` 行。
2. **仓库禁止出现 `agentic-ui`、`Ant Design`（含 `antd`、`getPopupContainer`）字样**——库零 UI 框架依赖是卖点，下拉/浮层只用 Radix primitives，图标用内联 SVG（`src/icons/`）。
3. **移植第三方 MIT 代码必须声明**：出口是 `THIRD_PARTY_LICENSES.md` 移植清单 + 源码文件头部标注。付费组件（注册接口 401 / npm 404）只可自研，不可 vendor。
4. **UI 文案两份同步**：类型与英文默认在 `src/labels.ts`，中文包在 `src/i18n/zh.ts`。改任何可见文案必须同时改两处；组件只收 `locale` prop，不收单条文案。

## markdown 往返约束（加扩展的前置检查）

**多数 Tiptap 官方扩展没有 `renderMarkdown`**——注册一个新 mark/node 后，`getMarkdown()` 会把这些格式**静默剥掉**（不报错）。所以每个新增格式能力必须补齐三件：

1. `renderMarkdown` 序列化器（挂在正确的 mark/node 类型名上——如 Color/FontSize 挂在 `textStyle` 上，见 `extensions.ts` 注释）
2. 无标准语法的，定 HTML 形态并接 tokenizer 认领（参考 `paragraphMarkdown.ts` / `imageMarkdown.ts` 的写法）；**接管解析要补提块**——tokenizer 认领的块级 HTML 必须自己把内容提回块级解析
3. 往返测试：导出 → 重新 parse → 再断言（`supSubMarkdown.test.ts` 是最小样板）

导出形态的原则：**只在样式被实际设置时写 HTML**，未触碰的内容永远保持原生 markdown；SSR 三端（编辑器/预览/`renderReportHtml`）必须一致。

已知刻意偏离（是决策不是 bug，改前看 [decisions.md](decisions.md)）：`$` 永远是货币符、公式用 `$$…$$`、不用 `==高亮==`、GFM 合并单元格不暴露。

## 宿主边界

- **网络 I/O 归宿主**：库不做上传/网络请求——`imageUpload.upload` 由宿主注入；库只拥有 UI 与协议（占位块、进度、abort 信号、markdown 时机）。
- 版本历史不存储快照：`VersionHistoryPanel` 只渲染宿主给的 `versions`，还原写入编辑器（标题不在编辑器事务里，宿主在 `onRestore` 自己恢复）。

## 验收方法（无视觉测试）

- 布局/样式改动没有快照测试兜底。两条路：
  1. **headless Chrome 量几何**（脚本量 `getBoundingClientRect`，适合精确断言）
  2. **`site/` 预览 + 浏览器人工验收**（推 main 自动部署 GitHub Pages；本地 `site` 亦可）
- 已知坑：ZCode 内置浏览器（IAB）里 `requestAnimationFrame` 不触发——依赖 rAF 的滚动/动画逻辑在 IAB 里看起来「坏」不代表真坏，换真实 Chrome 验证。
- 多选场景的坑：`updateAttributes` 对多类型节点不能用 `every` 判断（段落样式落地时踩过）。

## 测试补充约定

- DOM 测试文件头加 `// @vitest-environment happy-dom`
- 涉及官方扩展行为的测试优先断言**本库可见的行为**（markdown 导出、DOM 结构），不锁官方内部实现
- 修 bug 先写复现测试（issue #44 的修复即此模式）
