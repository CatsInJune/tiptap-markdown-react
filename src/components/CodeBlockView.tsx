'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  TrashIcon,
} from '../icons';
import { defaultCodeBlockLabels, type CodeBlockLabels } from '../labels';
import styles from '../styles/codeBlock.module.css';

// 语言选择可选项。空 value = Auto-detect（交给 lowlight 自动识别）
const LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'Auto-detect' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
];

/**
 * 代码块自定义 NodeView：右上角语言选择器（Radix DropdownMenu，支持方向键导航）+ 删除。
 * 文案（Auto-detect / 删除标题）从扩展 options.codeBlockLabels 读取，缺省用英文默认。
 *
 * 只读态（预览 / 只读编辑器）走另一套头部：左侧语言标签，右侧复制 + 展开收起；
 * 超出 `--tmr-code-max-height`（缺省 480px）的代码块默认限高块内滚动，行号槽
 * 用 MutationObserver 跟踪 PM 管理的 code 内容保持同步（纯文本变化不触发 React
 * 重渲染，gutter 行数靠观察器自刷新）。
 */
export function CodeBlockView({
  node,
  updateAttributes,
  deleteNode,
  extension,
  editor,
}: NodeViewProps) {
  const labels: CodeBlockLabels = {
    ...defaultCodeBlockLabels,
    ...((extension?.options as { codeBlockLabels?: Partial<CodeBlockLabels> })
      ?.codeBlockLabels ?? {}),
  };
  const language = (node.attrs.language as string) || '';
  const current = LANGUAGES.find((l) => l.value === language);
  const currentLabel = current
    ? current.value === ''
      ? labels.autoDetect
      : current.label
      : labels.autoDetect;
  const editable = editor.isEditable;
  const readonly = !editable;

  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [lineCount, setLineCount] = useState(() =>
    Math.max((node.textContent ?? '').split('\n').length, 1),
  );
  const preRef = useRef<HTMLPreElement | null>(null);

  // 流式更新只改 code 里的文本节点，React 不重渲染；观察 pre 子树同步行数
  // 与「是否需要展开按钮」。展开/收起本身改变限高，也要重算 scrollable。
  useEffect(() => {
    if (!readonly) return;
    const pre = preRef.current;
    if (!pre) return;
    const update = () => {
      setLineCount(Math.max((pre.textContent ?? '').split('\n').length, 1));
      setScrollable(pre.scrollHeight > pre.clientHeight + 2);
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(pre, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', update);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [readonly, expanded]);

  const handleCopy = () => {
    const text = node.textContent ?? '';
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {});
      return;
    }
    // 剪贴板 API 不可用（非安全上下文 / 旧 webview）：退化为 execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      // 复制失败静默
    }
    ta.remove();
  };

  const wrapperClass = [
    styles.wrapper,
    readonly ? styles.readonly : '',
    expanded ? styles.expanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <NodeViewWrapper className={wrapperClass}>
      {editable ? (
        <div className={styles.header} contentEditable={false}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={styles.langTrigger}
                aria-label="Code language"
              >
                <span>{currentLabel}</span>
                <ChevronDownIcon size={14} className={styles.langChevron} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={styles.langMenu}
                sideOffset={4}
                align="end"
              >
                {LANGUAGES.map((l) => {
                  const optionLabel =
                    l.value === '' ? labels.autoDetect : l.label;
                  const selected = l.value === language;
                  return (
                    <DropdownMenu.Item
                      key={l.value}
                      className={`${styles.langItem}${selected ? ` ${styles.langItemSelected}` : ''}`}
                      onSelect={() => updateAttributes({ language: l.value })}
                    >
                      <span className={styles.langItemCheck}>
                        {selected ? <CheckIcon size={14} /> : null}
                      </span>
                      {optionLabel}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            type="button"
            className={styles.deleteBtn}
            title={labels.delete}
            aria-label={labels.delete}
            onClick={() => deleteNode()}
          >
            <TrashIcon />
          </button>
        </div>
      ) : (
        // 只读头部：左侧语言标签，右侧复制 + 展开收起（内容不超限高时隐藏展开钮）
        <div className={styles.readonlyHeader} contentEditable={false}>
          <span className={styles.langBadge}>
            <span className={styles.langBraces}>{'{}'}</span>
            {currentLabel}
          </span>
          <span className={styles.readonlyActions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleCopy}
              aria-label={labels.copy}
              title={labels.copy}
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
            {scrollable ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? labels.collapse : labels.expand}
                title={expanded ? labels.collapse : labels.expand}
                aria-expanded={expanded}
              >
                <ChevronsUpDownIcon size={14} />
              </button>
            ) : null}
          </span>
        </div>
      )}
      <pre ref={preRef} className={styles.pre}>
        {readonly ? (
          <span
            className={styles.gutter}
            contentEditable={false}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className={styles.gutterLine}>
                {i + 1}
              </span>
            ))}
          </span>
        ) : null}
        {/* code 标签是代码块标准内容容器；v3 类型未含 'code'，运行时有效，故断言 */}
        <NodeViewContent as={'code' as 'div'} />
      </pre>
    </NodeViewWrapper>
  );
}
