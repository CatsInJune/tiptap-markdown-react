/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

describe('MarkdownPreview 内置目录', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  const mount = async (markdown: string, toc?: boolean) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<MarkdownPreview markdown={markdown} toc={toc} />);
    });
    await act(async () => {});
  };

  it('标题变成左缘短横线', async () => {
    await mount('# 简介\n\n段落\n\n## 细节\n', true);
    const ticks = host.querySelectorAll('[data-editor-toc] button');
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(host.querySelector('[data-toc-id]')).not.toBeNull();
  });

  it('toc={false} 不画目录，也不注册 TOC 扩展（标题无 data-toc-id）', async () => {
    await mount('# 简介\n', false);
    expect(host.querySelector('[data-editor-toc]')).toBeNull();
    // 不注册 TableOfContents：既不画目录，也不为标题注入锚点 / 每事务扫描。
    expect(host.querySelector('[data-toc-id]')).toBeNull();
  });
});
