'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import { CheckIcon, ChevronDownIcon, TrashIcon } from '../icons';
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
 */
export function CodeBlockView({
  node,
  updateAttributes,
  deleteNode,
  extension,
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

  return (
    <NodeViewWrapper className={styles.wrapper}>
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
      <pre className={styles.pre}>
        {/* code 标签是代码块标准内容容器；v3 类型未含 'code'，运行时有效，故断言 */}
        <NodeViewContent as={'code' as 'div'} />
      </pre>
    </NodeViewWrapper>
  );
}
