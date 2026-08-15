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

## 2. 运行时依赖（npm dependencies）

以下依赖通过 npm 以 `dependencies` 声明引入，构建时均 external（不打入 `dist/`），各自许可证随 `node_modules` 自动分发。此处仅做汇总。

| 依赖 | 许可证 |
| --- | --- |
| `@radix-ui/react-dropdown-menu` | MIT |
| `@radix-ui/react-popover` | MIT |
| `@tiptap/core` | MIT |
| `@tiptap/extension-code-block-lowlight` | MIT |
| `@tiptap/extension-file-handler` | MIT |
| `@tiptap/extension-highlight` | MIT |
| `@tiptap/extension-image` | MIT |
| `@tiptap/extension-subscript` | MIT |
| `@tiptap/extension-superscript` | MIT |
| `@tiptap/extension-table` | MIT |
| `@tiptap/extension-table-of-contents` | MIT |
| `@tiptap/extension-task-item` | MIT |
| `@tiptap/extension-task-list` | MIT |
| `@tiptap/extension-text-style` | MIT |
| `@tiptap/markdown` | MIT |
| `@tiptap/pm` | MIT |
| `@tiptap/react` | MIT |
| `@tiptap/starter-kit` | MIT |
| `@tiptap/static-renderer` | MIT |
| `lowlight` | MIT |
| `highlight.js`（经 `lowlight` 传递引入） | BSD-3-Clause |
