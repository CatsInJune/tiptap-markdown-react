'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { ChevronDownIcon, ListUnorderedIcon, LockIcon, MenuIcon } from '../icons';
import { defaultTocLabels, type TocLabels } from '../labels';
import styles from '../styles/tocPanel.module.css';
import type { TocItem } from '../toc/extractToc';

export interface TocPanelProps {
  items: TocItem[];
  /** 当前高亮的锚点 id（阅读页由 IntersectionObserver 算、编辑页由光标章节算）。 */
  activeId?: string;
  /** 点击目录项。锁住项不触发。默认行为由调用方决定（滚动 / 跳转）。 */
  onItemClick?: (item: TocItem) => void;
  labels?: Partial<TocLabels>;
}

/**
 * 目录面板（阅读页 + 编辑页共用）。
 *
 * - 桌面：左侧粘性栏，可收起（«/»）。
 * - 移动：顶部可折叠「目录」条，选中后自动收起。
 * - 层级用左缩进；active accent 左边框 + 加粗；locked 置灰 + 锁图标不可点。
 *
 * 纯展示：滚动 / active 计算交给调用方，本组件只渲染 + 派发点击。
 */
export function TocPanel({ items, activeId, onItemClick, labels }: TocPanelProps) {
  const t = { ...defaultTocLabels, ...labels };
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopNavRef = useRef<HTMLElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // activeId 变化时把当前高亮项滚入 TOC 可视区（仅在不可见时）。
  useEffect(() => {
    if (!activeId) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const container = desktopNavRef.current || mobilePanelRef.current;
    if (!container) return;
    const el = container.querySelector(`a[href="#${CSS.escape(activeId)}"]`);
    if (!el) return;
    el.scrollIntoView({
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [activeId]);

  if (!items.length) return null;

  const minLevel = Math.min(...items.map((i) => i.level));

  const handleClick = (item: TocItem) => {
    if (item.locked) return;
    onItemClick?.(item);
    if (isMobile) setMobileOpen(false);
  };

  const list = (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.locked ? undefined : `#${item.id}`}
            className={`${styles.item} ${
              item.id === activeId ? styles.active : ''
            } ${item.locked ? styles.locked : ''}`}
            style={{ paddingLeft: `${(item.level - minLevel) * 12 + 12}px` }}
            aria-current={item.id === activeId ? 'true' : undefined}
            aria-disabled={item.locked ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              handleClick(item);
            }}
          >
            <span className={styles.itemText}>{item.text}</span>
            {item.locked ? (
              <LockIcon className={styles.lockIcon} aria-hidden />
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );

  // ── 移动端：顶部可折叠条 ──
  if (isMobile) {
    return (
      <nav className={styles.mobile} aria-label={t.title}>
        <button
          type="button"
          className={styles.mobileBar}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <MenuIcon className={styles.mobileBarIcon} aria-hidden />
          <span>{t.title}</span>
          <span
            className={`${styles.chevron} ${
              mobileOpen ? styles.chevronUp : ''
            }`}
            aria-hidden
          >
            <ChevronDownIcon size={16} />
          </span>
        </button>
        <div
          ref={mobilePanelRef}
          className={`${styles.mobilePanel} ${
            mobileOpen ? styles.mobilePanelOpen : ''
          }`}
        >
          {list}
        </div>
      </nav>
    );
  }

  // ── 桌面：左侧粘性栏（可收起）──
  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.collapsedRail}
        aria-label={t.expand}
        title={t.expand}
        onClick={() => setCollapsed(false)}
      >
        <ListUnorderedIcon />
      </button>
    );
  }

  return (
    <nav className={styles.desktop} aria-label={t.title} ref={desktopNavRef}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t.title}</span>
        <button
          type="button"
          className={styles.collapseBtn}
          aria-label={t.collapse}
          title={t.collapse}
          onClick={() => setCollapsed(true)}
        >
          «
        </button>
      </div>
      {list}
    </nav>
  );
}
