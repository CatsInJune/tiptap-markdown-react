import { useEffect, useMemo } from 'react';
import { defaultShortcutLabels, type ShortcutLabels } from '../labels';
import { XIcon } from '../icons';
import styles from '../styles/shortcutPanel.module.css';
import { buildShortcutGroups, type ShortcutGroup } from './types';

export interface ShortcutPanelProps {
  open: boolean;
  onClose: () => void;
  /** 文案覆盖，与默认英文合并。 */
  labels?: Partial<ShortcutLabels>;
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** 键帽文案：Mod/Alt 按平台落名，单字母统一大写。 */
function keycapText(key: string, mac: boolean): string {
  if (key === 'Mod') return mac ? 'Cmd' : 'Ctrl';
  if (key === 'Alt') return mac ? 'Opt' : 'Alt';
  if (/^[a-z]$/.test(key)) return key.toUpperCase();
  return key;
}

/**
 * 快捷键抽屉（语雀式）：右侧滑出的三列对照表——格式 / 快捷键 / Markdown。
 * 数据来自 buildShortcutGroups（键位与 input rule 均为库内真实行为）。
 * 定位 fixed 贴视口右缘；Esc 关闭。
 */
export function ShortcutPanel({ open, onClose, labels }: ShortcutPanelProps) {
  const t: ShortcutLabels = useMemo(
    () => ({ ...defaultShortcutLabels, ...labels }),
    [labels],
  );

  // 打开期间 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const groups: ShortcutGroup[] = useMemo(
    () => (open ? buildShortcutGroups(t) : []),
    [open, t],
  );
  const mac = useMemo(isMacPlatform, []);

  if (!open) return null;

  return (
    <aside
      className={styles.drawer}
      role="dialog"
      aria-modal="false"
      aria-label={t.panelTitle}
    >
      <button
        type="button"
        className={styles.closeBtn}
        title={t.close}
        aria-label={t.close}
        onClick={onClose}
      >
        <XIcon size={16} />
      </button>
      <div className={styles.head}>
        <span className={styles.colFormat}>{t.colFormat}</span>
        <span className={styles.colShortcut}>{t.colShortcut}</span>
        <span className={styles.colMarkdown}>{t.colMarkdown}</span>
      </div>
      <div className={styles.body}>
        {groups.map((group) => (
          <section key={group.id} className={styles.group}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            {group.entries.map((entry) => (
              <div key={entry.id} className={styles.row}>
                <span className={styles.rowLabel}>{entry.label}</span>
                <span className={styles.rowKeys}>
                  {entry.keys ? (
                    entry.keys.map((key, i) => (
                      <kbd key={i} className={styles.keycap}>
                        {keycapText(key, mac)}
                      </kbd>
                    ))
                  ) : (
                    <span className={styles.none}>—</span>
                  )}
                </span>
                <span className={styles.rowMd}>
                  {entry.markdown ? (
                    <>
                      <kbd className={styles.keycap}>{entry.markdown.marker}</kbd>
                      {entry.markdown.terminator ? (
                        <kbd className={styles.keycap}>{entry.markdown.terminator}</kbd>
                      ) : null}
                    </>
                  ) : (
                    <span className={styles.none}>—</span>
                  )}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
