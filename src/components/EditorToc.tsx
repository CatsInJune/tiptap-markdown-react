'use client';

import { useEffect, useRef, useState } from 'react';
import { getLocaleBundle, type LocaleCode } from '../i18n';
import styles from '../styles/editorToc.module.css';
import type { TocItem } from '../toc/extractToc';
import { scrollToTocHeading } from '../toc/scrollToTocHeading';

/** 短横线宽度：层级越高越长。 */
function barWidth(level: number): number {
  if (level <= 1) return 16;
  if (level === 2) return 12;
  if (level === 3) return 8;
  return 6;
}

/**
 * 最近的可滚动祖先。限高但还没溢出的容器也算（内容变长后由它滚）。
 * 都没有时用文档滚动根。
 */
function findScrollParent(start: HTMLElement): HTMLElement {
  let node: HTMLElement | null = start.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (
      canScroll &&
      (node.scrollHeight > node.clientHeight + 1 || style.maxHeight !== 'none')
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

function isViewportScroller(node: HTMLElement): boolean {
  return (
    node === document.documentElement ||
    node === document.body ||
    node === document.scrollingElement
  );
}

export interface EditorTocProps {
  items: TocItem[];
  /** 编辑器正文根节点，用来找标题和滚动容器。 */
  editorDom: HTMLElement;
  locale?: LocaleCode;
}

/**
 * 编辑器内目录（Notion 式，贴在左缘）。
 * 收起是一列短横线；悬停或聚焦向右展开标题，点击滚到对应标题。
 */
export function EditorToc({ items, editorDom, locale = 'en' }: EditorTocProps) {
  const t = getLocaleBundle(locale).toc;
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const [roving, setRoving] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hideTimer = useRef<number | null>(null);
  /** 点击后先钉住这一项。正文不够长、滚不到激活线时，滚动监听不能把它盖掉。 */
  const pinnedId = useRef<string | null>(null);
  const pinScroll = useRef<number | null>(null);
  const pinTimer = useRef<number | null>(null);

  const clearHide = () => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const show = () => {
    clearHide();
    setOpen(true);
  };

  const hideSoon = () => {
    clearHide();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      if (navRef.current?.contains(document.activeElement)) return;
      setOpen(false);
    }, 80);
  };

  useEffect(
    () => () => {
      clearHide();
      if (pinTimer.current !== null) window.clearTimeout(pinTimer.current);
    },
    [],
  );

  // 视口上半区里最靠上的标题为当前章节；都离开上半区时，取已经滚过去的最后一个。
  useEffect(() => {
    const headings = items
      .map((item) =>
        editorDom.querySelector<HTMLElement>(
          `[data-toc-id="${CSS.escape(item.id)}"]`,
        ),
      )
      .filter((el): el is HTMLElement => el !== null);
    if (!headings.length) return;

    const scrollParent = findScrollParent(editorDom);
    const viewport = isViewportScroller(scrollParent);
    const visible = new Set<Element>();

    const scrollPos = () =>
      viewport ? window.scrollY : scrollParent.scrollTop;

    const apply = () => {
      const pos = scrollPos();
      if (pinnedId.current) {
        const lockedAt = pinScroll.current;
        if (lockedAt === null || Math.abs(pos - lockedAt) <= 2) {
          setActiveId(pinnedId.current);
          return;
        }
        pinnedId.current = null;
        pinScroll.current = null;
      }

      const maxScroll = viewport
        ? Math.max(
            0,
            (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
          )
        : Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
      // 已经滚到底、后面没有更多正文时，当前项是视口里最靠下的标题。
      if (maxScroll > 1 && pos >= maxScroll - 2) {
        const rootBottom = viewport
          ? window.innerHeight
          : scrollParent.getBoundingClientRect().bottom;
        let lastInView: HTMLElement | null = null;
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top < rootBottom - 8) {
            lastInView = heading;
          }
        }
        const id = (lastInView ?? headings[headings.length - 1]).getAttribute(
          'data-toc-id',
        );
        if (id) setActiveId(id);
        return;
      }

      const rootTop = viewport ? 0 : scrollParent.getBoundingClientRect().top;
      let best: HTMLElement | null = null;
      let bestTop = Infinity;
      for (const el of visible) {
        const top = (el as HTMLElement).getBoundingClientRect().top;
        if (top < bestTop) {
          bestTop = top;
          best = el as HTMLElement;
        }
      }
      if (!best) {
        let last: HTMLElement | null = null;
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top <= rootTop + 12) last = heading;
        }
        best = last ?? headings[0];
      }
      const id = best.getAttribute('data-toc-id');
      if (id) setActiveId(id);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        apply();
      },
      {
        root: viewport ? null : scrollParent,
        rootMargin: '0px 0px -60% 0px',
        threshold: [0, 1],
      },
    );
    for (const heading of headings) observer.observe(heading);

    const onScroll = () => apply();
    const scrollTarget: HTMLElement | Window = viewport ? window : scrollParent;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    apply();

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener('scroll', onScroll);
    };
  }, [items, editorDom]);

  // 目录没被键盘占用时，下一个 Tab 落在当前章节上。
  useEffect(() => {
    if (navRef.current?.contains(document.activeElement)) return;
    const index = items.findIndex((item) => item.id === activeId);
    if (index >= 0) setRoving(index);
  }, [activeId, items]);

  useEffect(() => {
    if (!open || !activeId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    navRef.current
      ?.querySelector(`[data-toc-item="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeId, open]);

  const jump = (item: TocItem) => {
    const scroller = findScrollParent(editorDom);
    pinnedId.current = item.id;
    pinScroll.current = null;
    setActiveId(item.id);
    scrollToTocHeading(item.id, scroller);
    if (pinTimer.current !== null) window.clearTimeout(pinTimer.current);
    pinTimer.current = window.setTimeout(() => {
      pinTimer.current = null;
      if (pinnedId.current !== item.id) return;
      pinScroll.current = isViewportScroller(scroller)
        ? window.scrollY
        : scroller.scrollTop;
    }, 480);
  };

  const move = (delta: number) => {
    const next = Math.min(items.length - 1, Math.max(0, roving + delta));
    setRoving(next);
    setOpen(true);
    itemRefs.current[next]?.focus();
  };

  return (
    <div className={styles.anchor}>
      <nav
        ref={navRef}
        className={open ? styles.navOpen : styles.nav}
        aria-label={t.title}
        data-editor-toc=""
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) hideSoon();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <ul className={styles.list}>
          {items.map((item, index) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  data-toc-item={item.id}
                  tabIndex={index === roving ? 0 : -1}
                  className={
                    open
                      ? `${styles.item} ${active ? styles.itemActive : ''}`
                      : styles.barButton
                  }
                  style={
                    open
                      ? { paddingLeft: `${(item.level - 1) * 12 + 10}px` }
                      : undefined
                  }
                  aria-current={active ? 'true' : undefined}
                  aria-label={item.text}
                  onClick={() => jump(item)}
                >
                  {open ? (
                    <span className={styles.itemText}>{item.text}</span>
                  ) : (
                    <span
                      className={active ? styles.barActive : styles.bar}
                      style={{ width: barWidth(item.level) }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
