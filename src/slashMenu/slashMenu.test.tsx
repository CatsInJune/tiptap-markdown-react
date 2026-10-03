/** @vitest-environment happy-dom */
import { Markdown } from '@tiptap/markdown';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { findSuggestionMatch } from '@tiptap/suggestion';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CitationRef } from '../CitationRef';
import { baseExtensions, pureChart, pureCodeBlock, pureImage } from '../extensions';
import { createDefaultSlashMenuItems, filterSlashItems } from './items';
import { SlashMenu } from './SlashMenuExtension';
import { SlashMenuPopup } from './SlashMenuPopup';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

function createEditor(initial = ''): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
      pureChart,
      CitationRef,
      Markdown,
      SlashMenu,
    ],
    content: initial,
    contentType: 'markdown',
  });
}

describe('斜杠触发规则（行首或空白后，空白含全角）', () => {
  // 复用 suggestion 自己的 findSuggestionMatch，直接断言 allowedPrefixes 语义
  function match(text: string) {
    const editor = new Editor({
      extensions: [StarterKit.configure({ codeBlock: false })],
      content: text,
    });
    const $pos = editor.state.doc.resolve(editor.state.doc.content.size - 1);
    const result = findSuggestionMatch({
      char: '/',
      allowSpaces: false,
      allowToIncludeChar: false,
      allowedPrefixes: [' ', '\t', '\u3000'],
      startOfLine: false,
      $position: $pos,
    });
    editor.destroy();
    return result;
  }

  it('行首触发', () => {
    expect(match('/命令')).not.toBeNull();
  });

  it('半角空格后触发', () => {
    expect(match('你好 /命令')).not.toBeNull();
  });

  it('全角空格（U+3000）后触发', () => {
    expect(match('你好\u3000/命令')).not.toBeNull();
  });

  it('tab 后触发', () => {
    expect(match('你好\t/命令')).not.toBeNull();
  });

  it('中文词中间不触发（「和/或」不误弹）', () => {
    expect(match('和/或')).toBeNull();
  });
});

describe('命令项过滤', () => {
  const items = createDefaultSlashMenuItems();

  it('空 query 返回全部', () => {
    expect(filterSlashItems(items, '')).toHaveLength(items.length);
    expect(filterSlashItems(items, '   ')).toHaveLength(items.length);
  });

  it('拼音全拼命中', () => {
    const ids = filterSlashItems(items, 'biaoti').map((i) => i.id);
    expect(ids).toEqual(['heading-1', 'heading-2', 'heading-3']);
  });

  it('中文关键词命中', () => {
    expect(filterSlashItems(items, '表格').map((i) => i.id)).toEqual(['table']);
    expect(filterSlashItems(items, '公式').map((i) => i.id)).toEqual([
      'inline-math',
      'block-math',
    ]);
  });

  it('大小写不敏感', () => {
    expect(filterSlashItems(items, 'GongShi').map((i) => i.id)).toEqual([
      'inline-math',
      'block-math',
    ]);
  });

  it('不认识的前缀返回空', () => {
    expect(filterSlashItems(items, 'zzz')).toEqual([]);
  });
});

describe('命令项分组', () => {
  const items = createDefaultSlashMenuItems();

  it('默认项分三组且相邻同名（弹窗按相邻变化分节）', () => {
    const groups = items.map((i) => i.group);
    expect(new Set(groups)).toHaveProperty('size', 3);
    const transitions = groups.filter((g, i) => i > 0 && g !== groups[i - 1]);
    expect(transitions).toHaveLength(2);
  });

  it('文本组是正文 + 三级标题', () => {
    const text = items.filter((i) => i.group === items[0].group);
    expect(text.map((i) => i.id)).toEqual([
      'normal-text',
      'heading-1',
      'heading-2',
      'heading-3',
    ]);
  });
});

describe('默认命令项：插入可序列化 + 单步撤销', () => {
  const items = createDefaultSlashMenuItems();

  // 每项断言：删掉「/」并应用后，markdown 出现期望序列化；一次 undo 回到原文。
  const expectations: Record<string, RegExp | string> = {
    'normal-text': /^x\s$/,
    'heading-1': '# x',
    'heading-2': '## x',
    'heading-3': '### x',
    'bullet-list': '- x',
    'ordered-list': '1. x',
    'task-list': '- [ ] x',
    blockquote: '> x',
    'code-block': '```',
    divider: /---/,
    table: '|',
    'inline-math': '$$E=mc^2$$',
    'block-math': '$$\nE=mc^2\n$$',
  };

  for (const item of items) {
    it(`「${item.id}」插入后 markdown 可序列化且撤销一步还原`, () => {
      const editor = createEditor('x /');
      // 「/」在文本节点「x /」中的位置：doc 头 1 + 「x 」2 字符 = 3..4
      item.apply(editor, { from: 3, to: 4 });

      const md = editor.getMarkdown();
      const expected = expectations[item.id];
      if (expected instanceof RegExp) expect(md).toMatch(expected);
      else expect(md).toContain(expected);

      // 单事务：一步撤销必须回到「x /」
      expect(editor.can().undo()).toBe(true);
      editor.commands.undo();
      expect(editor.getMarkdown()).toBe('x /');
      // 再撤销应该没有历史了
      expect(editor.can().undo()).toBe(false);
      editor.destroy();
    });
  }
});

describe('SlashMenu 扩展', () => {
  it('注册后编辑器可正常创建与序列化（冒烟）', () => {
    const editor = createEditor('你好 /世界');
    expect(editor.getMarkdown()).toBe('你好 /世界');
    editor.destroy();
  });
});

describe('SlashMenuPopup 渲染', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    host?.remove();
  });

  it('按相邻分组渲染节标题，选项数与项数一致', async () => {
    const items = createDefaultSlashMenuItems();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <SlashMenuPopup items={items} query="" menuLabel="insert" command={() => {}} />,
      );
    });

    const options = host.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(items.length);
    const headers = [...host.querySelectorAll('[class*="groupLabel"]')].map(
      (h) => h.textContent,
    );
    expect(headers).toEqual(['Text', 'Lists', 'Advanced']);
    // 第一项默认高亮
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('零匹配渲染 null（弹层隐藏但插件保持激活）', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <SlashMenuPopup
          items={[]}
          query="zzz"
          menuLabel="insert"
          command={() => {}}
        />,
      );
    });
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });
});
