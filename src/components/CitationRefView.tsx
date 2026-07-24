'use client';

import {
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import type { RenderCitation } from '../citationTypes';

/**
 * 脚注圆标 React NodeView。
 * 无 `renderCitation` 时渲默认 pill（有 url 则可点）；有插槽时把 defaultDom 交给消费方。
 */
export function CitationRefView({ node, extension }: NodeViewProps) {
  const index = String(node.attrs.index ?? '');
  const url = (node.attrs.url as string | null) || null;
  const title = (node.attrs.title as string | null) || '';
  const renderCitation = extension.options.renderCitation as
    | RenderCitation
    | undefined;

  const pill = (
    <span
      className="citation-ref"
      data-index={index}
      {...(url ? { 'data-url': url } : {})}
      {...(title ? { 'data-title': title } : {})}
    >
      {!renderCitation && url ? (
        <a
          href={url}
          title={title}
          target="_blank"
          rel="noopener noreferrer"
        >
          {index}
        </a>
      ) : (
        index
      )}
    </span>
  );

  const content = renderCitation
    ? renderCitation({
        index,
        attrs: { index, url, title: title || null },
        defaultDom: pill,
      })
    : pill;

  return (
    <NodeViewWrapper
      as="span"
      data-citation-ref=""
      style={{ display: 'inline' }}
    >
      {content}
    </NodeViewWrapper>
  );
}
