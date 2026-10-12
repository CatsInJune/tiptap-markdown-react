/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baseExtensions } from '../extensions';
import { EMOJI_CATEGORIES } from './emojiCategories';
import { EmojiSuggestionPopup } from './EmojiSuggestion';
import { filterEmojiItems } from './filterEmoji';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function allItems() {
  const editor = new Editor({
    extensions: [...baseExtensions, Markdown],
    content: '',
  });
  const items = filterEmojiItems(editor.storage.emoji.emojis, '');
  editor.destroy();
  return items;
}

describe('表情分类标签', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
  });

  it('底部分类标签切换格子，搜索时隐藏标签', async () => {
    const items = allItems();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <EmojiSuggestionPopup items={items} query="" menuLabel="Emoji" command={() => {}} />,
      );
    });

    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(
      EMOJI_CATEGORIES.map((category) => category.label),
    );
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('[role="option"]')?.getAttribute('aria-label')).toBe(
      ':grinning:',
    );

    const food = tabs.find((tab) => tab.getAttribute('aria-label') === 'Food & drink');
    await act(async () => {
      food?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    const labels = [...host.querySelectorAll('[role="option"]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(labels).toContain(':pizza:');
    expect(labels).not.toContain(':grinning:');
    expect(food?.getAttribute('aria-selected')).toBe('true');

    await act(async () => {
      root.render(
        <EmojiSuggestionPopup
          items={filterEmojiItems(items, 'pizza')}
          query="pizza"
          menuLabel="Emoji"
          command={() => {}}
        />,
      );
    });
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.querySelector('[role="option"]')?.getAttribute('aria-label')).toBe(':pizza:');
  });
});
