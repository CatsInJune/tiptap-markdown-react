'use client';

import { offset } from '@floating-ui/dom';
import type { Editor } from '@tiptap/core';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TURN_INTO_KINDS,
  blockMarkdown,
  canResetBlockFormatting,
  canTurnBlockInto,
  currentTurnIntoKind,
  deleteBlock,
  downloadImageBlock,
  duplicateBlock,
  isImageBlock,
  resetBlockFormatting,
  turnBlockInto,
  type TurnIntoKind,
} from '../blockDrag/actions';
import {
  blockDragListGuardKey,
  blockDragListGuardPlugin,
  setBlockHandleDragging,
} from '../blockDrag/listDrop';
import {
  CopyIcon,
  DownloadIcon,
  EraserIcon,
  GripIcon,
  TrashIcon,
} from '../icons';
import { useEditorBundle } from '../i18n/store';
import type { BlockDragLabels } from '../labels';
import styles from '../styles/blockDrag.module.css';

/**
 * 官方 DragHandle 的定位。负的 mainAxis 让手柄盒子伸进块左缘几像素：
 * 手柄在编辑器 DOM 外面，中间只要有空隙，鼠标移过去会先触发 mouseleave，
 * 手柄立刻消失。按钮本身仍靠 cluster 的右内边距留在正文左侧，不压住字。
 * 和 content.module.css 里 `.withBlockDrag` 的左内边距一起算，给评论气泡留空。
 */
const HANDLE_POSITION = {
  placement: 'left-start' as const,
  strategy: 'absolute' as const,
  middleware: [offset({ mainAxis: -6, crossAxis: 4 })],
};

/**
 * 表格的行手柄贴在表左缘。块手柄若也对齐表顶，会压在第一行的行手柄上。
 * 把定位锚点上移，六点落到表格上方的空隙里；clusterOnTable 的热区再接回表角。
 */
const TABLE_ANCHOR_LIFT = 24;

const THEME_VARS = [
  '--tmr-text',
  '--tmr-accent',
  '--tmr-toolbar-border',
  '--tmr-toolbar-muted',
  '--tmr-popover-bg',
  '--tmr-danger',
  '--tmr-code-bg',
];

interface BlockTarget {
  node: PMNode;
  pos: number;
}

interface OpenMenu {
  x: number;
  y: number;
  pos: number;
  node: PMNode;
}

export interface BlockDragHandleProps {
  editor: Editor;
}

function lockDragHandle(editor: Editor, locked: boolean) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta('lockDragHandle', locked)
      .setMeta('addToHistory', false),
  );
}

async function copyMarkdown(markdown: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdown);
    return;
  } catch {
    // 非安全上下文里 clipboard 会拒绝，退回选区复制。
  }
  const area = document.createElement('textarea');
  area.value = markdown;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

const TURN_ICON: Record<TurnIntoKind, string> = {
  paragraph: '¶',
  'heading-1': 'H1',
  'heading-2': 'H2',
  'heading-3': 'H3',
  bulletList: '•',
  orderedList: '1.',
  taskList: '✓',
  blockquote: '❝',
  codeBlock: '{ }',
};

/**
 * 块拖拽：悬停时在块左侧露出手柄（拖动重排），点手柄打开菜单
 * （转换 / 复制 / 再制一份 / 删除）。交互对齐 Tiptap Drag Context Menu，
 * 样式走本库的 `--tmr-*`。手柄跟着文档最外层的块走，列表和引用整块移动。
 * 松开时如果指针在列表上，块落到整份列表的前面或后面，不会变成其中一条。
 *
 * 不注册 NodeRange 扩展：它会接管 Shift+方向键和 Mod-a。拖拽要用的
 * NodeRangeSelection 在加载 drag-handle 时已经注册进 Selection。
 */
export function BlockDragHandle({ editor }: BlockDragHandleProps) {
  const t: BlockDragLabels = useEditorBundle(editor).blockDrag;
  const [target, setTarget] = useState<BlockTarget | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const draggedRef = useRef(false);
  const targetRef = useRef<BlockTarget | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
    lockDragHandle(editor, false);
  }, [editor]);

  // 拦住「单行块被包成列表项」。插件跟着手柄一起挂上，只读 / 窄屏没有拖拽。
  useEffect(() => {
    const plugin = blockDragListGuardPlugin();
    editor.registerPlugin(plugin);
    return () => {
      setBlockHandleDragging(editor.view, false);
      if (!editor.isDestroyed) editor.unregisterPlugin(blockDragListGuardKey);
    };
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu();
    };
    const onDown = (event: MouseEvent) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      if (el.closest('[data-block-drag-menu], [data-block-drag-grip]')) return;
      closeMenu();
    };
    const onScroll = () => closeMenu();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [menu, closeMenu]);

  useEffect(() => {
    if (!menu || !menuRef.current) return;
    const style = getComputedStyle(editor.view.dom);
    for (const name of THEME_VARS) {
      const value = style.getPropertyValue(name);
      if (value) menuRef.current.style.setProperty(name, value);
    }
  }, [menu, editor]);

  useEffect(() => () => lockDragHandle(editor, false), [editor, closeMenu]);

  const openMenu = (anchor: HTMLElement) => {
    if (!target) return;
    const rect = anchor.getBoundingClientRect();
    const estimated = 380;
    const y =
      rect.top + estimated > window.innerHeight
        ? Math.max(8, window.innerHeight - estimated - 8)
        : rect.top;
    const x = Math.min(rect.right + 6, window.innerWidth - 220);
    lockDragHandle(editor, true);
    setMenu({ x, y, pos: target.pos, node: target.node });
  };

  const run = (action: () => void) => {
    action();
    // 菜单按钮上的 preventDefault 会把焦点留在手柄上；命令本身不 focus
    // （无 window 的环境里 focus 会让整条 chain 失败）。
    editor.commands.focus();
    closeMenu();
  };

  const activeKind = menu
    ? currentTurnIntoKind(editor, menu.pos, menu.node)
    : null;
  const showTurn = menu ? canTurnBlockInto(menu.node) : false;
  const showReset = menu ? canResetBlockFormatting(menu.node) : false;
  const showDownload = menu ? isImageBlock(menu.node) : false;

  const turnLabel = (kind: TurnIntoKind): string => {
    if (kind === 'paragraph') return t.paragraph;
    if (kind === 'heading-1') return t.headingLabel(1);
    if (kind === 'heading-2') return t.headingLabel(2);
    if (kind === 'heading-3') return t.headingLabel(3);
    if (kind === 'bulletList') return t.bulletList;
    if (kind === 'orderedList') return t.orderedList;
    if (kind === 'taskList') return t.taskList;
    if (kind === 'blockquote') return t.blockquote;
    return t.codeBlock;
  };

  return (
    <>
      <DragHandle
        editor={editor}
        computePositionConfig={HANDLE_POSITION}
        onNodeChange={({ node, pos }) => {
          if (!node || pos < 0) {
            targetRef.current = null;
            setTarget(null);
            return;
          }
          const next = { node, pos };
          targetRef.current = next;
          setTarget(next);
        }}
        getReferencedVirtualElement={() => {
          const current = targetRef.current;
          if (!current || current.node.type.name !== 'table') return null;
          const pos = current.pos;
          return {
            getBoundingClientRect: () => {
              let dom: globalThis.Node | null = null;
              try {
                dom = editor.view.nodeDOM(pos);
              } catch {
                dom = null;
              }
              if (!(dom instanceof HTMLElement)) return new DOMRect();
              const rect = dom.getBoundingClientRect();
              return new DOMRect(
                rect.x,
                rect.y - TABLE_ANCHOR_LIFT,
                rect.width,
                rect.height,
              );
            },
          };
        }}
        onElementDragStart={() => {
          draggedRef.current = true;
          setBlockHandleDragging(editor.view, true);
        }}
        onElementDragEnd={() => {
          // drop 先于 dragend，松手时落点拦截还能读到这次是手柄拖拽。
          setBlockHandleDragging(editor.view, false);
          // click 紧跟 dragend。等这次点击过去再清掉，避免松手又把菜单打开。
          setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        }}
      >
        <div
          className={`${styles.cluster} ${
            target?.node.type.name === 'table' ? styles.clusterOnTable : ''
          }`}
          data-block-drag=""
        >
          <div
            role="button"
            tabIndex={0}
            className={`${styles.button} ${styles.grip}`}
            data-block-drag-grip=""
            title={t.dragHandle}
            aria-label={t.dragHandle}
            aria-haspopup="menu"
            aria-expanded={menu != null}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              if (menu) closeMenu();
              else openMenu(event.currentTarget);
            }}
            onClick={(event) => {
              if (draggedRef.current) return;
              if (menu) {
                closeMenu();
                return;
              }
              openMenu(event.currentTarget);
            }}
          >
            <GripIcon size={14} />
          </div>
        </div>
      </DragHandle>
      {menu
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.menu}
              data-block-drag-menu=""
              role="menu"
              aria-label={t.menuLabel}
              style={{ left: menu.x, top: menu.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {showTurn ? (
                <>
                  <div className={styles.groupLabel}>{t.turnInto}</div>
                  {TURN_INTO_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      className={
                        kind === activeKind
                          ? `${styles.item} ${styles.itemActive}`
                          : styles.item
                      }
                      data-block-drag-action={kind}
                      onClick={() =>
                        run(() => turnBlockInto(editor, menu.pos, kind))
                      }
                    >
                      <span className={styles.itemIcon} aria-hidden>
                        {TURN_ICON[kind]}
                      </span>
                      <span>{turnLabel(kind)}</span>
                    </button>
                  ))}
                  <div className={styles.divider} />
                </>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                data-block-drag-action="copy"
                onClick={() =>
                  run(() => {
                    const markdown = blockMarkdown(editor, menu.pos);
                    if (markdown != null) void copyMarkdown(markdown);
                  })
                }
              >
                <span className={styles.itemIcon} aria-hidden>
                  <CopyIcon />
                </span>
                <span>{t.copy}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                data-block-drag-action="duplicate"
                onClick={() => run(() => duplicateBlock(editor, menu.pos))}
              >
                <span className={styles.itemIcon} aria-hidden>
                  <CopyIcon />
                </span>
                <span>{t.duplicate}</span>
              </button>
              {showReset ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  data-block-drag-action="reset"
                  onClick={() =>
                    run(() => resetBlockFormatting(editor, menu.pos))
                  }
                >
                  <span className={styles.itemIcon} aria-hidden>
                    <EraserIcon />
                  </span>
                  <span>{t.resetFormatting}</span>
                </button>
              ) : null}
              {showDownload ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  data-block-drag-action="download"
                  onClick={() => run(() => downloadImageBlock(menu.node))}
                >
                  <span className={styles.itemIcon} aria-hidden>
                    <DownloadIcon />
                  </span>
                  <span>{t.downloadImage}</span>
                </button>
              ) : null}
              <div className={styles.divider} />
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemDanger}`}
                data-block-drag-action="delete"
                onClick={() => run(() => deleteBlock(editor, menu.pos))}
              >
                <span className={styles.itemIcon} aria-hidden>
                  <TrashIcon />
                </span>
                <span>{t.delete}</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
