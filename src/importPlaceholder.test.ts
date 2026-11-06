// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { ImportPlaceholder } from './importPlaceholder';

function build(content = 'hello'): Editor {
  return new Editor({
    extensions: [...baseExtensions, ImportPlaceholder, Markdown],
    content,
    contentType: 'markdown',
  });
}

function labelsInDoc(editor: Editor): string[] {
  const found: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'importPlaceholder') {
      found.push(String(node.attrs.label ?? ''));
    }
  });
  return found;
}

describe('ImportPlaceholder', () => {
  it('insert / update / remove，且不进 Markdown', () => {
    const editor = build();
    expect(editor.commands.insertImportPlaceholder('Uploading 0%')).toBe(true);
    expect(labelsInDoc(editor)).toEqual(['Uploading 0%']);
    expect(editor.getMarkdown()).not.toContain('Uploading');
    expect(editor.getMarkdown()).toContain('hello');

    expect(editor.commands.updateImportPlaceholder('Uploading 42%')).toBe(true);
    expect(labelsInDoc(editor)).toEqual(['Uploading 42%']);
    expect(editor.getMarkdown()).not.toContain('42%');

    expect(editor.commands.removeImportPlaceholder()).toBe(true);
    expect(labelsInDoc(editor)).toEqual([]);
    expect(editor.getMarkdown()).toContain('hello');
    editor.destroy();
  });

  it('进度更新时转圈节点还是原来那个', () => {
    const editor = build();
    expect(editor.commands.insertImportPlaceholder('Uploading 0%')).toBe(true);
    const spin = editor.view.dom.querySelector('.tmr-import-placeholder-spin');
    const label = editor.view.dom.querySelector('.tmr-import-placeholder-label');
    expect(spin).not.toBeNull();
    expect(label?.textContent).toBe('Uploading 0%');

    expect(editor.commands.updateImportPlaceholder('Uploading 29%')).toBe(true);
    expect(editor.commands.updateImportPlaceholder('Uploading 64%')).toBe(true);

    expect(editor.view.dom.querySelector('.tmr-import-placeholder-spin')).toBe(spin);
    expect(editor.view.dom.querySelector('.tmr-import-placeholder-label')).toBe(label);
    expect(label?.textContent).toBe('Uploading 64%');
    editor.destroy();
  });

  it('不在 baseExtensions 里，避免 SSR 渲染出占位块', () => {
    expect(
      baseExtensions.some((ext) => ext.name === ImportPlaceholder.name),
    ).toBe(false);
  });
});
