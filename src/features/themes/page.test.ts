// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncThemeToPage } from './page';
import { themeMode, themeOled } from './storage';

const MIRROR_KEY = 'canvas++:theme';
const theme = () => document.documentElement.dataset.cppTheme;

// stands in for the system's dark mode, which happy-dom can't switch
const system = Object.assign(new EventTarget(), { matches: false });
const setSystemDark = (dark: boolean) => {
  system.matches = dark;
  system.dispatchEvent(new Event('change'));
};
vi.stubGlobal('matchMedia', () => system);

beforeEach(() => {
  fakeBrowser.reset();
  localStorage.clear();
  delete document.documentElement.dataset.cppTheme;
  system.matches = false;
});

describe('syncThemeToPage', () => {
  it('applies the cached copy before extension storage answers', async () => {
    localStorage.setItem(MIRROR_KEY, 'dark');

    const synced = syncThemeToPage();
    expect(theme()).toBe('dark');

    // the real setting is off, so it wins once it arrives
    await synced;
    expect(theme()).toBeUndefined();
    expect(localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('applies the stored setting and caches it for the next load', async () => {
    await themeMode.setValue('on');

    await syncThemeToPage();

    expect(theme()).toBe('dark');
    expect(localStorage.getItem(MIRROR_KEY)).toBe('dark');
  });

  it('follows the setting live', async () => {
    await syncThemeToPage();

    await themeMode.setValue('on');
    await vi.waitFor(() => {
      expect(theme()).toBe('dark');
    });

    await themeMode.setValue('off');
    await vi.waitFor(() => {
      expect(theme()).toBeUndefined();
    });
  });

  it('applies OLED only while the dark theme is on', async () => {
    await themeOled.setValue(true);
    await syncThemeToPage();
    expect(theme()).toBeUndefined();

    await themeMode.setValue('on');
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

describe('matching the system', () => {
  it('is dark only while the system is, and follows it live', async () => {
    await themeMode.setValue('system');
    await syncThemeToPage();
    expect(theme()).toBeUndefined();

    setSystemDark(true);
    expect(theme()).toBe('dark');

    setSystemDark(false);
    expect(theme()).toBeUndefined();
  });

  it('caches the setting, not the theme it gave', async () => {
    await themeMode.setValue('system');
    await themeOled.setValue(true);

    await syncThemeToPage();

    expect(localStorage.getItem(MIRROR_KEY)).toBe('system-oled');
  });

  it('checks the system as it is now on the first paint', () => {
    localStorage.setItem(MIRROR_KEY, 'system-oled');

    void syncThemeToPage();
    expect(theme()).toBeUndefined();

    system.matches = true;
    void syncThemeToPage();
    expect(theme()).toBe('oled');
  });
});
