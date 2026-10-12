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

## 有序列表编号

编号菜单是本库自己画的预览卡片。格式记在最外层 `ol` 的 `data-numbering-format` 上，屏幕上的编号用 CSS 计数器画出。没有引入 `@tiptap-pro/extension-convert-kit`。

## 3. 运行时依赖（npm dependencies）

以下依赖通过 npm 以 `dependencies` 声明引入，构建时均 external（不打入 `dist/`），各自许可证随 `node_modules` 自动分发。此处仅做汇总。

| 依赖 | 许可证 |
| --- | --- |
| `@floating-ui/dom`（`@tiptap/suggestion` 的 peer 依赖，弹层定位） | MIT |
| `@radix-ui/react-dropdown-menu` | MIT |
| `@radix-ui/react-popover` | MIT |
| `@tiptap/core` | MIT |
| `@tiptap/extension-code-block-lowlight` | MIT |
| `@tiptap/extension-emoji`（表情节点、`:shortcode:` 输入；建议列表 UI 为本库自绘，不是 Pro） | MIT |
| `@tiptap/extension-details`（折叠块 `Details` / `DetailsSummary` / `DetailsContent`。npm 上的 MIT 开源包，不是 `@tiptap-pro`。markdown 往返改成 HTML `<details>`，样式为本库自绘） | MIT |
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
| `@tiptap/extension-typography`（智能标点输入规则。npm 上的 MIT 开源包，不是 `@tiptap-pro`） | MIT |
| `@tiptap/extensions`（`CharacterCount` 字数统计、`Placeholder` 占位符、`Selection` 失焦选区。npm 上的 MIT 开源包，不是 `@tiptap-pro`。统计条与选区样式为本库自绘，未移植 Tiptap 付费组件） | MIT |
| `@tiptap/markdown` | MIT |
| `@tiptap/pm` | MIT |
| `@tiptap/react` | MIT |
| `@tiptap/starter-kit` | MIT |
| `@tiptap/static-renderer` | MIT |
| `@tiptap/suggestion`（斜杠菜单状态机 / 定位） | MIT |
| `emoji-regex`（经 `@tiptap/extension-emoji` 使用，载入时识别正文里的 Unicode 表情） | MIT |
| `katex`（JS 仍是 npm 依赖，不打入 `dist`。再发行的样式与字体见第 4 节） | 样式 MIT；字体 SIL OFL 1.1 |
| `lowlight` | MIT |
| `re2js`（经 `@tiptap/extension-find-and-replace` 传递引入） | MIT |
| `highlight.js`（经 `lowlight` 传递引入） | BSD-3-Clause |

## 4. KaTeX — 样式 MIT，字体 SIL OFL 1.1

`katex` 的 JavaScript 仍是 npm 依赖，构建时 external，不打入 `dist/`，其 MIT 声明随 `node_modules/katex/LICENSE` 分发。

下面两份是本库再发行的副本，许可不同，分开保留。

### 4.1 样式表（MIT）

`katex/dist/katex.css` 打进 `dist/style.css` 与 `dist/style-inline.css`。这两份产物开头带有同一段版权声明与 MIT 许可全文。

```
The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

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

### 4.2 字体（SIL Open Font License 1.1）

`dist/fonts/*.woff2` 是 KaTeX 字体的原样副本，未改字形、未改字号名。`dist/style-inline.css` 里内嵌的是同一批文件。字体名表中的版权与许可为：

```
Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>)
```

保留字号名（Reserved Font Names）：`KaTeX_AMS`、`KaTeX_Caligraphic`、`KaTeX_Fraktur`、`KaTeX_Main`、`KaTeX_Math`、`KaTeX_SansSerif`、`KaTeX_Script`、`KaTeX_Size1`、`KaTeX_Size2`、`KaTeX_Size3`、`KaTeX_Size4`、`KaTeX_Typewriter`。

OFL 全文同时放在 `dist/fonts/OFL.txt`（与字体文件放在一起）。

```
Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>),
with Reserved Font Names KaTeX_AMS, KaTeX_Caligraphic, KaTeX_Fraktur, KaTeX_Main, KaTeX_Math, KaTeX_SansSerif, KaTeX_Script, KaTeX_Size1, KaTeX_Size2, KaTeX_Size3, KaTeX_Size4, KaTeX_Typewriter.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
