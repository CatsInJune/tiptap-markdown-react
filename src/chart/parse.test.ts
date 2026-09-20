import { describe, expect, it } from 'vitest';
import {
  columnKeyMatchesConfiguredField,
  resolveChartAxisFieldToColumnKey,
} from './columnMatching';
import {
  normalizeChartMarkdown,
  normalizeChartPayload,
  parseChartFenceBody,
  parseGfmTable,
  serializeChartPayload,
  tryParseCommentTableChart,
  unwrapChartConfigs,
} from './parse';

describe('columnMatching', () => {
  it('matches exact and unit-suffix headers', () => {
    expect(columnKeyMatchesConfiguredField('客单价(元)', '客单价')).toBe(true);
    expect(columnKeyMatchesConfiguredField('GDP总量（万亿元）', 'GDP总量')).toBe(
      true,
    );
    expect(columnKeyMatchesConfiguredField('销量', '收入')).toBe(false);
  });

  it('resolves configured field to real column key', () => {
    const keys = ['客单价(元)', '销量(件)'];
    expect(resolveChartAxisFieldToColumnKey('客单价', keys)).toBe('客单价(元)');
    expect(resolveChartAxisFieldToColumnKey('missing', keys)).toBe('missing');
  });
});

describe('parseGfmTable', () => {
  it('parses header separator and rows', () => {
    const md = `| date | close |
|------|------|
| 2024-01-01 | 100 |
| 2024-01-02 | 110 |
`;
    const table = parseGfmTable(md);
    expect(table).not.toBeNull();
    expect(table!.columns.map((c) => c.dataIndex)).toEqual(['date', 'close']);
    expect(table!.dataSource).toHaveLength(2);
    expect(table!.dataSource[0].close).toBe(100);
  });
});

describe('comment + table chart', () => {
  it('parses invret-style line chart', () => {
    const md = `<!-- {"chartType": "line", "x": "date","title":"历史价格走势", "y": "close", "colorLegend": "Acme(AAA)向前复权调整价格"} -->
| date | open | high | low | close | volume |
|------|------|------|------|-------|--------|
| 2024-01-01 | 1 | 2 | 0.5 | 1.5 | 1000 |
`;
    const result = tryParseCommentTableChart(md);
    expect(result).not.toBeNull();
    expect(result!.payload.config[0].chartType).toBe('line');
    expect(result!.payload.config[0].x).toBe('date');
    expect(result!.payload.dataSource[0].close).toBe(1.5);
  });

  it('infers pie axes when x/y omitted', () => {
    const md = `<!-- {"chartType": "pie"} -->
| type | value |
| ---- | ----- |
| A | 27 |
| B | 25 |
`;
    const result = tryParseCommentTableChart(md);
    expect(result).not.toBeNull();
    expect(result!.payload.config[0].x).toBe('type');
    expect(result!.payload.config[0].y).toBe('value');
  });

  it('degrades unsupported chartType to null', () => {
    const md = `<!-- {"chartType": "radar", "x": "a", "y": "b"} -->
| a | b |
| - | - |
| 1 | 2 |
`;
    expect(tryParseCommentTableChart(md)).toBeNull();
  });

  it('accepts config-wrapped comment and multi configs', () => {
    const configs = unwrapChartConfigs({
      config: [
        { chartType: 'bar', x: '业务', y: '销量' },
        { chartType: 'pie', x: '业务', y: '销量' },
      ],
    });
    expect(configs).toHaveLength(2);

    const md = `<!-- [{"chartType":"bar","x":"业务","y":"销量"},{"chartType":"pie","x":"业务","y":"销量"}] -->
| 业务 | 销量 |
| ---- | ---- |
| 收入 | 10 |
`;
    const result = tryParseCommentTableChart(md);
    expect(result!.payload.config).toHaveLength(2);
  });

  it('loose-matches axis names with units', () => {
    const md = `<!-- {"chartType": "column", "x": "年份", "y": "GDP总量"} -->
| 年份 | GDP总量（万亿元） |
| ---- | ---------------- |
| 2020 | 100 |
`;
    const result = tryParseCommentTableChart(md);
    expect(result).not.toBeNull();
    expect(result!.payload.config[0].y).toBe('GDP总量（万亿元）');
  });
});

describe('serialize + normalize', () => {
  it('round-trips to flat comment + table', () => {
    const payload = normalizeChartPayload(
      [{ chartType: 'bar', x: '业务', y: '销量', title: '样本' }],
      [
        { title: '业务', dataIndex: '业务' },
        { title: '销量', dataIndex: '销量' },
      ],
      [{ 业务: '收入', 销量: 10 }],
    )!;
    const md = serializeChartPayload(payload);
    expect(md).toContain('<!-- {"chartType":"bar"');
    expect(md).not.toContain('"config"');
    expect(md).toContain('| 业务 | 销量 |');

    const again = tryParseCommentTableChart(md);
    expect(again!.payload.config[0].title).toBe('样本');
  });

  it('normalizeChartMarkdown collapses to tmr-chart fence', () => {
    const md = `Hello

<!-- {"chartType": "pie"} -->
| type | value |
| ---- | ----- |
| A | 1 |

World`;
    const out = normalizeChartMarkdown(md);
    expect(out).toContain('```tmr-chart');
    expect(out).toContain('"chartType":"pie"');
    expect(out).toContain('Hello');
    expect(out).toContain('World');
    expect(out).not.toMatch(/<!--\s*\{"chartType":\s*"pie"/);
  });
});

describe('parseChartFenceBody', () => {
  it('parses full fence JSON', () => {
    const body = JSON.stringify({
      config: [{ chartType: 'line', x: 'date', y: 'close' }],
      columns: [
        { title: 'date', dataIndex: 'date' },
        { title: 'close', dataIndex: 'close' },
      ],
      dataSource: [{ date: 'd1', close: 1 }],
    });
    const payload = parseChartFenceBody(body);
    expect(payload?.config[0].chartType).toBe('line');
    expect(payload?.dataSource).toHaveLength(1);
  });
});

// 回归：注释与表格之间隔空行时，raw 曾按「折过空行」的字符串算长度，比它在原文里
// 实际占的跨度短，调用方按 raw.length 切 src 就会多吃掉后一个字符。表格是最后一块
// 且无尾随换行时，被吃掉的正是表格收尾的 `|`，正文里留下一个孤立管道行。
describe('raw 消费跨度', () => {
  const COMMENT = '<!-- {"chartType":"column","x":"项目","y":"金额"} -->';
  const TABLE = [
    '| 项目 | 金额 |',
    '| --- | --- |',
    '| 收入 | 100 |',
    '| 成本 | 60 |',
  ].join('\n');

  it('raw 是 src 的精确前缀，不漏出孤立的表格管道字符', () => {
    const cases = [
      [COMMENT, TABLE].join('\n'),
      [COMMENT, '', TABLE].join('\n'),
      [COMMENT, '', TABLE, ''].join('\n'),
      [COMMENT, '', TABLE, '', '结束语。'].join('\n'),
      [COMMENT, '', '', TABLE, '', '结束语。'].join('\n'),
    ];
    for (const md of cases) {
      const result = tryParseCommentTableChart(md);
      expect(result).not.toBeNull();
      expect(md.startsWith(result!.raw)).toBe(true);
      expect(md[result!.raw.length] === '|').toBe(false);
    }
  });

  it('表格是最后一块且无尾随换行时，围栏之后不留 |', () => {
    const md = ['## 概览', '', COMMENT, '', TABLE].join('\n');
    const out = normalizeChartMarkdown(md);
    expect(out).toContain('```tmr-chart');
    expect(out.trimEnd().endsWith('```')).toBe(true);
  });

  it('表格后接段落时，段落内容不被吃掉', () => {
    const md = [COMMENT, '', TABLE, '', '结束语。'].join('\n');
    const out = normalizeChartMarkdown(md);
    expect(out.trimEnd().endsWith('结束语。')).toBe(true);
  });
});
