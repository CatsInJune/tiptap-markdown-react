'use client';

import type { Editor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import type { SourceRef } from '../citationUtils';
import { getLocaleBundle, type LocaleCode } from '../i18n';
import { ChevronDownIcon, HistoryIcon, XIcon } from '../icons';
import { isSameVersionMarkdown, restoreVersionMarkdown } from '../versionHistory/restoreVersion';
import type { DocumentVersion } from '../versionHistory/types';
import { MarkdownPreview } from './MarkdownPreview';
import { VersionDiffView } from './VersionDiffView';
import styles from '../styles/versionHistory.module.css';

export type { DocumentVersion };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** 恢复提示（例如「章已不存在，插到光标处」）停留时长。 */
const NOTICE_MS = 6000;

/** 悬浮按钮相对定位边。数字是 px。不传时叠在快捷键悬浮钮上方。 */
export interface HistoryButtonOffset {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
}

export interface VersionHistoryPanelProps {
  /** 要恢复进的编辑器。对比「当前文档」时也读它的 markdown。 */
  editor: Editor;
  /** 按宿主给定的顺序渲染，不重排（宿主按时间倒序平铺全部快照）。 */
  versions: DocumentVersion[];
  /** 受控的选中版本。不传则面板自己记住，默认第一条（最新一版）。 */
  selectedId?: string;
  onSelectedIdChange?: (id: string) => void;
  /**
   * 列表行不带全文（`markdown` 为空）时，选中/对比该版本前调用它取全文。
   * 宿主接单条快照接口；面板会缓存结果并在加载期间显示加载态。
   */
  onLoadVersionContent?: (id: string) => Promise<string>;
  /**
   * 正文已经写回编辑器之后调用。文档标题不在编辑器事务里，
   * 宿主要用 `version.documentTitle` 自己写回。
   */
  onRestore?: (version: DocumentVersion) => void;
  /** 弹窗关掉时调用（点遮罩、取消、关闭或 Esc）。 */
  onClose?: () => void;
  /** 受控的弹窗开关。不传则由悬浮按钮自己开关。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 内置语言，默认英文。 */
  locale?: LocaleCode;
  className?: string;
  /** 预览脚注时按 index 对齐，语义同 MarkdownPreview。 */
  sources?: SourceRef[];
  /**
   * 悬浮按钮的位置。不传则和快捷键悬浮钮右对齐，并留 12px 叠在它上方。
   * 传了 `left` 就不再钉右边，传了 `top` 就不再钉下边。
   * `buttonContainer` 路径下，这些偏移相对那个容器。
   */
  buttonOffset?: HistoryButtonOffset;
  /**
   * 把悬浮按钮挂进宿主的容器。给元素或返回元素的函数。
   * 挂进去后按钮改为相对容器绝对定位，弹窗仍盖住整个视口。
   * 容器自己要是定位上下文（`position` 不是 `static`）。
   */
  buttonContainer?: HTMLElement | null | (() => HTMLElement | null);
}

type ContentMap = Record<string, string>;

/**
 * 历史版本弹窗，版式对齐 Substack：左边读这一版，右边按时间列版本。
 * 组件自己带一枚悬浮按钮，点开才出现弹窗。
 *
 * 面板数据是报告全部快照的平铺列表（时间倒序、无章概念，含已删章的孤儿快照）。
 * 列表行可以只带元数据，正文由 `onLoadVersionContent` 按需取。
 *
 * 不对比时用只读预览。对比时画布仍是这一版，先把正文画出来，差异空闲时再叠上：
 * 绿色是只在这一版里的，删除线是只在比较对象里的。
 *
 * 恢复按版本所属章的首块 ID 定位：章还在 → 只替换该章范围；
 * 章已删 → 内容插到光标处并提示。旧快照没有块 ID 时整篇写回。
 * 恢复单独占一步撤销，撤销一次回到恢复前。
 *
 * 稳定选择器：弹窗 `data-version-history`，悬浮按钮 `data-version-action="open"`，
 * 条目 `data-version-id`，对比状态栏 `data-version-stage`，预览区 `data-version-preview`，
 * 对比对象 `select[data-version-target]`，
 * 按钮 `data-version-action="restore|close|compare"`，
 * 恢复提示 `data-version-notice`，高亮 `data-diff="insert|delete"`。
 */
export function VersionHistoryPanel({
  editor,
  versions,
  selectedId: selectedIdProp,
  onSelectedIdChange,
  onLoadVersionContent,
  onRestore,
  onClose,
  open: openProp,
  onOpenChange,
  locale = 'en',
  className,
  sources,
  buttonOffset,
  buttonContainer,
}: VersionHistoryPanelProps) {
  const t = getLocaleBundle(locale).history;
  const [mounted, setMounted] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  // 默认选中最新一版（宿主已按时间倒序）；不再做「当前稿对齐」全文比对。
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(
    () => versions[0]?.id ?? null,
  );
  const [compareId, setCompareId] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [buttonHost, setButtonHost] = useState<HTMLElement | null>(null);
  const [trackedStyle, setTrackedStyle] = useState<CSSProperties | null>(null);
  const [liveMarkdown, setLiveMarkdown] = useState<string | null>(null);
  const [loadedContent, setLoadedContent] = useState<ContentMap>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [loadErrorIds, setLoadErrorIds] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const loadedContentRef = useRef<ContentMap>({});
  const pendingLoadRef = useRef<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  const isOpen = openProp ?? uncontrolledOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const next =
      typeof buttonContainer === 'function' ? buttonContainer() : (buttonContainer ?? null);
    setButtonHost(next);
  }, [buttonContainer]);

  useLayoutEffect(() => {
    if (buttonOffset) {
      setTrackedStyle(null);
      return;
    }
    let current: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;

    const follow = (shortcut: HTMLElement | null) => {
      if (shortcut === current) {
        if (!shortcut) return;
        const next = styleAboveShortcut(shortcut);
        setTrackedStyle((prev) =>
          !next || (prev?.right === next.right && prev?.bottom === next.bottom) ? prev : next,
        );
        return;
      }
      resizeObserver?.disconnect();
      current = shortcut;
      if (!shortcut) return;
      const next = styleAboveShortcut(shortcut);
      setTrackedStyle((prev) =>
        !next || (prev?.right === next.right && prev?.bottom === next.bottom) ? prev : next,
      );
      resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => follow(current)) : null;
      resizeObserver?.observe(shortcut);
    };

    const sync = () => {
      let shortcut: HTMLElement | null = null;
      try {
        shortcut = findShortcutFab(editor, buttonHost);
      } catch {
        shortcut = null;
      }
      follow(shortcut);
    };

    sync();
    // 快捷键钮会先留在编辑器里，再被 portal 到底栏槽位。挂上之后重新量一次。
    const mutation =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              sync();
            });
          })
        : null;
    mutation?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutation?.disconnect();
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [buttonOffset, buttonHost, editor]);

  useEffect(() => {
    if (selectedIdProp !== undefined) return;
    if (versions.some((version) => version.id === uncontrolledId)) return;
    setUncontrolledId(versions[0]?.id ?? null);
  }, [versions, uncontrolledId, selectedIdProp]);

  // 只在面板打开时读当前稿，用来判断恢复按钮。关着不订 update，打字不必序列化全文。
  useEffect(() => {
    if (!isOpen) {
      setLiveMarkdown(null);
      return;
    }
    setLiveMarkdown(editor.getMarkdown?.() ?? '');
  }, [editor, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const current = dialogRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? dialogRef.current)?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const storedId = selectedIdProp !== undefined ? selectedIdProp : uncontrolledId;
  const selected =
    versions.find((version) => version.id === storedId) ??
    (selectedIdProp === undefined ? versions[0] ?? null : null);

  const others = versions.filter((version) => version.id !== selected?.id);
  const compareVersion = others.find((version) => version.id === compareId) ?? others[0] ?? null;

  // 选中/对比的正文：列表行自带 markdown 优先，否则用按需加载的缓存。
  const contentOf = (version: DocumentVersion | null): string | null => {
    if (!version) return null;
    if (version.markdown !== undefined) return version.markdown;
    const loaded = loadedContent[version.id];
    return loaded === undefined ? null : loaded;
  };

  const selectedContent = contentOf(selected);
  const compareContent = contentOf(compareVersion);
  const selectedLoading = Boolean(selected && selectedContent == null && loadingIds[selected.id]);
  const selectedLoadFailed = Boolean(
    selected && selectedContent == null && loadErrorIds[selected.id],
  );
  const showDiff = Boolean(selected && compareVersion && selectedContent != null && compareContent != null);

  // 需要时才取全文：面板打开 + 选中/对比变化。结果按 id 缓存。
  useEffect(() => {
    if (!isOpen || !onLoadVersionContent) return;

    const load = (version: DocumentVersion | null) => {
      if (!version || version.markdown !== undefined) return;
      const cached = loadedContentRef.current[version.id];
      if (cached !== undefined) {
        setLoadedContent((prev) =>
          prev[version.id] === cached ? prev : { ...prev, [version.id]: cached },
        );
        return;
      }
      if (pendingLoadRef.current.has(version.id)) return;
      pendingLoadRef.current.add(version.id);
      setLoadingIds((prev) => ({ ...prev, [version.id]: true }));
      setLoadErrorIds((prev) => ({ ...prev, [version.id]: false }));
      onLoadVersionContent(version.id)
        .then((markdown) => {
          loadedContentRef.current = {
            ...loadedContentRef.current,
            [version.id]: markdown,
          };
          setLoadedContent((prev) => ({ ...prev, [version.id]: markdown }));
        })
        .catch((error) => {
          console.error(`load version ${version.id} failed:`, error);
          setLoadErrorIds((prev) => ({ ...prev, [version.id]: true }));
        })
        .finally(() => {
          pendingLoadRef.current.delete(version.id);
          setLoadingIds((prev) => ({ ...prev, [version.id]: false }));
        });
    };

    load(selected);
    load(compareVersion);
  }, [isOpen, onLoadVersionContent, selected, compareVersion]);

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
    if (!next) onClose?.();
  };

  const choose = (id: string) => {
    onSelectedIdChange?.(id);
    if (selectedIdProp === undefined) setUncontrolledId(id);
    setCompareId((current) => (current === id ? null : current));
  };

  const same =
    isOpen && liveMarkdown != null && selectedContent != null
      ? isSameVersionMarkdown(liveMarkdown, selectedContent, { currentNormalized: true })
      : true;
  const blank = selectedContent != null ? selectedContent.trim() === '' : true;
  const canRestore = Boolean(
    selected && selectedContent != null && !selectedLoading && !same && !blank,
  );

  const restore = () => {
    if (!selected || selectedContent == null || !canRestore) return;
    const version = selected;
    const markdown = selectedContent;
    flushSync(() => setOpen(false));
    const result = restoreVersionMarkdown(editor, markdown, {
      leadBlockId: version.leadBlockId ?? null,
      // 整篇批次历史（一次保存一条）：整篇替换并保留块 ID。
      scope: version.scope ?? 'chapter',
    });
    if (result.mode === 'insert-at-cursor') {
      setNotice(t.restoredToCursor);
    }
    onRestore?.({ ...version, markdown });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), select, a[href], input, textarea',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  const fab = (
    <button
      type="button"
      className={[styles.fab, buttonHost && !trackedStyle ? styles.fabHosted : ''].filter(Boolean).join(' ')}
      style={trackedStyle ?? fabStyle(buttonOffset)}
      data-version-action="open"
      aria-label={t.open}
      aria-pressed={isOpen}
      onClick={() => setOpen(!isOpen)}
    >
      <HistoryIcon size={18} />
    </button>
  );

  const dialog = isOpen ? (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        className={[styles.dialog, className].filter(Boolean).join(' ')}
        ref={dialogRef}
        tabIndex={-1}
        data-version-history=""
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{t.title}</h2>
          <button
            type="button"
            className={`${styles.textBtn} ${styles.restore}`}
            data-version-action="restore"
            disabled={!canRestore}
            onClick={restore}
          >
            {t.restore}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            data-version-action="close"
            aria-label={t.close}
            onClick={() => setOpen(false)}
          >
            <XIcon />
          </button>
        </header>
        <div className={styles.body}>
          <aside className={styles.list}>
            {groupVersions(versions, locale, t).map((group) => (
              <section key={group.label}>
                <h3 className={styles.groupLabel}>{group.label}</h3>
                <ul className={styles.items}>
                  {group.versions.map((version) => (
                    <li key={version.id}>
                      <button
                        type="button"
                        className={styles.item}
                        data-version-id={version.id}
                        aria-current={version.id === selected?.id ? 'true' : undefined}
                        onClick={() => choose(version.id)}
                      >
                        <span className={styles.itemBody}>
                          <span className={styles.itemTitle}>{versionLabel(version, locale)}</span>
                          {version.detail ? <span className={styles.itemMeta}>{version.detail}</span> : null}
                        </span>
                        {version.badge ? <span className={styles.kind}>{version.badge}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </aside>
          <div className={styles.stage}>
            {/* 少于两条记录时没有「与谁对比」：整条状态栏不展示。 */}
            {compareVersion ? (
              <div className={styles.stageBar} data-version-stage="">
                <span className={styles.chip}>
                  {selected ? versionLabel(selected, locale) : ''}
                </span>
                <span className={styles.with}>{t.compareWith}</span>
                <Popover.Root open={targetOpen} onOpenChange={setTargetOpen}>
                  <Popover.Trigger asChild>
                    <button type="button" className={styles.compare} data-version-target="">
                      <span>{versionLabel(compareVersion, locale)}</span>
                      <ChevronDownIcon size={12} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className={styles.menu}
                      sideOffset={4}
                      align="start"
                      onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                      {others.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          className={[
                            styles.menuItem,
                            version.id === compareVersion.id ? styles.menuItemSelected : '',
                          ].filter(Boolean).join(' ')}
                          data-version-target-id={version.id}
                          aria-pressed={version.id === compareVersion.id}
                          onClick={() => {
                            setCompareId(version.id);
                            setTargetOpen(false);
                          }}
                        >
                          {versionLabel(version, locale)}
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                <span className={styles.compareWord}>{t.compare}</span>
                {showDiff ? (
                  <span className={styles.legend}>
                    <span className={styles.legendAdd}>{t.legendInsert}</span>
                    <span className={styles.legendRemove}>{t.legendDelete}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div
              className={styles.preview}
              data-version-preview=""
              style={{
                '--vh-diff-insert': `"${t.legendInsert}"`,
                '--vh-diff-delete': `"${t.legendDelete}"`,
              } as CSSProperties}
            >
              {versions.length === 0 ? (
                <div className={styles.emptyVersion}>
                  <p className={styles.emptyTitle}>{t.empty}</p>
                </div>
              ) : selectedLoading ? (
                <div className={styles.emptyVersion} data-version-loading="">
                  <p className={styles.emptyTitle}>{t.loadingVersion}</p>
                </div>
              ) : selectedLoadFailed ? (
                <div className={styles.emptyVersion}>
                  <p className={styles.emptyTitle}>{t.loadVersionFailed}</p>
                </div>
              ) : blank && !compareVersion ? (
                <div className={styles.emptyVersion}>
                  <FileIcon />
                  <p className={styles.emptyTitle}>{t.emptyVersion}</p>
                  <p className={styles.emptyHint}>{t.emptyVersionHint}</p>
                </div>
              ) : selectedContent != null && compareVersion ? (
                <VersionDiffView
                  selected={selectedContent}
                  other={compareContent}
                  selectedId={selected?.id}
                  sources={sources}
                  locale={locale}
                />
              ) : selectedContent != null ? (
                <MarkdownPreview markdown={selectedContent} sources={sources} locale={locale} />
              ) : (
                <div className={styles.emptyVersion}>
                  <FileIcon />
                  <p className={styles.emptyTitle}>{t.emptyVersion}</p>
                  <p className={styles.emptyHint}>{t.emptyVersionHint}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const noticeToast = notice ? (
    <div className={styles.notice} role="status" data-version-notice="">
      {notice}
    </div>
  ) : null;

  return (
    <>
      {createPortal(fab, buttonHost ?? document.body)}
      {dialog ? createPortal(dialog, document.body) : null}
      {noticeToast ? createPortal(noticeToast, document.body) : null}
    </>
  );
}

function versionLabel(version: DocumentVersion, locale: LocaleCode): string {
  const date = version.createdAt != null ? toDate(version.createdAt) : null;
  return date ? headline(date, locale) : version.title;
}

const SHORTCUT_GAP = 12;

function findShortcutFab(editor: Editor, host: HTMLElement | null): HTMLElement | null {
  const insideHost = host?.querySelector<HTMLElement>('[data-shortcut-fab]');
  if (insideHost) return insideHost;
  if (host) return null;
  const root = editor.view.dom.closest<HTMLElement>('[data-editor-host]');
  const insideEditor = root?.querySelector<HTMLElement>('[data-shortcut-fab]');
  if (insideEditor) return insideEditor;
  // 宿主把快捷键钮 portal 到编辑器外面（例如报告底栏槽位）时，子树里找不到。
  const all = [...document.querySelectorAll<HTMLElement>('[data-shortcut-fab]')];
  if (all.length === 0) return null;
  if (all.length === 1 || !root) return all[0];
  const origin = root.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best = all[0];
  let bestDistance = Infinity;
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    const distance = (rect.left + rect.width / 2 - ox) ** 2 + (rect.top + rect.height / 2 - oy) ** 2;
    if (distance < bestDistance) {
      best = el;
      bestDistance = distance;
    }
  }
  return best;
}

function styleAboveShortcut(shortcut: HTMLElement): CSSProperties | null {
  const fab = shortcut.getBoundingClientRect();
  if (fab.width === 0 && fab.height === 0) return null;
  return {
    right: `${Math.round(window.innerWidth - fab.right)}px`,
    bottom: `${Math.round(window.innerHeight - fab.top + SHORTCUT_GAP)}px`,
  };
}

function fabStyle(offset: HistoryButtonOffset | undefined): CSSProperties {
  const top = offset?.top;
  const left = offset?.left;
  const bottom = offset?.bottom ?? (top == null ? 24 : undefined);
  const right = offset?.right ?? (left == null ? 24 : undefined);
  return {
    top: cssPx(top),
    right: cssPx(right),
    bottom: cssPx(bottom),
    left: cssPx(left),
  };
}

function cssPx(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function toDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function headline(date: Date, locale: LocaleCode): string {
  const tag = locale === 'zh' ? 'zh-CN' : 'en-US';
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'long' }).format(date);
  const time = new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit' }).format(date);
  return locale === 'zh' ? `${weekday} ${time}` : `${weekday} at ${time}`;
}

interface VersionGroup {
  label: string;
  versions: DocumentVersion[];
}

function groupVersions(
  versions: DocumentVersion[],
  locale: LocaleCode,
  t: ReturnType<typeof getLocaleBundle>['history'],
): VersionGroup[] {
  const now = new Date();
  const groups: VersionGroup[] = [];
  for (const version of versions) {
    const label = groupLabel(version, now, locale, t);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.versions.push(version);
    else groups.push({ label, versions: [version] });
  }
  return groups;
}

function groupLabel(
  version: DocumentVersion,
  now: Date,
  locale: LocaleCode,
  t: ReturnType<typeof getLocaleBundle>['history'],
): string {
  const date = version.createdAt != null ? toDate(version.createdAt) : null;
  if (!date) return t.groupUndated;
  const thisWeek = startOfWeek(now);
  const thatWeek = startOfWeek(date);
  if (thatWeek === thisWeek) return t.groupThisWeek;
  if (thisWeek - thatWeek === WEEK_MS) return t.groupLastWeek;
  const month = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return t.groupMonth(month);
}

function startOfWeek(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy.getTime();
}

function FileIcon() {
  return (
    <svg
      className={styles.emptyIcon}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
