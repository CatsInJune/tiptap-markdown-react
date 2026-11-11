// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCjkEmphasisMarked } from '../cjkEmphasis';
import { baseExtensions } from '../extensions';
import { loadVersionPreview } from './loadVersionPreview';
import { clearVersionJsonCache, recallVersionJson, versionCacheKey } from './versionJsonCache';

function flushIdle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildEditor(host?: HTMLElement): Editor {
  return new Editor({
    element: host,
    extensions: [
      ...baseExtensions,
      Markdown.configure({ marked: getCjkEmphasisMarked() }),
    ],
    content: '',
    editable: false,
  });
}

describe('loadVersionPreview', () => {
  let editor: Editor;

  beforeEach(() => {
    clearVersionJsonCache();
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      const id = window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
      return id;
    });
    vi.stubGlobal('cancelIdleCallback', (id: number) => {
      window.clearTimeout(id);
    });
    editor = buildEditor();
  });

  afterEach(() => {
    editor.destroy();
    clearVersionJsonCache();
    vi.unstubAllGlobals();
  });

  it('短文一次装完并写入缓存', async () => {
    let ready = false;
    loadVersionPreview({
      editor,
      markdown: '甲\n\n乙',
      cacheId: 'v-short',
      onReady: () => {
        ready = true;
      },
    });
    expect(ready).toBe(true);
    expect(editor.getText()).toContain('甲');
    expect(editor.getText()).toContain('乙');
    expect(recallVersionJson(versionCacheKey('v-short', '甲\n\n乙'))?.type).toBe('doc');
  });

  it('长文先装首屏，空闲后续装', async () => {
    const blocks = Array.from({ length: 12 }, (_, index) => `段${index}${'字'.repeat(900)}`);
    const markdown = blocks.join('\n\n');
    let ready = false;
    loadVersionPreview({
      editor,
      markdown,
      cacheId: 'v-long',
      onReady: () => {
        ready = true;
      },
    });
    expect(ready).toBe(false);
    expect(editor.getText()).toContain('段0');
    expect(editor.getText()).not.toContain('段11');
    for (let i = 0; i < 20 && !ready; i += 1) {
      await flushIdle();
    }
    expect(ready).toBe(true);
    expect(editor.getText()).toContain('段11');
  });

  it('切版取消后不再 onReady，也不写半截缓存', async () => {
    const blocks = Array.from({ length: 12 }, (_, index) => `段${index}${'字'.repeat(900)}`);
    const markdown = blocks.join('\n\n');
    let ready = false;
    const cancel = loadVersionPreview({
      editor,
      markdown,
      cacheId: 'v-cancel',
      onReady: () => {
        ready = true;
      },
    });
    cancel();
    for (let i = 0; i < 10; i += 1) {
      await flushIdle();
    }
    expect(ready).toBe(false);
    expect(recallVersionJson(versionCacheKey('v-cancel', markdown))).toBeNull();
  });

  it('有缓存时走 JSON 路径再装一遍结果一致', async () => {
    const markdown = Array.from({ length: 12 }, (_, index) => `段${index}${'字'.repeat(900)}`).join(
      '\n\n',
    );
    let ready = false;
    loadVersionPreview({
      editor,
      markdown,
      cacheId: 'v-cache',
      onReady: () => {
        ready = true;
      },
    });
    for (let i = 0; i < 20 && !ready; i += 1) {
      await flushIdle();
    }
    expect(ready).toBe(true);
    const first = editor.getJSON();

    editor.commands.setContent('');
    ready = false;
    loadVersionPreview({
      editor,
      markdown,
      cacheId: 'v-cache',
      onReady: () => {
        ready = true;
      },
    });
    for (let i = 0; i < 20 && !ready; i += 1) {
      await flushIdle();
    }
    expect(ready).toBe(true);
    expect(editor.getJSON()).toEqual(first);
  });

  it('续装时预览区滚动位置不变，选区也不被推到文末', async () => {
    const preview = document.createElement('div');
    preview.setAttribute('data-version-preview', '');
    preview.style.overflow = 'auto';
    preview.style.height = '120px';
    document.body.appendChild(preview);
    const mount = document.createElement('div');
    preview.appendChild(mount);
    editor.destroy();
    editor = buildEditor(mount);

    const blocks = Array.from({ length: 12 }, (_, index) => `段${index}${'字'.repeat(900)}`);
    const markdown = blocks.join('\n\n');
    let ready = false;
    loadVersionPreview({
      editor,
      markdown,
      cacheId: 'v-scroll',
      onReady: () => {
        ready = true;
      },
    });
    expect(preview.scrollTop).toBe(0);
    expect(editor.state.selection.from).toBe(1);

    preview.scrollTop = 40;
    for (let i = 0; i < 20 && !ready; i += 1) {
      await flushIdle();
    }
    expect(ready).toBe(true);
    expect(preview.scrollTop).toBe(40);
    expect(editor.state.selection.from).toBe(1);

    preview.remove();
  });
});
