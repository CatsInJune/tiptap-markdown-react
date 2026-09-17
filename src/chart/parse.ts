import { normalizeChartConfigAxisFields } from './columnMatching';
import {
  isMvpChartType,
  type ChartColumn,
  type ChartConfig,
  type ChartPayload,
  type MvpChartType,
} from './types';

const CHART_COMMENT_RE = /^<!--\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*-->\s*$/;

/** GFM table: header + separator + optional body rows. */
const GFM_TABLE_BLOCK_RE =
  /^\|(.+)\|\s*\n\|([-:\s|]+)\|\s*\n((?:\|.*\|\s*\n?)*)/;

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const inner =
    trimmed.startsWith('|') && trimmed.endsWith('|')
      ? trimmed.slice(1, -1)
      : trimmed;
  return inner.split('|').map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function coerceCell(raw: string): string | number {
  const t = raw.trim();
  if (t === '') return t;
  const normalized = t.replace(/,/g, '');
  if (/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (!Number.isNaN(n)) return n;
  }
  return t;
}

/** Parse a GFM markdown table into columns + rows. */
export function parseGfmTable(markdown: string): {
  columns: ChartColumn[];
  dataSource: Record<string, unknown>[];
  rawLength: number;
} | null {
  const match = GFM_TABLE_BLOCK_RE.exec(markdown);
  if (!match) return null;
  const headerLine = `|${match[1]}|`;
  const sepLine = `|${match[2]}|`;
  if (!isSeparatorRow(sepLine)) return null;

  const headers = splitRow(headerLine);
  if (headers.length === 0 || headers.every((h) => !h)) return null;

  const columns: ChartColumn[] = headers.map((h) => ({
    title: h,
    dataIndex: h,
  }));

  const body = match[3] ?? '';
  const dataSource: Record<string, unknown>[] = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    if (!line.includes('|')) continue;
    const cells = splitRow(line);
    if (cells.length === 0) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = coerceCell(cells[i] ?? '');
    });
    dataSource.push(row);
  }

  return {
    columns,
    dataSource,
    rawLength: match[0].length,
  };
}

function looksLikeChartCommentJson(parsed: unknown): boolean {
  if (Array.isArray(parsed)) {
    return parsed.some(
      (c) =>
        c &&
        typeof c === 'object' &&
        'chartType' in (c as object) &&
        typeof (c as ChartConfig).chartType === 'string',
    );
  }
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.config)) return true;
    if (typeof o.chartType === 'string') return true;
  }
  return false;
}

/** Unwrap comment JSON into a flat config list (may include non-MVP types). */
export function unwrapChartConfigs(raw: unknown): ChartConfig[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.filter(
      (c): c is ChartConfig =>
        !!c && typeof c === 'object' && typeof (c as ChartConfig).chartType === 'string',
    );
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.config)) {
    return unwrapChartConfigs(o.config);
  }
  if (typeof o.chartType === 'string') {
    return [o as ChartConfig];
  }
  return null;
}

function inferPieAxes(
  cfg: ChartConfig,
  columns: ChartColumn[],
): ChartConfig {
  if (cfg.x && cfg.y) return cfg;
  if (columns.length < 2) return cfg;
  return {
    ...cfg,
    x: cfg.x ?? columns[0].dataIndex,
    y: cfg.y ?? columns[1].dataIndex,
  };
}

function axisExists(field: string | undefined, keys: string[]): boolean {
  if (!field) return false;
  return keys.includes(field);
}

/**
 * Keep only MVP chart configs that have resolvable axes.
 * Returns null when nothing left (caller should leave as plain table).
 */
export function normalizeChartPayload(
  configs: ChartConfig[],
  columns: ChartColumn[],
  dataSource: Record<string, unknown>[],
): ChartPayload | null {
  const keys = columns.map((c) => c.dataIndex);
  const normalized: ChartConfig[] = [];

  for (const raw of configs) {
    if (!isMvpChartType(raw.chartType)) continue;
    let cfg = normalizeChartConfigAxisFields({ ...raw }, keys);
    const type = cfg.chartType as MvpChartType;
    if (type === 'pie' || type === 'donut') {
      cfg = inferPieAxes(cfg, columns);
    }
    if (!axisExists(cfg.x, keys) || !axisExists(cfg.y, keys)) continue;
    // v1: ignore subgraphBy
    if (cfg.subgraphBy) {
      const { subgraphBy: _drop, ...rest } = cfg;
      cfg = rest;
    }
    normalized.push(cfg);
  }

  if (normalized.length === 0) return null;
  return { config: normalized, columns, dataSource };
}

/** Parse ```chart / ```json-chart / ```tmr-chart fence body JSON. */
export function parseChartFenceBody(body: string): ChartPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;

  // Full form
  if (Array.isArray(o.columns) || Array.isArray(o.dataSource)) {
    const configs = unwrapChartConfigs(o.config ?? o) ?? [];
    const columns = (o.columns as ChartColumn[]) ?? [];
    const dataSource =
      (o.dataSource as Record<string, unknown>[]) ??
      (o.data as Record<string, unknown>[]) ??
      [];
    if (!columns.length) {
      // Simple { chartType, x, y, data }
      if (Array.isArray(o.data) && typeof o.chartType === 'string') {
        const simpleCols: ChartColumn[] = [
          { title: String(o.x ?? 'x'), dataIndex: 'x' },
          { title: String(o.y ?? 'y'), dataIndex: 'y' },
        ];
        const rows = (o.data as unknown[]).map((item) => {
          if (item && typeof item === 'object') return item as Record<string, unknown>;
          return {};
        });
        return normalizeChartPayload(
          [{ chartType: String(o.chartType), x: 'x', y: 'y', title: o.title as string | undefined }],
          simpleCols,
          rows,
        );
      }
      return null;
    }
    const colObjs: ChartColumn[] = columns.map((c) =>
      typeof c === 'string'
        ? { title: c, dataIndex: c }
        : {
            title: String((c as ChartColumn).title ?? (c as ChartColumn).dataIndex),
            dataIndex: String((c as ChartColumn).dataIndex ?? (c as ChartColumn).title),
          },
    );
    return normalizeChartPayload(configs, colObjs, dataSource);
  }

  const configs = unwrapChartConfigs(parsed);
  if (!configs) return null;
  return null;
}

/**
 * Try to parse leading `<!-- chart json -->` + GFM table from `src`.
 * Returns payload + consumed char length, or null.
 */
export function tryParseCommentTableChart(
  src: string,
): { payload: ChartPayload; raw: string } | null {
  const trimmedStart = src.replace(/^\s*/, '');
  const offset = src.length - trimmedStart.length;
  if (!trimmedStart.startsWith('<!--')) return null;

  const endComment = trimmedStart.indexOf('-->');
  if (endComment < 0) return null;
  const commentBlock = trimmedStart.slice(0, endComment + 3);
  const cm = CHART_COMMENT_RE.exec(commentBlock.trim());
  if (!cm) return null;

  let json: unknown;
  try {
    json = JSON.parse(cm[1]);
  } catch {
    return null;
  }
  if (!looksLikeChartCommentJson(json)) return null;

  const configs = unwrapChartConfigs(json);
  if (!configs || configs.length === 0) return null;
  // All table-only → not a chart
  if (configs.every((c) => c.chartType === 'table')) return null;

  const afterComment = trimmedStart.slice(endComment + 3).replace(/^\s*\n/, '\n');
  const tableStart = afterComment.search(/\|/);
  if (tableStart < 0) return null;
  const beforeTable = afterComment.slice(0, tableStart);
  if (beforeTable.replace(/\s/g, '') !== '') return null;

  const tableMd = afterComment.slice(tableStart);
  const table = parseGfmTable(tableMd);
  if (!table) return null;

  const payload = normalizeChartPayload(
    configs,
    table.columns,
    table.dataSource,
  );
  if (!payload) return null;

  const raw =
    src.slice(0, offset) +
    commentBlock +
    afterComment.slice(0, tableStart) +
    tableMd.slice(0, table.rawLength);

  return { payload, raw };
}

/** Serialize payload to flat comment + GFM table (author form). */
export function serializeChartPayload(payload: ChartPayload): string {
  const flat =
    payload.config.length === 1 ? payload.config[0] : payload.config;
  const comment = `<!-- ${JSON.stringify(flat)} -->`;
  const headers = payload.columns.map((c) => c.title);
  const keys = payload.columns.map((c) => c.dataIndex);
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const rows = payload.dataSource.map((row) => {
    const cells = keys.map((k) => {
      const v = row[k];
      if (v == null) return '';
      return String(v);
    });
    return `| ${cells.join(' | ')} |`;
  });
  return [comment, '', header, sep, ...rows].join('\n');
}

/**
 * Replace valid comment+table chart pairs with ```tmr-chart fences
 * so TipTap markdown can tokenize a single fence.
 */
export function normalizeChartMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  let rest = markdown;
  let out = '';

  while (rest.length > 0) {
    const idx = rest.indexOf('<!--');
    if (idx < 0) {
      out += rest;
      break;
    }
    out += rest.slice(0, idx);
    const attempt = tryParseCommentTableChart(rest.slice(idx));
    if (!attempt) {
      // Skip this comment opener without consuming as chart
      out += '<!--';
      rest = rest.slice(idx + 4);
      continue;
    }
    const fenceBody = JSON.stringify({
      config: attempt.payload.config,
      columns: attempt.payload.columns,
      dataSource: attempt.payload.dataSource,
    });
    out += `\`\`\`tmr-chart\n${fenceBody}\n\`\`\``;
    rest = rest.slice(idx + attempt.raw.length);
    // Preserve a newline after fence if original had trailing content
    if (rest.startsWith('\n')) {
      /* keep */
    } else if (rest.length > 0) {
      out += '\n';
    }
  }

  return out;
}
