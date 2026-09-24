'use client';

import {
  createSearchRegex,
  FindAndReplacePluginKey,
} from '@tiptap/extension-find-and-replace';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { FIND_DEBOUNCE_MS, runFindCommand } from '../findReplace';
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from '../icons';
import { defaultFindLabels, type FindLabels } from '../labels';
import styles from '../styles/findBar.module.css';

export interface FindReplaceBarProps {
  /** 编辑器实例（由 `<MarkdownWysiwygEditor>` 提供，浮动条不自行创建编辑器）。 */
  editor: Editor;
  /** 关闭（Esc / ×）：宿主负责收起浮动条并把焦点还给编辑器。 */
  onClose: () => void;
  labels?: Partial<FindLabels>;
  /**
   * 查找输入框 ref。宿主拿它实现「再按一次 Mod+F 聚焦并全选当前查询」。
   * 也用于浮动条打开时自动聚焦。
   */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** 定位 / 层级 class，由宿主给（浮动条自身只负责内部布局）。 */
  className?: string;
  /** 根节点内联样式（编辑器用它落 findBarOffset；宿主自绘时也可用）。 */
  style?: CSSProperties;
}

/**
 * 查找替换浮动条。匹配、高亮、替换全部由官方
 * `@tiptap/extension-find-and-replace` 承担（含 RE2 安全正则、跨标记匹配、单事务全部替换），
 * 这里只做输入、计数、开关与键位。
 *
 * 打开即把查询推给编辑器，关闭时 `clearSearch()`——高亮是会话级的，不留残影。
 */
export function FindReplaceBar({
  editor,
  onClose,
  labels,
  inputRef,
  className,
  style,
}: FindReplaceBarProps) {
  const t: FindLabels = { ...defaultFindLabels, ...labels };
  const [term, setTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  // 宿主自己摆条子时可能把 findReplace 关了——那时扩展没注册，命令与插件 state 都不存在。
  // 不拦住的话下面每个 effect 都会 TypeError 把宿主的树带崩；这里退化为不渲染并留一句提示。
  const hasExtension = typeof editor.commands.setSearchTerm === 'function';
  useEffect(() => {
    if (!hasExtension) {
      console.warn(
        '[tiptap-markdown-react] FindReplaceBar 需要官方 find 扩展：' +
          '请让 <MarkdownWysiwygEditor findReplace> 保持开启（默认 true），' +
          '否则 setSearchTerm / replaceAll 等命令不存在。',
      );
    }
  }, [hasExtension]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      const plugin = FindAndReplacePluginKey.getState(instance.state);
      return {
        currentIndex: plugin?.currentIndex ?? null,
        total: plugin?.results.length ?? 0,
        caseSensitive: plugin?.caseSensitive ?? false,
        wholeWord: plugin?.wholeWord ?? false,
        useRegex: plugin?.useRegex ?? false,
      };
    },
  });

  /** 所有命令都从这里走：扩展缺席时直接跳过（见上面 hasExtension）。 */
  const runCommand = useCallback(
    (run: () => void) => {
      if (!hasExtension) return;
      runFindCommand(run);
    },
    [hasExtension],
  );

  // 查询词防抖由这里做（扩展注册时 searchDebounceMs: 0，原因见 findReplace.ts）：
  // 输入时延迟推给编辑器，回车 / 替换等动作前先 flush，否则会拿着旧查询执行。
  const appliedTermRef = useRef<string | null>(null);
  const pushTerm = useCallback(
    (value: string) => {
      appliedTermRef.current = value;
      runCommand(() => editor.commands.setSearchTerm(value));
    },
    [editor, runCommand],
  );
  const flushTerm = useCallback(() => {
    if (appliedTermRef.current !== term) pushTerm(term);
  }, [pushTerm, term]);

  useEffect(() => {
    if (appliedTermRef.current === term) return;
    const timer = setTimeout(() => pushTerm(term), FIND_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, pushTerm]);

  useEffect(() => {
    runCommand(() => editor.commands.setReplaceTerm(replaceTerm));
  }, [editor, replaceTerm, runCommand]);

  // 关闭 / 卸载时清空查询与高亮。
  useEffect(() => {
    return () => {
      if (!editor.isDestroyed) runCommand(() => editor.commands.clearSearch());
    };
  }, [editor, runCommand]);

  /** 动作类命令（导航 / 替换）：先落定查询词，再执行。 */
  const runAction = useCallback(
    (action: () => void) => {
      flushTerm();
      runCommand(action);
    },
    [flushTerm, runCommand],
  );

  // RE2 模式非法（lookaround / backreference 等）：官方返回零结果不报错，这里给个提示，
  // 否则「输入了正则却一直 0 / 0」没有解释。
  const invalidPattern = useMemo(
    () =>
      term !== '' &&
      state.useRegex &&
      createSearchRegex(term, {
        caseSensitive: state.caseSensitive,
        useRegex: true,
        wholeWord: false,
      }) === null,
    [term, state.useRegex, state.caseSensitive],
  );

  const counter = t.counter(
    state.total === 0 ? 0 : (state.currentIndex ?? 0) + 1,
    state.total,
  );

  const keepFocus = (e: ReactMouseEvent) => e.preventDefault();

  const onFindKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runAction(() => {
        if (e.shiftKey) editor.commands.goToPreviousResult();
        else editor.commands.goToNextResult();
      });
    }
  };

  const onReplaceKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runAction(() => editor.commands.replace());
    }
  };

  const toggle = (
    key: 'caseSensitive' | 'wholeWord' | 'useRegex',
    value: boolean,
  ) => {
    runCommand(() => {
      if (key === 'caseSensitive') editor.commands.setCaseSensitive(value);
      else if (key === 'wholeWord') editor.commands.setWholeWord(value);
      else editor.commands.setUseRegex(value);
    });
  };

  if (!hasExtension) return null;

  const toggleClass = (on: boolean) =>
    `${styles.btn} ${styles.toggle}${on ? ` ${styles.toggleOn}` : ''}`;

  return (
    <div
      className={className ? `${styles.bar} ${className}` : styles.bar}
      style={style}
      role="dialog"
      aria-label={t.find}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.row}>
        <span className={styles.field}>
          <SearchIcon size={14} className={styles.fieldIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onFindKeyDown}
            placeholder={t.find}
            aria-label={t.find}
            autoFocus
            spellCheck={false}
          />
        </span>
          <button
            type="button"
            className={toggleClass(state.caseSensitive)}
            title={t.caseSensitive}
            aria-label={t.caseSensitive}
            aria-pressed={state.caseSensitive}
            onMouseDown={keepFocus}
            onClick={() => toggle('caseSensitive', !state.caseSensitive)}
          >
            Aa
          </button>
          <button
            type="button"
            className={toggleClass(state.wholeWord)}
            title={t.wholeWord}
            aria-label={t.wholeWord}
            aria-pressed={state.wholeWord}
            onMouseDown={keepFocus}
            onClick={() => toggle('wholeWord', !state.wholeWord)}
          >
            ab
          </button>
          <button
            type="button"
            className={toggleClass(state.useRegex)}
            title={t.useRegex}
            aria-label={t.useRegex}
            aria-pressed={state.useRegex}
            onMouseDown={keepFocus}
            onClick={() => toggle('useRegex', !state.useRegex)}
          >
            .*
          </button>

        <span className={styles.spacer} />
        <span
          className={`${styles.counter}${invalidPattern ? ` ${styles.counterInvalid}` : ''}`}
          aria-live="polite"
          title={invalidPattern ? t.invalidRegex : undefined}
        >
          {invalidPattern ? t.invalidRegex : counter}
        </span>
        <button
          type="button"
          className={styles.btn}
          title={t.previous}
          aria-label={t.previous}
          disabled={state.total === 0}
          onMouseDown={keepFocus}
          onClick={() => runAction(() => editor.commands.goToPreviousResult())}
        >
          <ChevronUpIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.btn}
          title={t.next}
          aria-label={t.next}
          disabled={state.total === 0}
          onMouseDown={keepFocus}
          onClick={() => runAction(() => editor.commands.goToNextResult())}
        >
          <ChevronDownIcon size={16} />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.closeBtn}`}
          title={t.close}
          aria-label={t.close}
          onClick={onClose}
        >
          <XIcon size={16} />
        </button>
      </div>

      {editor.isEditable ? (
        <div className={styles.row}>
          <span className={styles.field}>
            <input
              className={styles.input}
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={onReplaceKeyDown}
              placeholder={t.replace}
              aria-label={t.replace}
              spellCheck={false}
            />
          </span>
          <span className={styles.spacer} />
          <button
            type="button"
            className={`${styles.btn} ${styles.textBtn}`}
            disabled={state.total === 0}
            onMouseDown={keepFocus}
            onClick={() => runAction(() => editor.commands.replace())}
          >
            {t.replaceOne}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.textBtn}`}
            disabled={state.total === 0}
            onMouseDown={keepFocus}
            onClick={() => runAction(() => editor.commands.replaceAll())}
          >
            {t.replaceAll}
          </button>
        </div>
      ) : (
        <div className={styles.row}>
          <span className={styles.readOnly}>{t.readOnly}</span>
        </div>
      )}
    </div>
  );
}
