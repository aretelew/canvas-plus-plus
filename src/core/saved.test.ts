// @vitest-environment happy-dom
import { browser } from '#imports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedForUser } from './saved';

const KEY = 'canvas++:test-saved';
const saved = savedForUser<string[]>(KEY, 1000);

// the fake browser has no manifest
const getManifest = vi.spyOn(browser.runtime, 'getManifest');
const runVersion = (version: string) =>
  getManifest.mockReturnValue({ manifest_version: 3, name: 'x', version });

beforeEach(() => {
  localStorage.clear();
  runVersion('1.0.0');
});

describe('savedForUser', () => {
  it("reads back what was saved for the user, and whether it's still fresh", () => {
    saved.write('A Student', ['a'], 0);
    expect(saved.read('A Student', 999)).toEqual({ value: ['a'], fresh: true });
    expect(saved.read('A Student', 1000)).toEqual({
      value: ['a'],
      fresh: false,
    });
  });

  it("is nothing for someone else's", () => {
    saved.write('A Student', ['a'], 0);
    expect(saved.read('B Student', 0)).toBeUndefined();
  });

  it('is nothing once the extension is updated, so it is asked for again', () => {
    saved.write('A Student', ['a'], 0);
    runVersion('1.1.0');
    expect(saved.read('A Student', 0)).toBeUndefined();
  });

  it('is nothing when an older version saved it without its version', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ who: 'A Student', at: 0, value: ['a'] }),
    );
    expect(saved.read('A Student', 0)).toBeUndefined();
  });
});
