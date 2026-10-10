import { Extension, type CommandProps } from '@tiptap/core';

/**
 * 段落样式（缩进 / 行高）：给段落与标题两类节点加 `indent`（缩进级数）与
 * `lineHeight` attrs，渲染成行内 `style` 片段。
 *
 * 文字对齐用官方 `@tiptap/extension-text-align`（免费），它同样往节点 style 上写
 * `text-align`——tiptap 的 mergeAttributes 对 style 是**拼接合并**（按属性去重），
 * 两边各写各的片段，不会互相覆盖（有测试盯住三者共存）。
 *
 * markdown 侧的往返在 paragraphMarkdown.ts（段落级 `<p style="…">` 形式）。
 */
export interface ParagraphStylesOptions {
  /** 参与的节点类型（与 TextAlign 的 types 对齐）。 */
  types: string[];
  /** 每级缩进的 em 数，默认 2（一个中文字宽）。 */
  indentStepEm: number;
  /** 最大缩进级数，默认 8。 */
  maxIndent: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphStyles: {
      /** 设置缩进级数；0 / null 清除。 */
      setIndent: (level: number | null) => ReturnType;
      /** 缩进 +1 级（到上限为止）。 */
      increaseIndent: () => ReturnType;
      /** 缩进 -1 级（到 0 即清除）。 */
      decreaseIndent: () => ReturnType;
      /** 设置行高（如 1.5）；null 清除（回默认）。 */
      setLineHeight: (value: number | null) => ReturnType;
    };
  }
}

/** `'2em'` → 1 级（按 indentStepEm 折算）；非法 / 非正值为 null。 */
export function parseIndentValue(
  value: string | null | undefined,
  stepEm: number,
): number | null {
  if (!value) return null;
  const match = /^([\d.]+)em$/.exec(value.trim());
  if (!match) return null;
  const em = Number.parseFloat(match[1]);
  if (!Number.isFinite(em) || em <= 0) return null;
  const level = Math.round(em / stepEm);
  return level > 0 ? level : null;
}

/** 只认纯数字（与本库序列化输出对称；`1.5` ✔，`150%` / `normal` ✘）。 */
export function parseLineHeightValue(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clampIndent(level: number, max: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0;
  return Math.min(Math.round(level), max);
}

export const ParagraphStyles = Extension.create<ParagraphStylesOptions>({
  name: 'paragraphStyles',

  addOptions() {
    return {
      types: [],
      indentStepEm: 2,
      maxIndent: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: null,
            parseHTML: (element) =>
              parseIndentValue(element.style.marginLeft, this.options.indentStepEm),
            renderHTML: (attributes) => {
              const level = clampIndent(
                Number(attributes.indent),
                this.options.maxIndent,
              );
              if (level === 0) return {};
              return {
                style: `margin-left: ${level * this.options.indentStepEm}em`,
              };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => parseLineHeightValue(element.style.lineHeight),
            renderHTML: (attributes) => {
              const value = Number(attributes.lineHeight);
              if (!Number.isFinite(value) || value <= 0) return {};
              return { style: `line-height: ${value}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    /**
     * 对配置的每个类型都尝试 updateAttributes，有一个成功即成功。
     * **不要用 `every`**：光标在标题里时，第一个「段落」类型找不到节点会返回 false，
     * 短路会让标题永远拿不到样式（官方 TextAlign 用的是 `.map(...).some(...)`）。
     */
    const runOnTypes =
      (attrs: Record<string, unknown>) =>
      (props: CommandProps): boolean =>
        this.options.types
          .map((type) => props.commands.updateAttributes(type, attrs))
          .some((response) => response);

    /** 读「当前段落 / 标题」的缩进级数（取第一个匹配类型的值）。 */
    const currentIndent = ({ editor }: CommandProps): number => {
      for (const type of this.options.types) {
        const value = editor.getAttributes(type).indent;
        if (value != null) return Number(value) || 0;
      }
      return 0;
    };

    return {
      setIndent:
        (level) =>
        (props) => {
          const next = clampIndent(Number(level), this.options.maxIndent);
          return runOnTypes({ indent: next || null })(props);
        },
      increaseIndent:
        () =>
        (props) =>
          runOnTypes({
            indent: clampIndent(currentIndent(props) + 1, this.options.maxIndent) || null,
          })(props),
      decreaseIndent:
        () =>
        (props) =>
          runOnTypes({
            indent: clampIndent(currentIndent(props) - 1, this.options.maxIndent) || null,
          })(props),
      setLineHeight:
        (value) =>
        (props) =>
          runOnTypes({
            lineHeight: value == null ? null : parseLineHeightValue(String(value)),
          })(props),
    };
  },
});
