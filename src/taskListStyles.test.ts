import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReportHtml } from './renderReportHtml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, 'styles/content.module.css'), 'utf8');

/** 取一条规则块内的声明文本（文件里这些规则都写成 `.editorContent :global(<sel>)`）。 */
function rule(sel: string): string {
  const wrapped = `.editorContent :global(${sel})`;
  const idx = css.indexOf(wrapped);
  const start = idx >= 0 ? idx + wrapped.length : css.indexOf(sel);
  expect(start, `未找到规则：${sel}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('任务清单样式：复选框与首行对齐', () => {
  it('li 是 flex 容器，项内段落必须清零外边距（否则正文被段距推低、框偏高）', () => {
    expect(rule("ul[data-type='taskList'] li")).toMatch(/display:\s*flex/);
    expect(rule("ul[data-type='taskList'] li > div > p")).toMatch(/margin:\s*0\s*;/);
  });

  it('复选框容器撑满一行行高并垂直居中，框心落在首行中线上', () => {
    const label = rule("ul[data-type='taskList'] li > label");
    expect(label).toMatch(/display:\s*flex/);
    expect(label).toMatch(/align-items:\s*center/);
    expect(label).toMatch(/height:\s*1lh/);
    // 不再靠手调 margin-top 补偿
    expect(label).not.toMatch(/margin-top/);
  });

  it('复选框去掉浏览器 UA 默认外边距，居中不随浏览器差异漂移', () => {
    expect(rule("ul[data-type='taskList'] input[type='checkbox']")).toMatch(/margin:\s*0\s*;/);
  });

  it('项间距与 ul/ol 的项间距一致（0.7em）', () => {
    expect(rule("ul[data-type='taskList'] li")).toMatch(/margin:\s*0\.7em 0/);
  });

  it('项内第二段起仍保留半档间距', () => {
    expect(rule("ul[data-type='taskList'] li > div > p + p")).toMatch(/margin-top:\s*0\.35em/);
  });
});

describe('任务清单样式：CSS 所依赖的 DOM 结构', () => {
  it('SSR 输出类名与层级不变（label > input + span，div > p）', () => {
    const { html } = renderReportHtml('- [ ] 待办事项\n- [x] 已完成事项');

    expect(html).toMatch(
      /<ul data-type="taskList"><li[^>]*data-type="taskItem"[^>]*><label><input type="checkbox"\/><span\/><\/label><div><p>[^<]*<\/p><\/div><\/li>/,
    );
    expect(html).toContain('<input type="checkbox" checked="checked"/>');
  });
});
