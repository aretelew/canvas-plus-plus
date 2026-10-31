import type { Page } from '@playwright/test';

// A theme token's color as the page computes it, to compare with an element's
// computed color.
export function tokenColor(page: Page, token: `--cpp-${string}`) {
  return page.evaluate((name) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${name})`;
    document.documentElement.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

// A color as sRGB: mixed ones compute to color(srgb ...), which only a canvas reads.
export const srgb = (page: Page, color: string) =>
  page.evaluate((css) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no canvas');
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, color);

export const contrast = (a: number[], b: number[]) => {
  const luminance = ([r = 0, g = 0, b = 0]: number[]) => {
    const lin = (c: number) =>
      (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
};
