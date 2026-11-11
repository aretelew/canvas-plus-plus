// @vitest-environment happy-dom
import { browser } from '#imports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasJson } from '@/core/canvas-api';
import { clearPageTexts, loadPageTexts, pageKey, searchText } from './texts';

vi.mock('@/core/canvas-api', () => ({ canvasJson: vi.fn() }));

// the fake browser has no manifest, which what's saved is kept with
vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
  manifest_version: 3,
  name: 'x',
  version: '1.0.0',
});

const WHO = 'A Student';
const page = (id: string, updatedAt = '2026-09-01T00:00:00Z') => ({
  courseId: '1',
  id,
  updatedAt,
});

// Canvas's answer for each page, by its path
const answer = (pages: Record<string, unknown>) => {
  vi.mocked(canvasJson).mockReset();
  vi.mocked(canvasJson).mockImplementation((path) =>
    Promise.resolve(pages[path]),
  );
};
const asked = () => vi.mocked(canvasJson).mock.calls.map(([path]) => path);

beforeEach(() => {
  localStorage.clear();
});

describe('searchText', () => {
  it('keeps the words, cut short', () => {
    expect(searchText('<p>Office</p><p>hours</p>')).toBe('Office hours');
    expect(searchText(`<p>${'word '.repeat(2000)}</p>`)).toHaveLength(6000);
  });
});

describe('loadPageTexts', () => {
  it("asks for each page once, and leaves out one it can't read or that's locked", async () => {
    answer({
      '/api/v1/courses/1/pages/1': { body: '<p>Office hours</p>' },
      '/api/v1/courses/1/pages/3': {
        body: 'Opens Monday',
        locked_for_user: true,
      },
    });
    const texts = await loadPageTexts(WHO, [
      page('1'),
      page('1'),
      page('2'),
      page('3'),
    ]);
    expect(Object.fromEntries(texts)).toEqual({
      [pageKey('1', '1')]: 'Office hours',
    });
    expect(asked()).toEqual([
      '/api/v1/courses/1/pages/1',
      '/api/v1/courses/1/pages/2',
      '/api/v1/courses/1/pages/3',
    ]);
  });

  it('asks again only for a page that was edited since', async () => {
    answer({ '/api/v1/courses/1/pages/1': { body: 'First' } });
    await loadPageTexts(WHO, [page('1')]);

    answer({ '/api/v1/courses/1/pages/1': { body: 'Second' } });
    const same = await loadPageTexts(WHO, [page('1')]);
    expect(asked()).toEqual([]);
    expect(same.get(pageKey('1', '1'))).toBe('First');

    const edited = await loadPageTexts(WHO, [
      page('1', '2026-10-01T00:00:00Z'),
    ]);
    expect(asked()).toEqual(['/api/v1/courses/1/pages/1']);
    expect(edited.get(pageKey('1', '1'))).toBe('Second');
  });

  it("asks again for everything once it's cleared, or for someone else", async () => {
    answer({ '/api/v1/courses/1/pages/1': { body: 'First' } });
    await loadPageTexts(WHO, [page('1')]);

    answer({ '/api/v1/courses/1/pages/1': { body: 'First' } });
    await loadPageTexts('Someone Else', [page('1')]);
    expect(asked()).toHaveLength(1);

    clearPageTexts();
    answer({ '/api/v1/courses/1/pages/1': { body: 'First' } });
    await loadPageTexts('Someone Else', [page('1')]);
    expect(asked()).toHaveLength(1);
  });
});
