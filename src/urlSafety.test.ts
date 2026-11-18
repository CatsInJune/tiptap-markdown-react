import { describe, expect, it } from 'vitest';
import { isSafeLinkUrl, normalizeLinkUrl } from './urlSafety';

describe('urlSafety', () => {
  it.each([
    'https://example.com/a',
    'http://example.com/a',
    'ftp://example.com/a',
    'mailto:a@example.com',
    'tel:+8613800138000',
    '/docs/page',
    '#section',
    '?q=1',
    'example.com/x',
    '//cdn.example.com/a.png',
  ])('接受安全地址 %s', (url) => {
    expect(isSafeLinkUrl(url)).toBe(true);
    expect(normalizeLinkUrl(url)).toBe(url);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '',
    '   ',
    null,
    42,
    {},
  ])('拒绝危险或非法地址 %s', (url) => {
    expect(isSafeLinkUrl(url)).toBe(false);
    expect(normalizeLinkUrl(url)).toBeNull();
  });

  it('安全值去掉首尾空白后原样返回', () => {
    expect(normalizeLinkUrl('  https://example.com/a  ')).toBe(
      'https://example.com/a',
    );
  });
});
