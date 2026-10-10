# Third-Party Licenses

本项目自身以 MIT 许可证发布（见 `LICENSE`）。以下列出项目中使用到的第三方内容及其版权声明与许可证。

## 1. Lucide Icons — ISC License

`src/icons/index.tsx` 中部分图标 path 取自 [Lucide](https://lucide.dev)（ISC 许可证），其中部分图形源自 [Feather](https://feathericons.com)（MIT 许可证）。

### ISC License（Lucide 主体）

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### The MIT License（源自 Feather 的部分）

```
The MIT License (MIT) (for portions derived from Feather)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. Tiptap UI Components — MIT License

本库部分组件的交互与实现参照（移植自）[tiptap-ui-components](https://github.com/ueberdosis/tiptap-ui-components)
（MIT 许可证），按本库的架构、命名与视觉体系重写，并在各源码文件头部标注来源：

| 官方组件 | 本库落点 | 移植范围 | 时间 |
| --- | --- | --- | --- |
| `image-upload-node` | `src/imageUpload.ts`、`src/components/ImageUploadView.tsx` | 上传占位块的交互与组件结构（拖拽区 / 文件队列 / 进度 / 中止）、默认文案与图标 path（文档形状、折角、云上传） | 2026-10-10 |
| `useLinkPopover` | `src/linkEditing.ts` | 链接编辑逻辑（整条链接的范围扩展、空选区插地址文本、`preventAutolink` 元数据、打开前的协议白名单）；浮层外壳自绘 | 2026-10-09 |

移植过程中修正了官方两处缺陷（`maxSize: 0` 被误判为超限、多文件时文件名与 URL 错位），
并为 Markdown 往返补了空序列化等适配——这些属于本库的改动，不改变上述归属。
`src/findReplace.ts` 的 IME 组合守卫等交互判据与之同款（该文件的主逻辑由同为 MIT 的
`@tiptap/extension-find-and-replace` 包承担，见第 3 节）。

### The MIT License

```
MIT License

Copyright (c) 2025 Tiptap GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 3. 运行时依赖（npm dependencies）

以下依赖通过 npm 以 `dependencies` 声明引入，构建时均 external（不打入 `dist/`），各自许可证随 `node_modules` 自动分发。此处仅做汇总。

| 依赖 | 许可证 |
| --- | --- |
| `@floating-ui/dom`（`@tiptap/suggestion` 的 peer 依赖，弹层定位） | MIT |
| `@radix-ui/react-dropdown-menu` | MIT |
| `@radix-ui/react-popover` | MIT |
| `@tiptap/core` | MIT |
| `@tiptap/extension-code-block-lowlight` | MIT |
| `@tiptap/extension-file-handler` | MIT |
| `@tiptap/extension-find-and-replace` | MIT |
| `@tiptap/extension-heading` | MIT |
| `@tiptap/extension-highlight` | MIT |
| `@tiptap/extension-image` | MIT |
| `@tiptap/extension-paragraph` | MIT |
| `@tiptap/extension-subscript` | MIT |
| `@tiptap/extension-superscript` | MIT |
| `@tiptap/extension-table` | MIT |
| `@tiptap/extension-table-of-contents` | MIT |
| `@tiptap/extension-task-item` | MIT |
| `@tiptap/extension-task-list` | MIT |
| `@tiptap/extension-text-align` | MIT |
| `@tiptap/extension-text-style` | MIT |
| `@tiptap/markdown` | MIT |
| `@tiptap/pm` | MIT |
| `@tiptap/react` | MIT |
| `@tiptap/starter-kit` | MIT |
| `@tiptap/static-renderer` | MIT |
| `@tiptap/suggestion`（斜杠菜单状态机 / 定位） | MIT |
| `katex`（数学渲染；`dist/style.css` 的 KaTeX 样式段落与 `dist/fonts/*.woff2` 字体文件均取自该包再分发） | MIT |
| `lowlight` | MIT |
| `re2js`（经 `@tiptap/extension-find-and-replace` 传递引入） | MIT |
| `highlight.js`（经 `lowlight` 传递引入） | BSD-3-Clause |
