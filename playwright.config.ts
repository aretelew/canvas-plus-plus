import { defineConfig } from '@playwright/test';

// Browser tests against the built extension (`npm run test:browser` builds
// first). Visual baselines contain personal data, so they live with the
// gitignored fixtures.
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  snapshotPathTemplate: 'tests/fixtures/baselines/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      // color is the product: count any visible color change, not just big ones
      threshold: 0.01,
      maxDiffPixelRatio: 0.001,
    },
  },
});
