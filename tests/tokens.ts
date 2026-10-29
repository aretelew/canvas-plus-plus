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
