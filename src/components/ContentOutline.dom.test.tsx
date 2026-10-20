/** @vitest-environment happy-dom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ReaderReportContent } from './ReaderReportContent';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

const html = `
  <h1 data-toc-id="intro">简介</h1>
  <p>正文</p>
  <h2 data-toc-id="detail">细节</h2>
`;

describe('阅读端内置目录', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  const mount = async (node: ReactNode) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(node);
    });
  };

  it('有 data-toc-id 的标题时画出短横线', async () => {
    await mount(<ReaderReportContent html={html} toc />);
    const ticks = host.querySelectorAll('[data-toc-rail] button');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]?.getAttribute('aria-label')).toBe('简介');
    expect(ticks[1]?.getAttribute('aria-label')).toBe('细节');
    expect(host.textContent).toContain('正文');
  });

  it('toc={false} 不画目录，正文仍在', async () => {
    await mount(<ReaderReportContent html={html} toc={false} />);
    expect(host.querySelector('[data-editor-toc]')).toBeNull();
    expect(host.textContent).toContain('简介');
  });

  it('没有锚点的标题不入目录', async () => {
    await mount(<ReaderReportContent html="<h1>无锚点</h1><p>正文</p>" />);
    expect(host.querySelector('[data-editor-toc]')).toBeNull();
    expect(host.textContent).toContain('无锚点');
  });

  it('点击被外层截住时，按下就高亮，滚动不会把它改回去', async () => {
    await mount(<ReaderReportContent html={html} toc />);
    const stopClick = (event: Event) => event.stopPropagation();
    host.addEventListener('click', stopClick, true);
    const ticks = [
      ...host.querySelectorAll<HTMLButtonElement>('[data-toc-rail] button'),
    ];
    const current = () => ticks.findIndex((tick) => tick.getAttribute('aria-current') === 'true');
    const target = current() === 0 ? 1 : 0;

    await act(async () => {
      ticks[target]?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }),
      );
    });
    expect(ticks[target]?.getAttribute('aria-current')).toBe('true');

    await act(async () => {
      ticks[target]?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }),
      );
      window.dispatchEvent(new Event('scroll'));
    });
    expect(ticks[target]?.getAttribute('aria-current')).toBe('true');
    expect(current()).toBe(target);

    host.removeEventListener('click', stopClick, true);
  });
});
