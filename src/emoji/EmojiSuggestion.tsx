import type { EmojiItem } from '@tiptap/extension-emoji';
import { EmojiSuggestionPluginKey } from '@tiptap/extension-emoji';
import type { AnyExtension, Editor, Range } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getEditorBundle } from '../i18n/store';
import styles from '../styles/emojiSuggestion.module.css';
import { EMOJI_CATEGORIES, itemsInCategory, type EmojiCategoryId } from './emojiCategories';
import { filterEmojiItems } from './filterEmoji';

/** 与样式里的 8 列对齐，方向键按格子移动。 */
const COLUMNS = 8;

export interface EmojiSuggestionPopupHandle {
  /** 编辑器键盘事件经 IME 守卫后委托进来；返回 true 表示已消费。 */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface EmojiSuggestionPopupProps {
  items: EmojiItem[];
  query: string;
  menuLabel: string;
  command: (item: EmojiItem) => void;
}

/** 输入法组合态下的按键交给 IME 自己处理（上游 suggestion 不查 composing）。 */
function isComposing(event: KeyboardEvent, view: { composing: boolean }): boolean {
  return view.composing || event.isComposing || event.keyCode === 229;
}

const themeVars = [
  '--tmr-text',
  '--tmr-accent',
  '--tmr-toolbar-border',
  '--tmr-toolbar-muted',
] as const;

function copyThemeVars(from: HTMLElement, to: HTMLElement) {
  const computed = getComputedStyle(from);
  for (const name of themeVars) {
    const value = computed.getPropertyValue(name);
    if (value) to.style.setProperty(name, value);
  }
}

function moveIndex(index: number, key: string, length: number, shiftKey: boolean): number | null {
  if (key === 'ArrowRight' || (key === 'Tab' && !shiftKey)) {
    return (index + 1) % length;
  }
  if (key === 'ArrowLeft' || (key === 'Tab' && shiftKey)) {
    return (index - 1 + length) % length;
  }
  if (key === 'ArrowDown') {
    const next = index + COLUMNS;
    return next < length ? next : null;
  }
  if (key === 'ArrowUp') {
    const next = index - COLUMNS;
    return next >= 0 ? next : null;
  }
  return null;
}

function keepCellInView(menu: HTMLElement, cell: HTMLElement) {
  const menuRect = menu.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  if (cellRect.top < menuRect.top) menu.scrollTop -= menuRect.top - cellRect.top;
  else if (cellRect.bottom > menuRect.bottom) {
    menu.scrollTop += cellRect.bottom - menuRect.bottom;
  }
}

/**
 * 冒号表情格子。空查询按底部分类标签浏览；继续打短码则在全部分类里筛选。
 * 定位由 @tiptap/suggestion 的 mount 接管。
 */
export const EmojiSuggestionPopup = forwardRef<
  EmojiSuggestionPopupHandle,
  EmojiSuggestionPopupProps
>(function EmojiSuggestionPopup({ items, query, menuLabel, command }, ref) {
  const gridId = useId();
  const browsing = !query.trim();
  const [categoryId, setCategoryId] = useState<EmojiCategoryId>(EMOJI_CATEGORIES[0].id);
  const [index, setIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const categories = useMemo(
    () => EMOJI_CATEGORIES.filter((category) => itemsInCategory(items, category.id).length > 0),
    [items],
  );
  const activeId = categories.some((category) => category.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? EMOJI_CATEGORIES[0].id);
  const visible = browsing ? itemsInCategory(items, activeId) : items;

  useEffect(() => {
    setIndex(0);
    menuRef.current?.scrollTo(0, 0);
  }, [query, activeId]);

  useEffect(() => {
    const menu = menuRef.current;
    const cell = cellRefs.current[index];
    if (menu && cell) keepCellInView(menu, cell);
  }, [index, activeId, query]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (!visible.length) return false;
        const next = moveIndex(index, event.key, visible.length, event.shiftKey);
        if (next !== null) {
          setIndex(next);
          return true;
        }
        if (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'Tab'
        ) {
          return true;
        }
        if (event.key === 'Enter') {
          const item = visible[index];
          if (!item) return false;
          command(item);
          return true;
        }
        return false;
      },
    }),
    [visible, index, command],
  );

  if (!visible.length) return null;

  return (
    <div className={styles.panel}>
      <div
        id={gridId}
        ref={menuRef}
        className={styles.menu}
        role="listbox"
        aria-label={menuLabel}
      >
        {visible.map((item, i) => {
          const shortcode = `:${item.name}:`;
          return (
            <button
              key={item.name}
              ref={(node) => {
                cellRefs.current[i] = node;
              }}
              type="button"
              role="option"
              aria-label={shortcode}
              aria-selected={i === index}
              title={shortcode}
              className={i === index ? styles.cellActive : styles.cell}
              tabIndex={-1}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(event) => {
                event.preventDefault();
                command(item);
              }}
            >
              {item.emoji}
            </button>
          );
        })}
      </div>
      {browsing ? (
        <div className={styles.tabs} role="tablist" aria-label={menuLabel}>
          {categories.map((category) => {
            const selected = category.id === activeId;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={gridId}
                aria-label={category.label}
                title={category.label}
                className={selected ? styles.tabActive : styles.tab}
                tabIndex={-1}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setCategoryId(category.id);
                }}
              >
                {category.icon}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

/**
 * 把 schema 上的 emoji 扩展配成带（或不带）建议列表的那一份。
 * configure 深合并 options，官方的 command / char / pluginKey 留着。
 * 关掉时 allow 恒为 false：不弹层，`:smile:` 输入规则仍在。
 */
export function configureEmojiSuggestion(
  extension: AnyExtension,
  enabled: boolean,
): AnyExtension {
  if (!enabled) {
    return extension.configure({
      suggestion: { allow: () => false },
    });
  }

  return extension.configure({
    suggestion: {
      pluginKey: EmojiSuggestionPluginKey,
      items: ({ editor, query }: { editor: Editor; query: string }) =>
        filterEmojiItems(editor.storage.emoji.emojis, query),
      allow: ({
        editor,
        state,
        range,
      }: {
        editor: Editor;
        state: EditorState;
        range: Range;
      }) => {
        if (!editor.isEditable) return false;
        if (editor.isActive('code') || editor.isActive('codeBlock')) return false;
        const type = state.schema.nodes.emoji;
        if (!type) return false;
        return !!state.doc.resolve(range.from).parent.type.contentMatch.matchType(type);
      },
      render: () => {
        let renderer: ReactRenderer<EmojiSuggestionPopupHandle> | null = null;
        let unmountPopup: (() => void) | null = null;
        return {
          onStart: (props: SuggestionProps<EmojiItem>) => {
            renderer = new ReactRenderer(EmojiSuggestionPopup, {
              editor: props.editor,
              props: {
                items: props.items,
                query: props.query,
                menuLabel: getEditorBundle(props.editor).emoji.menuLabel,
                command: props.command,
              },
              className: styles.popupHost,
            });
            copyThemeVars(props.editor.view.dom, renderer.element);
            unmountPopup = props.mount(renderer.element);
          },
          onUpdate: (props: SuggestionProps<EmojiItem>) => {
            renderer?.updateProps({
              items: props.items,
              query: props.query,
              menuLabel: getEditorBundle(props.editor).emoji.menuLabel,
              command: props.command,
            });
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (!renderer || isComposing(props.event, props.view)) return false;
            return renderer.ref?.onKeyDown(props.event) ?? false;
          },
          onExit: () => {
            unmountPopup?.();
            unmountPopup = null;
            renderer?.destroy();
            renderer = null;
          },
        };
      },
    },
  });
}
