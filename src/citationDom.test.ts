/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import {
  findCitationRefElement,
  readCitationAttrs,
} from './citationDom';

describe('findCitationRefElement', () => {
  it('从子节点向上找到 .citation-ref', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p>营收<span class="citation-ref" data-index="3"><a href="#">3</a></span></p>';
    const a = root.querySelector('a')!;
    const found = findCitationRefElement(a, root);
    expect(found?.getAttribute('data-index')).toBe('3');
  });

  it('目标不在 root 内时返回 null', () => {
    const root = document.createElement('div');
    const outsider = document.createElement('span');
    outsider.className = 'citation-ref';
    outsider.setAttribute('data-index', '1');
    expect(findCitationRefElement(outsider, root)).toBeNull();
  });

  it('非圆标点击返回 null', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="body">plain</p>';
    expect(findCitationRefElement(root.querySelector('p'), root)).toBeNull();
  });
});

describe('readCitationAttrs', () => {
  it('读取 data-index / data-url / data-title', () => {
    const el = document.createElement('span');
    el.className = 'citation-ref';
    el.setAttribute('data-index', '7');
    el.setAttribute('data-url', 'https://example.com');
    el.setAttribute('data-title', 'FY2025');
    el.textContent = '7';
    expect(readCitationAttrs(el)).toEqual({
      index: '7',
      url: 'https://example.com',
      title: 'FY2025',
    });
  });
});
