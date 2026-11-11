import { describe, expect, it } from 'vitest';
import { isBuiltIn, isCanvasTab, isCustomDomain, sitePattern } from './domains';

describe('sitePattern', () => {
  it('matches the whole site', () => {
    expect(sitePattern('https://canvas.case.edu/courses/1?x=2')).toBe(
      'https://canvas.case.edu/*',
    );
  });
});

describe('isBuiltIn', () => {
  it.each([
    ['https://school.instructure.com/courses', true],
    ['https://instructure.com/', true],
    ['https://canvas.case.edu/', false],
    ['https://instructure.com.evil.example/', false],
    ['http://school.instructure.com/', false],
  ])('%s -> %s', (url, builtIn) => {
    expect(isBuiltIn(url)).toBe(builtIn);
  });
});

describe('isCustomDomain', () => {
  it.each([
    ['https://canvas.case.edu/*', true],
    ['https://*/*', false],
    ['https://*.case.edu/*', false],
    ['https://school.instructure.com/*', false],
    ['http://canvas.case.edu/*', false],
  ])('%s -> %s', (pattern, custom) => {
    expect(isCustomDomain(pattern)).toBe(custom);
  });
});

describe('isCanvasTab', () => {
  it("is a page on Canvas's own sites, but not DocViewer", () => {
    expect(isCanvasTab('https://school.instructure.com/courses/1')).toBe(true);
    expect(isCanvasTab('https://canvadocs.instructure.com/1/view')).toBe(false);
    expect(
      isCanvasTab('https://canvadocs-iad-prod.instructure.com/1/view'),
    ).toBe(false);
    expect(isCanvasTab('https://canvas.case.edu/')).toBe(false);
  });
});
