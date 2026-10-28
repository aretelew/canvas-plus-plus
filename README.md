# canvas++

A cleaner, calmer Canvas LMS. A small browser extension for Chrome and Firefox: themes first (dark mode), more features later. See [PLAN.md](PLAN.md) for the roadmap and design.

## Develop

```bash
npm install
npm run dev           # Chromium, with hot reload
npm run dev:firefox   # Firefox
```

`npm run build` / `npm run zip` (add `:firefox` for Firefox) produce store builds in `.output/`.

The icon's sources are the SVGs in `design/`; after editing them, `npm run icons` re-renders `public/icon/` (it uses the same Chrome for Testing as the browser tests, below).

The extension runs on `*.instructure.com` out of the box. For a school's own domain (like `canvas.case.edu`), open it and click the canvas++ button: the popup offers to turn it on there.

`npm run check` runs everything that should pass before a commit: typecheck, ESLint, Prettier and Vitest. `npm run format` fixes formatting.

### Browser tests

`npm run test:browser` builds the extension and runs Playwright against it in Chrome for Testing (`$CHROME_PATH`, else the newest one [agent-browser](https://github.com/vercel-labs/agent-browser) installed):

- `tests/e2e/`: checks that run anywhere, like no light flash on load.
- `tests/visual/`: real Canvas pages replayed offline, one test per page: a screenshot with the theme off and on, and a check that the theme adds no contrast problems Canvas doesn't already have. They need fixtures recorded from your own account:

  ```bash
  npm run fixtures:record -- https://canvas.yourschool.edu
  ```

  A browser opens; sign in (every run: Canvas ends the session when the browser closes), and it saves about 25 student pages, discovered from your two most complete courses. Fixtures and screenshot baselines contain your personal data, so they stay in the gitignored `tests/fixtures/`. Update baselines after an intended visual change with `npx playwright test --update-snapshots`.

  The full run takes a few minutes. While iterating, run part of it (after `npm run build`): `npx playwright test -g dashboard` for pages whose name matches, or `npx playwright test --last-failed` to re-run what just failed.

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
