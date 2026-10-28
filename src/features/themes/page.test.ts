// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncThemeToPage } from './page';
import { themeEnabled, themeOled } from './storage';

const MIRROR_KEY = 'canvas++:theme';
const theme = () => document.documentElement.dataset.cppTheme;

beforeEach(() => {
  fakeBrowser.reset();
  localStorage.clear();
  delete document.documentElement.dataset.cppTheme;
});

describe('syncThemeToPage', () => {
  it('applies the cached copy before extension storage answers', async () => {
    localStorage.setItem(MIRROR_KEY, '1');

    const synced = syncThemeToPage();
    expect(theme()).toBe('dark');

    // the real setting is off, so it wins once it arrives
    await synced;
    expect(theme()).toBeUndefined();
    expect(localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('applies the stored setting and caches it for the next load', async () => {
    await themeEnabled.setValue(true);

    await syncThemeToPage();

    expect(theme()).toBe('dark');
    expect(localStorage.getItem(MIRROR_KEY)).toBe('dark');
  });

  it('follows the setting live', async () => {
    await syncThemeToPage();

    await themeEnabled.setValue(true);
    await vi.waitFor(() => {
      expect(theme()).toBe('dark');
    });

    await themeEnabled.setValue(false);
    await vi.waitFor(() => {
      expect(theme()).toBeUndefined();
    });
  });

  it('applies OLED only while the dark theme is on', async () => {
    await themeOled.setValue(true);
    await syncThemeToPage();
    expect(theme()).toBeUndefined();

    await themeEnabled.setValue(true);
    await vi.waitFor(() => {
      expect(theme()).toBe('oled');
    });
    expect(localStorage.getItem(MIRROR_KEY)).toBe('oled');

    await themeOled.setValue(false);
    await vi.waitFor(() => {
      expect(theme()).toBe('dark');
    });
  });

  it('reads a cached copy from before OLED as dark', () => {
    localStorage.setItem(MIRROR_KEY, '1');

    void syncThemeToPage();

    expect(theme()).toBe('dark');
  });
});
