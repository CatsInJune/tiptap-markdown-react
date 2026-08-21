/**
 * 给流式半成品 markdown 补闭合围栏，避免未结束的 ``` 把后文吞进 code。
 * 完整稿不要调用（ISR / 已落库卡）。
 */
export function stabilizeMarkdown(markdown: string): string {
  if (!markdown) return markdown;

  let inFence = false;
  let fenceChar = '`';
  let fenceLen = 3;

  for (const line of markdown.split('\n')) {
    const match = line.match(/^(`{3,}|~{3,})/);
    if (!match) continue;
    const marker = match[1];
    const char = marker[0];
    if (!inFence) {
      inFence = true;
      fenceChar = char;
      fenceLen = marker.length;
      continue;
    }
    if (char === fenceChar && marker.length >= fenceLen && /^[`~]+\s*$/.test(line)) {
      inFence = false;
    }
  }

  if (!inFence) return markdown;
  const closer = fenceChar.repeat(fenceLen);
  return markdown.endsWith('\n') ? `${markdown}${closer}` : `${markdown}\n${closer}`;
}
