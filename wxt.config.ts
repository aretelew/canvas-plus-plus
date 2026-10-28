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
          // optional_host_permissions, scripting's matchOriginAsFallback
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
