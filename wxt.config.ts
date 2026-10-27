import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // WXT defaults Firefox to MV2; we rely on MV3 APIs (optional per-domain hosts, registerContentScripts)
  manifestVersion: 3,
  // ESLint 10 reads the same flat-config format as 9; WXT only knows to ask for "9"
  imports: { eslintrc: { enabled: 9 } },
  manifest: ({ browser }) => ({
    // package.json "name" must be npm-safe, so the display name lives here
    name: 'canvas++',
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // permanent once published on AMO
          id: 'canvas-plus-plus@aretelew',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
