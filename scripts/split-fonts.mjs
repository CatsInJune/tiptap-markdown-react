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

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WOFF2_MAGIC = Buffer.from('wOF2');
const DEFAULT_MAX_CSS_BYTES = 200 * 1024;

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
      console.log('[split-fonts] style.css 已是拆分形态，跳过（无内嵌字体）。');
      return;
    }
    throw new Error('style.css 既无内嵌字体也无拆分标记，处于意外状态，拒绝处理。');
  }

  const [katexFontFiles, katexCss] = await Promise.all([
    readWoff2Files(katexFontsDir),
    readFile(katexCssPath, 'utf8'),
  ]);

  // 先落内嵌版兜底，再动 style.css 本体
  await copyFile(styleCssPath, path.join(distDir, 'style-inline.css'));

  const { css: splitCss, fonts } = splitFontFaces({
    css,
    katexFontFiles,
    expectedFaceCount: countKatexFaces(katexCss),
  });
  assertGuards(splitCss);

  await mkdir(path.join(distDir, 'fonts'), { recursive: true });
  await writeFile(styleCssPath, splitCss);
  await Promise.all(
    fonts.map((f) => writeFile(path.join(distDir, 'fonts', f.name), f.buffer)),
  );

  const total = fonts.reduce((sum, f) => sum + f.buffer.length, 0);
  console.log(
    `[split-fonts] 拆出 ${fonts.length} 个 woff2（合计 ${(total / 1024).toFixed(0)}KB）→ dist/fonts/；` +
      `style.css ${(Buffer.byteLength(splitCss) / 1024).toFixed(0)}KB；` +
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
