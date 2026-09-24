// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { FindReplaceBar, type FindReplaceBarProps } from './FindReplaceBar';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function buildEditor(markdown: string, editable = true): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 0 }),
      Markdown,
    ],
    content: markdown,
    contentType: 'markdown',
    editable,
  });
}

/** React 19 的受控 input：必须走原生 setter 再派发 input，onChange 才会触发。 */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('FindReplaceBar', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const mount = async (props: Partial<FindReplaceBarProps> & { editor: Editor }) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<FindReplaceBar onClose={() => {}} {...props} />);
    });
    return host;
  };

  const inputByLabel = (label: string) =>
    host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const buttonByLabel = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  const click = async (el: HTMLElement) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const counterText = () => host.querySelector('[aria-live="polite"]')!.textContent;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
    vi.useRealTimers();
  });

  it('输入查询 → 计数出现，下一处 / 上一处循环导航', async () => {
    vi.useFakeTimers();
    editor = buildEditor('one two one');
    await mount({ editor });

    await act(async () => {
      typeInto(inputByLabel('Find'), 'one');
    });
    // 浮动条自带防抖（FIND_DEBOUNCE_MS），到期才推给编辑器
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(counterText()).toBe('1 / 2');

    await click(buttonByLabel('Next match'));
    expect(counterText()).toBe('2 / 2');

    await click(buttonByLabel('Next match'));
    expect(counterText()).toBe('1 / 2');

    await click(buttonByLabel('Previous match'));
    expect(counterText()).toBe('2 / 2');
  });

  it('替换：填替换词后点「替换」改正文', async () => {
    vi.useFakeTimers();
    editor = buildEditor('one two one');
    await mount({ editor });

    await act(async () => {
      typeInto(inputByLabel('Find'), 'one');
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      typeInto(inputByLabel('Replace with'), 'X');
    });
    await act(async () => {
      host
        .querySelectorAll('button')
        .forEach((b) => b.textContent === 'Replace' && b.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    });

    expect(editor.getMarkdown()).toBe('X two one');
  });

  it('关闭：Esc 调 onClose（焦点归还在宿主侧）', async () => {
    const onClose = vi.fn();
    editor = buildEditor('one two one');
    await mount({ editor, onClose });

    await act(async () => {
      host
        .querySelector('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('只读态：只查不换，替换行收起', async () => {
    editor = buildEditor('one two one', false);
    await mount({ editor });

    expect(host.querySelector('input[aria-label="Replace with"]')).toBeNull();
    expect(host.textContent).toContain('Read-only');
  });

  it('文案可注入', async () => {
    editor = buildEditor('one two one');
    await mount({
      editor,
      labels: { find: '查找', next: '下一处', close: '关闭', readOnly: '只读' },
    });

    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('查找');
    expect(buttonByLabel('下一处')).not.toBeNull();
    expect(buttonByLabel('关闭')).not.toBeNull();
  });

  it('扩展没注册时：不渲染、不抛错（宿主自己摆条子却忘了开 findReplace）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 故意不注册官方扩展的编辑器
    editor = new Editor({
      extensions: [...baseExtensions, Markdown],
      content: 'one two one',
      contentType: 'markdown',
    });

    await mount({ editor });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('FindReplaceBar 需要官方 find 扩展'));
    warn.mockRestore();
  });

  it('正则模式：非法模式给出提示而不是一直 0 / 0', async () => {
    vi.useFakeTimers();
    editor = buildEditor('a1 b2');
    await mount({ editor });

    // 条子上不再带正则开关（要正则由宿主自己开命令），所以这里直接走命令
    await act(async () => {
      editor.commands.setUseRegex(true);
    });
    await act(async () => {
      typeInto(inputByLabel('Find'), '(?=x)');
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(counterText()).toBe('Invalid pattern');
  });
});
