// @vitest-environment happy-dom
import { storage } from '#imports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncPageFlag } from './page-flag';

const setting = storage.defineItem<boolean>('sync:hideThing', {
  fallback: false,
});
const MIRROR_KEY = 'canvas++:hide-thing';
const flagged = () =>
  document.documentElement.hasAttribute('data-cpp-hide-thing');

beforeEach(() => {
  fakeBrowser.reset();
  localStorage.clear();
  document.documentElement.removeAttribute('data-cpp-hide-thing');
});

describe('syncPageFlag', () => {
  it('applies the cached copy before extension storage answers', async () => {
    localStorage.setItem(MIRROR_KEY, '1');

    const synced = syncPageFlag(setting, 'hide-thing');
    expect(flagged()).toBe(true);

    // the real setting is off, so it wins once it arrives
    await synced;
    expect(flagged()).toBe(false);
    expect(localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('applies the stored setting and caches it for the next load', async () => {
    await setting.setValue(true);

    await syncPageFlag(setting, 'hide-thing');

    expect(flagged()).toBe(true);
    expect(localStorage.getItem(MIRROR_KEY)).toBe('1');
  });

  it('follows the setting live', async () => {
    await syncPageFlag(setting, 'hide-thing');

    await setting.setValue(true);
    await vi.waitFor(() => {
      expect(flagged()).toBe(true);
    });

    await setting.setValue(false);
    await vi.waitFor(() => {
      expect(flagged()).toBe(false);
    });
  });
});
