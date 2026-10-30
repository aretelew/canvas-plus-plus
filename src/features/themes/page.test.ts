// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncThemeToPage } from './page';
import { themeChoice } from './storage';

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

  it('applies the stored theme and caches it for the next load', async () => {
    await themeChoice.setValue('oled');

    await syncThemeToPage();

    expect(theme()).toBe('oled');
    expect(localStorage.getItem(MIRROR_KEY)).toBe('oled');
  });

  it('follows the setting live', async () => {
    await syncThemeToPage();

    await themeChoice.setValue('dark');
    await vi.waitFor(() => {
      expect(theme()).toBe('dark');
    });

    await themeChoice.setValue('oled');
    await vi.waitFor(() => {
      expect(theme()).toBe('oled');
    });

    await themeChoice.setValue('off');
    await vi.waitFor(() => {
      expect(theme()).toBeUndefined();
    });
  });
});

describe('matching the system', () => {
  it('is dark only while the system is, and follows it live', async () => {
    await themeChoice.setValue('system');
    await syncThemeToPage();
    expect(theme()).toBeUndefined();

    setSystemDark(true);
    expect(theme()).toBe('dark');

    setSystemDark(false);
    expect(theme()).toBeUndefined();
  });

  it('caches the choice, not the theme it gave', async () => {
    await themeChoice.setValue('system');

    await syncThemeToPage();

    expect(localStorage.getItem(MIRROR_KEY)).toBe('system');
  });

  it('checks the system as it is now on the first paint', () => {
    localStorage.setItem(MIRROR_KEY, 'system');

    void syncThemeToPage();
    expect(theme()).toBeUndefined();

    system.matches = true;
    void syncThemeToPage();
    expect(theme()).toBe('dark');
  });
});
