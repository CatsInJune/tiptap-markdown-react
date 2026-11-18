import { createFenceState, stepFence } from './markdownFences';

/**
 * 给流式半成品 markdown 补闭合围栏，避免未结束的 ``` 把后文吞进 code。
 * 完整稿不要调用（ISR / 已落库卡）。
 */
export function stabilizeMarkdown(markdown: string): string {
  if (!markdown) return markdown;

  const fence = createFenceState();
  for (const line of markdown.split('\n')) stepFence(fence, line);

  if (!fence.inFence || !fence.char) return markdown;
  const closer = fence.char.repeat(fence.length);
  return markdown.endsWith('\n') ? `${markdown}${closer}` : `${markdown}\n${closer}`;
}
