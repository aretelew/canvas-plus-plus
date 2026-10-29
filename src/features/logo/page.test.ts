// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncLogoToPage } from './page';
import { hideLogo } from './storage';

const MIRROR_KEY = 'canvas++:hide-logo';
const hidden = () => document.documentElement.dataset.cppHideLogo !== undefined;

beforeEach(() => {
  fakeBrowser.reset();
  localStorage.clear();
  delete document.documentElement.dataset.cppHideLogo;
});

describe('syncLogoToPage', () => {
  it('applies the cached copy before extension storage answers', async () => {
    localStorage.setItem(MIRROR_KEY, '1');

    const synced = syncLogoToPage();
    expect(hidden()).toBe(true);

    // the real setting is off, so it wins once it arrives
    await synced;
    expect(hidden()).toBe(false);
    expect(localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('applies the stored setting and caches it for the next load', async () => {
    await hideLogo.setValue(true);

    await syncLogoToPage();

    expect(hidden()).toBe(true);
    expect(localStorage.getItem(MIRROR_KEY)).toBe('1');
  });

  it('follows the setting live', async () => {
    await syncLogoToPage();

    await hideLogo.setValue(true);
    await vi.waitFor(() => {
      expect(hidden()).toBe(true);
    });

    await hideLogo.setValue(false);
    await vi.waitFor(() => {
      expect(hidden()).toBe(false);
    });
  });
});
