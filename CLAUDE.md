# tiptap-markdown-react — Agent 指南

Markdown 优先的所见即所得编辑器 + 阅读器套件（Tiptap v3），Markdown 进 / Markdown 出。**开工前先读 [.wiki/index.md](.wiki/index.md)**（内部工程 wiki：代码地图、约定与坑、决策记录、性能待办）；对外文档在 README 与 [GitHub Wiki](https://github.com/CatsInJune/tiptap-markdown-react/wiki)。

## 硬约束（违反即返工）

1. `@tiptap/*` 依赖**精确版本、不带 `^`**——新增依赖后自查 `package.json`。
2. 仓库禁止出现 `agentic-ui`、`Ant Design`（含 `antd`）字样；UI 只用 Radix primitives + 内联 SVG。
3. 新增格式能力必须补 markdown 往返（`renderMarkdown` + 无语法者接 tokenizer + 往返测试）——否则 `getMarkdown()` 静默丢格式。详见 `.wiki/conventions.md`。
4. UI 文案两份同步：`src/labels.ts`（英文）+ `src/i18n/zh.ts`（中文）。

## 常用命令

```bash
npm run test        # vitest（DOM 测试用 happy-dom）
npm run typecheck   # tsc --noEmit
npm run build       # vite build + 拆字体
```

## 提交与发布惯例

- 提交信息中文，格式 `type(scope): 摘要`；release 提交 `chore(release): x.y.z——摘要` 放在 PR 功能分支上
- 版本号只改 `package.json`；合并后 `npm publish`；不打 git tag
- 涉及第三方 MIT 代码移植：`THIRD_PARTY_LICENSES.md` + 源码头标注
