import type { HTMLAttributes } from 'react';
import styles from './styles/content.module.css';

export interface ReportContentProps extends HTMLAttributes<HTMLDivElement> {
  /** `renderReportHtml(...).html` 产出的正文 HTML 字符串。 */
  html: string;
}

/**
 * 只读静态正文渲染（RSC / SSR 安全，无 client 代码、无编辑器实例）。
 *
 * 把 `renderReportHtml` 产出的 HTML 注入容器，并套上与编辑器 / 只读预览**同一个
 * 规范正文类**，保证「编辑所见 = 预览所见 = 发布后读者所见」。
 * 用于阅读页首屏直出（SEO 可见），无需 JS 即可显示。
 */
export function ReportContent({ html, className, ...rest }: ReportContentProps) {
  return (
    <div
      {...rest}
      className={
        className ? `${styles.editorContent} ${className}` : styles.editorContent
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
