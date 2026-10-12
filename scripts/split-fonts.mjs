#!/usr/bin/env node
/**
 * 构建后处理：把 Vite 库模式强制内联进 dist/style.css 的 KaTeX 字体拆回独立文件。
 *
 * 背景：Vite 在 build.lib 下 `shouldInline()` 无条件返回 true，无视 assetsInlineLimit，
 * katex.min.css 里 `url(fonts/*.woff2|woff|ttf)` 的 60 个引用全部变成 base64 data URI，
 * style.css 膨胀到 ~1.44MB（938KB gzip）且作为阻塞样式表被每个消费页整包下载。
 *
 * 本脚本做四件事（fail-fast，任何一步不符合预期直接退出非 0，不产出半成品）：
 *   1. dist/style.css 原样拷贝为 dist/style-inline.css（内嵌字体版，单文件直连场景兜底）；
 *   2. 提取 20 个 @font-face 的 woff2 base64，与 node_modules/katex/dist/fonts/*.woff2
 *      逐字节比对还原真实文件名，落盘 dist/fonts/*.woff2；
 *   3. 每个 @font-face 的 src 改写为 `url(./fonts/<name>) format("woff2")`，删除 woff/ttf；
 *   4. 守卫：产物 css 禁止出现 data:font；体积不得超过 maxBytes（默认 200KB）。
 *
 * 幂等：vite build 每次 emptyOutDir 清空 dist 后总会产出内嵌版，本脚本紧随其后执行；
 * 若检测到 style.css 已是拆分形态（手动重复执行），打印提示后原样退出。
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WOFF2_MAGIC = Buffer.from('wOF2');
const DEFAULT_MAX_CSS_BYTES = 200 * 1024;

/** 与字体名表里的 Reserved Font Name 一致。未改字体，这些名字保持原样。 */
export const KATEX_FONT_RESERVED_NAMES = [
  'KaTeX_AMS',
  'KaTeX_Caligraphic',
  'KaTeX_Fraktur',
  'KaTeX_Main',
  'KaTeX_Math',
  'KaTeX_SansSerif',
  'KaTeX_Script',
  'KaTeX_Size1',
  'KaTeX_Size2',
  'KaTeX_Size3',
  'KaTeX_Size4',
  'KaTeX_Typewriter',
];

const KATEX_STYLE_BANNER_MARK = 'KaTeX stylesheet redistributed from https://github.com/KaTeX/KaTeX';

/**
 * 打进 style.css / style-inline.css 的声明。样式是 KaTeX CSS 的副本，MIT 要求
 * 版权声明和许可全文跟这份副本走。字体是另一份许可，全文在 OFL.txt。
 */
export function katexStyleBanner() {
  return `/* ${KATEX_STYLE_BANNER_MARK}.

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

KaTeX fonts referenced here are not under the MIT license above.
Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>)
Reserved Font Names: ${KATEX_FONT_RESERVED_NAMES.join(', ')}.
SIL Open Font License, Version 1.1.
Full text: fonts/OFL.txt and THIRD_PARTY_LICENSES.md in this package.
*/

`;
}

export function withKatexStyleBanner(css) {
  if (css.includes(KATEX_STYLE_BANNER_MARK)) return css;
  return `${katexStyleBanner()}${css}`;
}

/** 与字体放在一起的 OFL 全文。版权行对应字体名表，保留字号名不改。 */
export function katexFontOflText() {
  return `Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>),
with Reserved Font Names ${KATEX_FONT_RESERVED_NAMES.join(', ')}.

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
`;
}

/**
 * 纯函数：拆分 css 里的内嵌字体。
 *
 * @param {object} input
 * @param {string} input.css  vite 产物的 style.css 全文（含 data URI 字体）
 * @param {Array<{name: string, buffer: Buffer}>} input.katexFontFiles  katex 包自带的 woff2 文件
 * @param {number} [input.expectedFaceCount]  期望的 @font-face 数（不传则跳过该项校验）
 * @returns {{css: string, fonts: Array<{name: string, buffer: Buffer}>}}
 */
export function splitFontFaces({ css, katexFontFiles, expectedFaceCount }) {
  const blockRe = /@font-face\s*\{[^{}]*\}/gs;
  const blocks = css.match(blockRe) ?? [];
  const embedded = blocks.filter((b) => /data:font\/woff2;base64,/.test(b));

  if (expectedFaceCount != null && embedded.length !== expectedFaceCount) {
    throw new Error(
      `期望 ${expectedFaceCount} 个内嵌字体的 @font-face，实际找到 ${embedded.length} 个。` +
        `katex 版本可能变了，请核对 scripts/split-fonts.mjs 的匹配逻辑。`,
    );
  }
  if (embedded.length === 0) {
    throw new Error('style.css 中没有找到内嵌（data URI）的 woff2 字体，无可拆分内容。');
  }

  const fonts = [];
  const usedNames = new Set();
  let out = css;

  for (const block of embedded) {
    const family = block.match(/font-family\s*:\s*([^;}]+)/)?.[1]?.trim() ?? '(unknown)';
    const base64 = block.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/)?.[1];
    if (!base64) {
      throw new Error(`@font-face（${family}）中没有 woff2 data URI，无法拆分。`);
    }
    const buffer = Buffer.from(base64, 'base64');
    const file = katexFontFiles.find((f) => f.buffer.equals(buffer));
    if (!file) {
      throw new Error(
        `@font-face（${family}）解码后的 woff2 与 katex/dist/fonts 下任何文件都不匹配。` +
          `katex 版本是否与依赖表一致？`,
      );
    }
    if (!buffer.subarray(0, 4).equals(WOFF2_MAGIC)) {
      throw new Error(`匹配到的 ${file.name} 不是合法 woff2（缺少 wOF2 魔数）。`);
    }

    const newSrc = `src: url(./fonts/${file.name}) format("woff2")`;
    // src 值形如 url(...) format("woff2"), url(...) format("woff"), ...
    // 不能用 [^;]+ 匹配：data URI 内部自带分号（data:font/woff2;base64,）
    const urlToken = /url\([^)]*\)(?:\s*format\("[^"]*"\))?/.source;
    const srcRe = new RegExp(`src\\s*:\\s*${urlToken}(?:\\s*,\\s*${urlToken})*`);
    const replaced = block.replace(srcRe, newSrc);
    if (replaced === block) {
      throw new Error(`@font-face（${family}）里没有找到可替换的 src 声明。`);
    }
    out = out.replace(block, replaced);
    fonts.push({ name: file.name, buffer });
    usedNames.add(file.name);
  }

  const katexNames = new Set(katexFontFiles.map((f) => f.name));
  const missing = [...katexNames].filter((n) => !usedNames.has(n));
  const unknown = [...usedNames].filter((n) => !katexNames.has(n));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `字体集与 katex 包不一致：css 引用了 ${usedNames.size} 个，katex 提供 ${katexNames.size} 个` +
        (missing.length ? `；css 未覆盖：${missing.join(', ')}` : '') +
        (unknown.length ? `；无法对应：${unknown.join(', ')}` : '') +
        `。`,
    );
  }

  return { css: out, fonts };
}

/** 守卫：拆分后的产物 css 不允许再出现内嵌字体，且体积受限。 */
export function assertGuards(css, { maxBytes = DEFAULT_MAX_CSS_BYTES } = {}) {
  if (/data:font/.test(css)) {
    throw new Error('守卫失败：产物 style.css 中仍存在 data:font 内嵌字体。');
  }
  const bytes = Buffer.byteLength(css);
  if (bytes > maxBytes) {
    throw new Error(`守卫失败：style.css 体积 ${bytes} 字节，超过上限 ${maxBytes}。`);
  }
}

/** 从 katex 的原始 katex.css 推导期望的 @font-face 数量，避免硬编码耦合 katex 版本。 */
export function countKatexFaces(katexCss) {
  return (katexCss.match(/@font-face\s*\{[^{}]*url\(fonts\//g) ?? []).length;
}

export async function readWoff2Files(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.woff2')).sort();
  if (names.length === 0) {
    throw new Error(`${dir} 下没有 .woff2 文件，katex 安装是否完整？`);
  }
  return Promise.all(
    names.map(async (name) => ({ name, buffer: await readFile(path.join(dir, name)) })),
  );
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const distDir = path.join(root, 'dist');
  const styleCssPath = path.join(distDir, 'style.css');
  const katexFontsDir = path.join(root, 'node_modules', 'katex', 'dist', 'fonts');
  const katexCssPath = path.join(root, 'node_modules', 'katex', 'dist', 'katex.css');

  const css = await readFile(styleCssPath, 'utf8');

  if (!/data:font\/woff2;base64,/.test(css)) {
    if (/url\(\.\/fonts\//.test(css)) {
      await mkdir(path.join(distDir, 'fonts'), { recursive: true });
      await writeFile(path.join(distDir, 'fonts', 'OFL.txt'), katexFontOflText());
      if (!css.includes(KATEX_STYLE_BANNER_MARK)) {
        await writeFile(styleCssPath, withKatexStyleBanner(css));
      }
      console.log('[split-fonts] style.css 已是拆分形态，跳过字体拆分；已核对版权声明。');
      return;
    }
    throw new Error('style.css 既无内嵌字体也无拆分标记，处于意外状态，拒绝处理。');
  }

  const [katexFontFiles, katexCss] = await Promise.all([
    readWoff2Files(katexFontsDir),
    readFile(katexCssPath, 'utf8'),
  ]);

  // 内嵌版同样是样式副本，声明跟这份文件走。
  const inlineCss = withKatexStyleBanner(css);
  await writeFile(path.join(distDir, 'style-inline.css'), inlineCss);

  const { css: splitCss, fonts } = splitFontFaces({
    css,
    katexFontFiles,
    expectedFaceCount: countKatexFaces(katexCss),
  });
  const noticedCss = withKatexStyleBanner(splitCss);
  assertGuards(noticedCss);

  const fontsDir = path.join(distDir, 'fonts');
  await mkdir(fontsDir, { recursive: true });
  await writeFile(styleCssPath, noticedCss);
  await writeFile(path.join(fontsDir, 'OFL.txt'), katexFontOflText());
  await Promise.all(
    fonts.map((f) => writeFile(path.join(fontsDir, f.name), f.buffer)),
  );

  const total = fonts.reduce((sum, f) => sum + f.buffer.length, 0);
  console.log(
    `[split-fonts] 拆出 ${fonts.length} 个 woff2（合计 ${(total / 1024).toFixed(0)}KB）→ dist/fonts/；` +
      `style.css ${(Buffer.byteLength(noticedCss) / 1024).toFixed(0)}KB；` +
      `内嵌版已存为 style-inline.css。`,
  );
}

// 直接执行时才跑 main（单测 import 不触发）
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`[split-fonts] ${err.message}`);
    process.exit(1);
  });
}
