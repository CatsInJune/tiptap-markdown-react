'use client';

import { ReactNodeViewRenderer } from '@tiptap/react';
import { CitationRef, type CitationRefOptions } from './CitationRef';
import type { RenderCitation } from './citationTypes';
import { CitationRefView } from './components/CitationRefView';

export type CitationRefViewOptions = CitationRefOptions & {
  renderCitation?: RenderCitation;
};

/**
 * 客户端增强版 CitationRef：挂 React NodeView，支持 `renderCitation` 插槽。
 * server / SSR 请继续用纯 {@link CitationRef}（无 React）。
 */
export function createCitationRef(
  options: { renderCitation?: RenderCitation } = {},
) {
  return CitationRef.extend<CitationRefViewOptions>({
    addOptions() {
      return {
        HTMLAttributes: {},
        ...this.parent?.(),
        renderCitation: options.renderCitation,
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(CitationRefView);
    },
  }).configure({
    renderCitation: options.renderCitation,
  });
}
