import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({ plugins: [tailwindcss()] }),
  // Code imports React; Preact (via its compat layer) runs it at ~1/6 the size.
  // These feed both Vite and the generated tsconfig paths, so tsc checks against
  // what compat actually supports. Back to real React: remove these, drop
  // jsxImportSource from tsconfig.json, and install react + react-dom.
  alias: {
    react: 'node_modules/preact/compat',
    'react-dom': 'node_modules/preact/compat',
  },
  // Browser tests get a build of their own: every build deletes its folder
  // first, which crashes a browser that has .output/chrome-mv3 loaded unpacked
  ...(process.env.CPP_TEST_BUILD && {
    outDirTemplate: '{{browser}}-mv{{manifestVersion}}-test',
  }),
  // WXT defaults Firefox to MV2; we rely on MV3 APIs (optional per-domain hosts, registerContentScripts)
  manifestVersion: 3,
  // The Firefox sources zip ignores .gitignore, so it would ship tests/fixtures'
  // saved Canvas pages (personal data) to AMO reviewers; they only need to rebuild
  zip: {
    excludeSources: ['tests/**', 'test-results/**', 'playwright-report/**'],
  },
  // ESLint 10 reads the same flat-config format as 9; WXT only knows to ask for "9"
  imports: { eslintrc: { enabled: 9 } },
  manifest: ({ browser }) => ({
    // package.json "name" must be npm-safe, so the display name lives here
    name: 'canvas++',
    // scripting + activeTab: check whether the open tab is Canvas, and run the
    // theme on schools' own domains once the user grants one (optional hosts)
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // permanent once published on AMO
          id: 'canvas-plus-plus@aretelew',
          // AMO requires data_collection_permissions, which Firefox reads from
          // 140 (142 on Android); older versions would also need a
          // data-collection notice of our own
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
});
