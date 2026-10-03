/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MarkdownWysiwygEditor } from './MarkdownWysiwygEditor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

/**
 * 快捷键悬浮键的落点：不给容器时在编辑器内（sticky），
 * 给了 shortcutFabContainer 就 portal 进去且去掉粘性定位（定位归宿主）。
 */
describe('快捷键悬浮键的宿主容器', () => {
  let host: HTMLDivElement;
  let slot: HTMLDivElement;
  let root: Root;

  interface MountOpts {
    container?: boolean;
    editable?: boolean;
    shortcutPanel?: boolean;
  }

  function mount(opts: MountOpts = {}) {
    host = document.createElement('div');
    slot = document.createElement('div');
    document.body.append(host, slot);
    root = createRoot(host);
    const props: Record<string, unknown> = {};
    // slot 必须在建好之后再引用——调用方先读外层变量会拿到 undefined
    if (opts.container) props.shortcutFabContainer = slot;
    if (opts.editable === false) props.editable = false;
    if (opts.shortcutPanel === false) props.shortcutPanel = false;
    return act(async () => {
      root.render(<MarkdownWysiwygEditor initialMarkdown="hi" {...props} />);
    });
  }

  function fabIn(el: HTMLElement) {
    return [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Shortcuts',
    );
  }

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    host?.remove();
    slot?.remove();
  });

  it('给了容器：按钮 portal 进容器且带 hosted 覆盖（无粘性定位）', async () => {
    await mount({ container: true });
    const fab = fabIn(slot);
    expect(fab).toBeTruthy();
    expect(fab?.className).toContain('shortcutFabHosted');
    // 编辑器内容区里不再有悬浮键
    expect(fabIn(host)).toBeUndefined();
  });

  it('不给容器：按钮留在编辑器内（sticky 形态，无 hosted 覆盖）', async () => {
    await mount();
    const fab = fabIn(host);
    expect(fab).toBeTruthy();
    expect(fab?.className).not.toContain('shortcutFabHosted');
    expect(fabIn(slot)).toBeUndefined();
  });

  it('只读态：给了容器也不渲染按钮', async () => {
    await mount({ container: true, editable: false });
    expect(fabIn(slot)).toBeUndefined();
    expect(fabIn(host)).toBeUndefined();
  });

  it('shortcutPanel=false：容器里不渲染按钮', async () => {
    await mount({ container: true, shortcutPanel: false });
    expect(fabIn(slot)).toBeUndefined();
  });
});
