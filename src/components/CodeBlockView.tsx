'use client';

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import { TrashIcon } from '../icons';
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
 * 代码块自定义 NodeView：右上角原生语言选择器 + 删除，可编辑代码内容。
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

  return (
    <NodeViewWrapper className={styles.wrapper}>
      <div className={styles.header} contentEditable={false}>
        <select
          className={styles.langSelect}
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          // 阻止选择器交互冒泡到编辑器，避免选区/焦点错乱
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Code language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.value === '' ? labels.autoDetect : l.label}
            </option>
          ))}
        </select>
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
