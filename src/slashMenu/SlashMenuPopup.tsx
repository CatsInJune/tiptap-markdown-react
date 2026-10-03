import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import styles from '../styles/slashMenu.module.css';
import type { SlashMenuItem } from './types';

export interface SlashMenuPopupHandle {
  /** 编辑器键盘事件经 IME 守卫后委托进来；返回 true 表示已消费。 */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface SlashMenuPopupProps {
  items: SlashMenuItem[];
  query: string;
  menuLabel: string;
  command: (item: SlashMenuItem) => void;
}

/**
 * 把有序列表切成「相邻同名组」的节：返回 [组名 | null, 项][]。
 * 组首项的行携带组名（渲染为节标题 + 该项），其余行组名为 null。
 */
function withGroupHeaders(
  items: SlashMenuItem[],
): Array<[ReactNode, SlashMenuItem]> {
  const rows: Array<[ReactNode, SlashMenuItem]> = [];
  let lastGroup: string | undefined;
  for (const item of items) {
    if (item.group && item.group !== lastGroup) {
      rows.push([item.group, item]);
      lastGroup = item.group;
    } else {
      if (!item.group) lastGroup = undefined;
      rows.push([null, item]);
    }
  }
  return rows;
}

/**
 * 斜杠菜单弹层。样式对齐工具栏下拉菜单（radix 面板 + 文字字形图标 +
 * 品牌色高亮）；定位由 @tiptap/suggestion 的 mount（floating-ui）接管。
 * 零匹配时渲染 null：弹层隐藏但 suggestion 保持激活，query 恢复命中时
 * 重新出现。
 */
export const SlashMenuPopup = forwardRef<
  SlashMenuPopupHandle,
  SlashMenuPopupProps
>(function SlashMenuPopup({ items, query, menuLabel, command }, ref) {
  const [index, setIndex] = useState(0);

  // query 变化（过滤）后选区回到第一项
  useEffect(() => {
    setIndex(0);
  }, [query]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (!items.length) return false;
        if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[index];
          if (!item) return false;
          command(item);
          return true;
        }
        return false;
      },
    }),
    [items, index, command],
  );

  if (!items.length) return null;

  // 键盘索引按「可选项」计；分组头不占位
  let optionIndex = -1;

  return (
    <div className={styles.menu} role="listbox" aria-label={menuLabel}>
      {withGroupHeaders(items).map(([header, item]) => {
        optionIndex += 1;
        const i = optionIndex;
        return (
          <Fragment key={item.id}>
            {header !== null ? (
              <div className={styles.groupLabel} aria-hidden="true">
                {header}
              </div>
            ) : null}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              title={item.title}
              className={i === index ? styles.itemActive : styles.item}
              // 键盘焦点留在编辑器里，↑↓/Enter 才能继续驱动弹层
              tabIndex={-1}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                // 用 mousedown 抢在编辑器 blur 之前执行，避免选区先被抖掉
                e.preventDefault();
                command(item);
              }}
            >
              {item.icon != null ? (
                <span className={styles.itemIcon} aria-hidden="true">
                  {item.icon}
                </span>
              ) : (
                <span className={styles.itemIcon} aria-hidden="true" />
              )}
              <span className={styles.itemTitle}>{item.title}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
});
