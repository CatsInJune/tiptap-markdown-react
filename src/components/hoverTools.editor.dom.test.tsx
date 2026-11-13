// @vitest-environment happy-dom
import type { Editor } from '@tiptap/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorProps,
} from './MarkdownWysiwygEditor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const TABLE_MD = `| A | B |
| --- | --- |
| 1 | 2 |
`;

const BLOCK_MATH_MD = `$$
E=mc^2
$$`;

const IMAGE_MD = '![alt](https://example.com/x.png)';

/**
 * 编辑器壳的接线：悬停手柄 / 图片工具条 / 公式点击编辑不再依赖 <EditorToolbar>。
 * 几何量不了（happy-dom 的 getBoundingClientRect 全是 0），这里只钉「挂没挂上、只读出不出」。
 */
describe('MarkdownWysiwygEditor 自带的就地交互', () => {
  let host: HTMLDivElement;
  let root: Root | undefined;
  let editor: Editor | null;

  function mount(props: Partial<MarkdownWysiwygEditorProps> = {}) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    editor = null;
    return act(async () => {
      root?.render(
        <MarkdownWysiwygEditor
          initialMarkdown=""
          onEditorReady={(instance) => {
            editor = instance;
          }}
          {...props}
        />,
      );
    });
  }

  const hover = async (el: Element) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
  };

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
    document.querySelectorAll('[data-table-menu], [role="dialog"]').forEach((el) => {
      el.remove();
    });
  });

  it('表格悬停手柄由编辑器提供', async () => {
    await mount({ initialMarkdown: TABLE_MD });
    const cell = editor!.view.dom.querySelector('td, th')!;
    await hover(cell);
    expect(document.querySelector('[data-table-handle="row"]')).not.toBeNull();
    expect(document.querySelector('[data-table-handle="col"]')).not.toBeNull();
  });

  it('只读态不挂表格手柄', async () => {
    await mount({ initialMarkdown: TABLE_MD, editable: false });
    const cell = editor!.view.dom.querySelector('td, th')!;
    await hover(cell);
    expect(document.querySelector('[data-table-handle="row"]')).toBeNull();
  });

  it('图片悬停工具条由编辑器提供', async () => {
    await mount({ initialMarkdown: IMAGE_MD });
    const img = editor!.view.dom.querySelector('img');
    expect(img).not.toBeNull();
    await hover(img!);
    expect(document.querySelector('[data-image-align]')).not.toBeNull();
  });

  it('点击公式打开编辑层（不依赖工具栏）', async () => {
    await mount({ initialMarkdown: BLOCK_MATH_MD });
    const math = editor!.view.dom.querySelector('[data-type="block-math"]')!;
    await act(async () => {
      math.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
