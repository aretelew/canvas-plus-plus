# canvas++

A cleaner, calmer Canvas LMS. A small browser extension for Chrome and Firefox: themes first (dark mode), more features later. See [PLAN.md](PLAN.md) for the roadmap and design.

## Develop

```bash
npm install
npm run dev           # Chromium, with hot reload
npm run dev:firefox   # Firefox
```

`npm run build` / `npm run zip` (add `:firefox` for Firefox) produce store builds in `.output/`.

### Pointing dev mode at your browser

`web-ext.config.ts` is per-developer and gitignored. To use a browser other than Chrome, or to stay signed in to Canvas between runs, create it in the repo root:

```ts
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    chrome: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  },
  chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
});
```

> The project folder must not contain `++` in its path: WXT 0.21 builds a regex from it and crashes.
