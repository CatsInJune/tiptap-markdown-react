import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertGuards,
  countKatexFaces,
  katexFontOflText,
  katexStyleBanner,
  splitFontFaces,
  withKatexStyleBanner,
} from './split-fonts.mjs';

/** 合成 woff2：wOF2 魔数 + 固定尾巴，内容可复现。 */
function fakeWoff2(tail) {
  return Buffer.concat([Buffer.from('wOF2'), Buffer.from(tail)]);
}

function toDataUri(buffer, format = 'woff2') {
  return `url(data:font/${format};base64,${buffer.toString('base64')}) format("${format}")`;
}

function fixtureCss() {
  const main = fakeWoff2('main-regular');
  const math = fakeWoff2('math-italic');
  return {
    main,
    math,
    css: `/* 规范正文样式（编辑器 / 只读预览 / SSR 阅读三处共用） */
._editorHost_xxx { position: relative; }

@font-face {
  font-family: KaTeX_Main;
  src: ${toDataUri(main)}, ${toDataUri(main, 'woff')}, ${toDataUri(main, 'truetype')};
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: KaTeX_Math;
  src: ${toDataUri(math)};
  font-weight: 400;
  font-style: italic;
}
`,
    katexFontFiles: [
      { name: 'KaTeX_Main-Regular.woff2', buffer: main },
      { name: 'KaTeX_Math-Italic.woff2', buffer: math },
    ],
  };
}

describe('splitFontFaces', () => {
  it('把内嵌字体改写为相对路径引用，并还原出带原名的字体文件', () => {
    const { css, katexFontFiles } = fixtureCss();
    const { css: out, fonts } = splitFontFaces({ css, katexFontFiles });

    expect(out).toContain('url(./fonts/KaTeX_Main-Regular.woff2) format("woff2")');
    expect(out).toContain('url(./fonts/KaTeX_Math-Italic.woff2) format("woff2")');
    // woff / ttf 一并移除，data URI 不残留
    expect(out).not.toMatch(/data:font/);
    expect(out).not.toMatch(/format\("woff"\)|format\("truetype"\)/);
    // 块内其余声明原样保留
    expect(out).toContain('font-family: KaTeX_Main;');
    expect(out).toContain('font-style: italic;');
    expect(fonts.map((f) => f.name)).toEqual([
      'KaTeX_Main-Regular.woff2',
      'KaTeX_Math-Italic.woff2',
    ]);
    expect(fonts[0].buffer.equals(fakeWoff2('main-regular'))).toBe(true);
  });

  it('内嵌数量与 expectedFaceCount 不符时 fail-fast', () => {
    const { css, katexFontFiles } = fixtureCss();
    expect(() => splitFontFaces({ css, katexFontFiles, expectedFaceCount: 20 })).toThrow(
      /期望 20 个内嵌字体.*实际找到 2 个/,
    );
  });

  it('解码后的字体与 katex 文件都匹配不上时报错并指明字族', () => {
    const { css, katexFontFiles } = fixtureCss();
    const stranger = [{ name: 'KaTeX_Main-Regular.woff2', buffer: fakeWoff2('other') }];
    expect(() => splitFontFaces({ css, katexFontFiles: stranger })).toThrow(/KaTeX_Main/);
  });

  it('css 覆盖面与 katex 字体集不一致（多出/漏掉）时报错', () => {
    const { css, katexFontFiles } = fixtureCss();
    const extra = [...katexFontFiles, { name: 'KaTeX_AMS-Regular.woff2', buffer: fakeWoff2('ams') }];
    expect(() => splitFontFaces({ css, katexFontFiles: extra })).toThrow(
      /css 未覆盖：KaTeX_AMS-Regular\.woff2/,
    );
  });

  it('没有内嵌字体时拒绝处理', () => {
    expect(() =>
      splitFontFaces({
        css: '.katex .mathdefault { font-family: KaTeX_Math; }',
        katexFontFiles: [{ name: 'KaTeX_Main-Regular.woff2', buffer: fakeWoff2('x') }],
      }),
    ).toThrow(/没有找到内嵌/);
  });
});

describe('assertGuards', () => {
  it('产物再次出现 data:font 即失败', () => {
    expect(() => assertGuards('.a { src: url(data:font/woff;base64,AAAA) }')).toThrow(
      /仍存在 data:font/,
    );
  });

  it('超过体积上限即失败', () => {
    expect(() => assertGuards('a'.repeat(201 * 1024))).toThrow(/超过上限/);
  });

  it('正常产物通过', () => {
    expect(() => assertGuards('@font-face { src: url(./fonts/KaTeX_Main-Regular.woff2) }')).not.toThrow();
  });
});

describe('KaTeX 再发行声明', () => {
  const notice = readFileSync(new URL('../THIRD_PARTY_LICENSES.md', import.meta.url), 'utf8');

  it('样式副本带上 MIT 版权与许可全文，重复套用不叠加', () => {
    const banner = katexStyleBanner();
    expect(banner).toContain('Copyright (c) 2013-2020 Khan Academy and other contributors');
    expect(banner).toContain('The above copyright notice and this permission notice shall be included');
    expect(notice).toContain(banner.slice(banner.indexOf('The MIT License'), banner.indexOf('SOFTWARE.') + 'SOFTWARE.'.length));
    const once = withKatexStyleBanner('body { color: red; }');
    expect(withKatexStyleBanner(once)).toBe(once);
    expect(once.startsWith('/* KaTeX stylesheet redistributed')).toBe(true);
  });

  it('字体 OFL 全文与保留字号名写进声明文件，并跟字体放在一起', () => {
    const ofl = katexFontOflText();
    expect(ofl).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
    expect(ofl).toContain('Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)');
    expect(ofl).toContain('Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>)');
    for (const name of ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_AMS', 'KaTeX_Typewriter']) {
      expect(ofl).toContain(name);
    }
    expect(notice).toContain(ofl.trim());
  });
});

describe('countKatexFaces', () => {
  it('按 katex.css 中引用 fonts/ 的 @font-face 计数', () => {
    const katexCss = `@font-face { font-family: A; src: url(fonts/A.woff2) format("woff2"); }
@font-face { font-family: B; src: url(fonts/B.woff2) format("woff2"); }
@font-face { font-family: C; src: url(elsewhere/C.woff2) format("woff2"); }`;
    expect(countKatexFaces(katexCss)).toBe(2);
  });
});
