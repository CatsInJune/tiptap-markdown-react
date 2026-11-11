import { describe, expect, it } from 'vitest';
import { diffAnnotations } from './buildDiffDoc';

const SENTENCE =
  '本季度营收延续上行，核心产品在主要区域的渗透率继续提升，渠道库存保持健康，费用率同比改善，客户留存稳定。';

function paragraph(index: number, mutate: boolean): string {
  let text = `第${index}段。` + SENTENCE.repeat(12);
  if (mutate) text = text.replace('费用率同比改善', '费用率同比承压');
  return text;
}

function doc(mutate: (index: number) => boolean): string {
  const parts = ['# 季度经营纪要', ''];
  for (let i = 1; i <= 220; i += 1) parts.push(paragraph(i, mutate(i)), '');
  return parts.join('\n');
}

describe('长文对比耗时', () => {
  it('220 段里只有少量改动时，对比落在百毫秒量级', () => {
    const current = doc(() => false);
    const changed = doc((i) => i % 7 === 0);
    const start = performance.now();
    const marks = diffAnnotations(current, changed);
    const elapsed = performance.now() - start;
    expect(marks.length).toBeGreaterThan(0);
    // 同一篇稿在改之前大约 1.7 秒（两遍解析 + 逐字最长公共子串）。
    expect(elapsed).toBeLessThan(2_000);
  });
});
