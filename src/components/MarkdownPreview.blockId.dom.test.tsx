// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BlockIdMarkdown } from '../blockId/BlockIdMarkdown';
import { getCjkEmphasisMarked } from '../cjkEmphasis';
import { baseExtensions } from '../extensions';
import { MarkdownPreview } from './MarkdownPreview';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

describe('MarkdownPreview 与块 ID 注释', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('共享 marked 被编辑器注册过 ID tokenizer 后，预览仍确定性地不显示注释', async () => {
    // 模拟同进程里先挂过一个块 ID 编辑器：tokenizer 已注册进共享 marked。
    // 预览走官方 Markdown，若不显式剥离，同一行会变成无 handler 的未知 token
    // 被静默丢弃（未挂过时则是普通 HTML 注释）——输出依赖挂载顺序。
    const polluted = new Editor({
      extensions: [
        ...baseExtensions,
        BlockIdMarkdown.configure({ marked: getCjkEmphasisMarked() }),
      ],
      content: 'x',
    });
    polluted.destroy();

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <MarkdownPreview
          markdown={[
            '<!--b:b_one-->',
            '## 标题',
            '',
            '<!--b:b_two-->',
            '正文。',
          ].join('\n')}
        />,
      );
    });
    await act(async () => {});

    const text = host.textContent ?? '';
    expect(text).toContain('标题');
    expect(text).toContain('正文。');
    expect(text).not.toContain('<!--b:');
  });
});
