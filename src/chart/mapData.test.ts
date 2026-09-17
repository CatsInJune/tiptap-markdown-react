import { describe, expect, it } from 'vitest';
import { buildChartJsData, mapChartDataItems } from './mapData';

describe('mapChartDataItems', () => {
  it('maps x/y and colorLegend series', () => {
    const points = mapChartDataItems(
      {
        chartType: 'line',
        x: 'date',
        y: 'close',
        colorLegend: 'name',
      },
      [
        { date: 'd1', close: 10, name: 'A' },
        { date: 'd1', close: 20, name: 'B' },
        { date: 'd2', close: 12, name: 'A' },
      ],
    );
    expect(points).toHaveLength(3);
    expect(points[0].type).toBe('A');
  });
});

describe('buildChartJsData', () => {
  it('builds cartesian multi-series', () => {
    const built = buildChartJsData(
      { chartType: 'line', x: 'date', y: 'close', colorLegend: 'name' },
      {
        dataSource: [
          { date: 'd1', close: 10, name: 'A' },
          { date: 'd1', close: 20, name: 'B' },
          { date: 'd2', close: 12, name: 'A' },
        ],
      },
    );
    expect(built.isCartesian).toBe(true);
    expect(built.labels).toEqual(['d1', 'd2']);
    expect(built.datasets).toHaveLength(2);
  });

  it('builds pie labels', () => {
    const built = buildChartJsData(
      { chartType: 'pie', x: 'type', y: 'value' },
      {
        dataSource: [
          { type: 'A', value: 1 },
          { type: 'B', value: 2 },
        ],
      },
    );
    expect(built.isCartesian).toBe(false);
    expect(built.labels).toEqual(['A', 'B']);
    expect(built.datasets[0].data).toEqual([1, 2]);
  });
});
