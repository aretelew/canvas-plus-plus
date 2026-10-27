import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // package.json "name" must be npm-safe, so the display name lives here
    name: 'canvas++',
  },
});
