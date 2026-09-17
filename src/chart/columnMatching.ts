/**
 * Loose header ↔ config field matching (ported from agentic-ui columnMatching).
 * Zero runtime deps beyond string/regex.
 */

const TRAILING_UNIT_SUFFIX_PATTERN = /^(\s*[（(][^）)]+[）)])+\s*$/;

/** Exact match, or column = field + parenthetical unit suffix. */
export function columnKeyMatchesConfiguredField(
  columnKey: string,
  configuredField: string,
): boolean {
  const ck = (columnKey || '').trim();
  const f = (configuredField || '').trim();
  if (!ck || !f) return false;
  if (ck === f) return true;
  if (!ck.startsWith(f)) return false;
  const rest = ck.slice(f.length);
  return rest === '' || TRAILING_UNIT_SUFFIX_PATTERN.test(rest);
}

/**
 * Resolve configured x/y name to a real column dataIndex.
 * Returns original field when no match (caller decides degrade).
 */
export function resolveChartAxisFieldToColumnKey(
  configuredField: string | undefined,
  columnKeys: string[],
): string | undefined {
  if (configuredField === undefined || configuredField === null) {
    return configuredField;
  }
  const f = configuredField.trim();
  if (!f) return configuredField;
  const keySet = new Set(columnKeys);
  if (keySet.has(f)) return f;
  const hit = columnKeys.find((k) => columnKeyMatchesConfiguredField(k, f));
  return hit ?? configuredField;
}

export function normalizeChartConfigAxisFields<
  T extends { x?: string; y?: string; groupBy?: string; filterBy?: string; colorLegend?: string; sortBy?: string },
>(cfg: T, columnKeys: string[]): T {
  return {
    ...cfg,
    ...(cfg.x !== undefined
      ? { x: resolveChartAxisFieldToColumnKey(cfg.x, columnKeys) }
      : {}),
    ...(cfg.y !== undefined
      ? { y: resolveChartAxisFieldToColumnKey(cfg.y, columnKeys) }
      : {}),
    ...(cfg.groupBy !== undefined
      ? { groupBy: resolveChartAxisFieldToColumnKey(cfg.groupBy, columnKeys) }
      : {}),
    ...(cfg.filterBy !== undefined
      ? {
          filterBy: resolveChartAxisFieldToColumnKey(cfg.filterBy, columnKeys),
        }
      : {}),
    ...(cfg.colorLegend !== undefined
      ? {
          colorLegend: resolveChartAxisFieldToColumnKey(
            cfg.colorLegend,
            columnKeys,
          ),
        }
      : {}),
    ...(cfg.sortBy !== undefined
      ? { sortBy: resolveChartAxisFieldToColumnKey(cfg.sortBy, columnKeys) }
      : {}),
  };
}
