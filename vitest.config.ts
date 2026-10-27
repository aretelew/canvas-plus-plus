import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  // *.test.ts run here; *.spec.ts are Playwright browser tests
  test: { include: ['**/*.test.ts'] },
});
