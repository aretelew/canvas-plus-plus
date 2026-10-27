# canvas++ — plan

A browser extension that improves Canvas LMS. Feature #1 is a **theme engine**: dark is the first theme, with more themes and custom themes later. It's built so other features can plug in after.

## Decisions so far

| Topic | Decision |
|---|---|
| Target | Canvas LMS: `*.instructure.com` plus schools' custom domains |
| Audience | Public: Chrome Web Store + Firefox Add-ons (AMO) |
| Browsers | Chrome (and therefore Edge/Brave/Arc) and Firefox from day one |
| Stack | WXT + TypeScript; React for popup/options; content scripts framework-free |
| Backend | None. All state lives in `storage`; we collect nothing |
| Default | Themes **off** by default; the user turns them on |
| Trigger | Manual toggle (popup, later a keyboard shortcut) |
| Engine | Our own token-based CSS + a JS contrast pass for course content |
| Course content | Readability wins over author colors |
| Third-party LTI iframes | Left alone (stay light) |
| Test coverage v1 | Student-facing pages first; teacher pages later |

| Positioning | **Cleaner, more minimal and lighter than Better Canvas.** It has about 2M users but looks cluttered and is heavy |

### What "minimal and light" commits us to
- **Size limits** (checked in CI): content script under 15 KB gzipped, theme CSS under 20 KB gzipped, popup under 60 KB gzipped (React included; switch to Preact if it doesn't fit).
- **Runtime:** no work on pages where the extension is off beyond one attribute check. No polling or timers. The MutationObserver only watches content containers.
- **UI:** the popup is one toggle plus a theme picker. Everything else goes in the options page. Every new setting has to justify itself.
- **Themes:** a few carefully designed themes beat many average ones. Leaving Canvas's layout mostly alone and only recoloring it is part of the minimal look.
- Robustness still matters: stable selectors and visual tests, because a minimal extension that breaks every Canvas update isn't clean.

### Open questions
1. Name and branding: "canvas++" is fine for a repo, but check the store listing for trademark issues. Instructure owns "Canvas"; "for Canvas" phrasing is the usual safe pattern.

## Background from research

- **Canvas has no web dark mode.** Only the mobile apps do. On the web there is a per-user High Contrast UI toggle, which is still light.
- **InstUI** (Canvas's React component library) themes through JS/emotion, not CSS variables. Class names look like `css-<hash>-view--block`. The **hash changes between versions; the suffix is stable**, so we target `[class*="-view--block"]` and never the hash.
- Canvas does expose **theme-editor variables** (`--ic-brand-primary`, `--ic-link-color`, `--ic-brand-global-nav-*` …). They only cover brand colors, not surfaces or text, so backgrounds still need selector rules.
- Pages are mostly full page loads with React parts rendered after load (dashboard, planner, discussions, inbox). Inject at `document_start`, then use a MutationObserver for nodes added later.
- **Iframes we can theme:** the Rich Content Editor (TinyMCE, a same-origin `#…_ifr` iframe) and New Quizzes (`*.quiz-lti-*-prod.instructure.com`; always on instructure.com, even for schools on custom domains).
- **Iframes we leave alone:** DocViewer (`canvadocs.instructure.com`), where annotation colors carry meaning; user-uploaded HTML (`*.canvas-user-content.com`); third-party LTI tools.
- Dark Reader's fix list for Canvas is a free map of known problem areas: `.equation_image`, dashboard card badges, InstUI textareas, file download buttons, global nav vars.
- A known failure mode: a dark-mode extension hid quiz questions and answer choices. **Quizzes need dedicated tests.**

## Architecture

```
canvas++/
├─ wxt.config.ts            # manifest generated here (chrome + firefox targets)
├─ src/
│  ├─ entrypoints/
│  │  ├─ background.ts      # service worker: permissions, dynamic script registration
│  │  ├─ canvas.content.ts  # main content script (document_start, all_frames)
│  │  ├─ popup/             # React: on/off toggle, theme picker, "enable on this site"
│  │  └─ options/           # React: full settings, later the custom theme editor
│  ├─ core/
│  │  ├─ settings.ts        # typed settings schema + storage wrapper + change events
│  │  ├─ features.ts        # feature registry (see below)
│  │  ├─ canvas-detect.ts   # "is this page Canvas?" (window.ENV, #application.ic-app, …)
│  │  └─ domains.ts         # list of enabled custom domains, permission helpers
│  └─ features/
│     └─ themes/
│        ├─ feature.ts      # registers with core/features
│        ├─ tokens.ts       # the token list (single source of truth)
│        ├─ themes/         # dark.ts, oled.ts, … : just token → color maps
│        ├─ styles/         # rules written ONLY in terms of var(--cpp-*)
│        │  ├─ base.css     # page, text, links, borders, inputs
│        │  ├─ instui.css   # [class*="-view--block"] etc.
│        │  ├─ nav.css      # global nav + course nav, --ic-brand-* remap
│        │  ├─ pages/       # dashboard.css, modules.css, grades.css, quizzes.css …
│        │  └─ rce.css      # injected into the TinyMCE iframe
│        └─ contrast.ts     # inline-color fixer for .user_content
└─ tests/
   ├─ fixtures/             # saved Canvas pages (GITIGNORED, has personal data)
   └─ visual/               # Playwright screenshot tests
```

### Feature registry (for later features)
Each feature exports `{ id, name, defaultEnabled, settings schema, apply(ctx), teardown() }`. The content script loads settings once, then runs `apply` for each enabled feature, giving it a context with the document, settings, and an `onSettingsChange` hook. Themes is the first feature. A GPA calculator or a todo tweak would be the next ones, with no changes to the core.

### Theme engine
- **Tokens:** about 20–25 semantic variables, all prefixed `--cpp-`:
  - Surfaces: `bg`, `surface`, `surface-raised`, `surface-sunken`, `hover`
  - Borders: `border`, `border-strong`
  - Text: `text`, `text-muted`, `text-inverse`
  - Links: `link`, `link-visited`
  - Accent: `accent`, `on-accent`
  - Status: `success`, `warning`, `danger`, `info`
  - Inputs and focus: `input-bg`, `focus-ring`
  - Nav: `nav-bg`, `nav-text`
  - Effects: `shadow`, `scrim`
- **Themes are data:** a theme is just `{ id, name, tokens: {...} }`. Custom themes later are the same shape, created in the options page. Settings sync can hold several of them.
- **Scoping:** every rule sits under `html[data-cpp-theme]`, so when the attribute is absent, the CSS does nothing. Turning a theme off means removing one attribute. Switching themes means rewriting one `<style>` that holds only the token values.
- **Canvas brand vars:** remap `--ic-brand-*` to our tokens. A later option could keep the school's accent color.
- **No light flash:** the stylesheet is declared in the manifest `css`, which Chrome injects before the DOM exists. It does nothing until the attribute is set. `storage.get` is async and can lose the race with first paint, so the content script also keeps a copy of the current theme id and token values in the page's `localStorage`. It reads that copy synchronously at `document_start`, sets the attribute immediately, and then checks it against `storage`.

### Contrast pass (course content)
- Scope: `.user_content`, discussion and announcement bodies, page bodies, the RCE iframe. Leave alone `img`, `svg`, `video`, `canvas`, `.equation_image`, MathML, and course card colors.
- For elements with inline `color`/`background-color` (or `<font color>`): compute the effective background and check WCAG contrast. If it's under 4.5:1, adjust **lightness only** (OKLCH), keeping the hue, so the instructor's "red means important" still reads as red.
- Save the original value in a `data-cpp-orig-*` attribute so turning the theme off restores it exactly.
- Run it once at load, then on MutationObserver batches, debounced, and only on added subtrees. Never use `querySelectorAll('*')` on the whole page.

### Domains and permissions
- **Manifest:** `host_permissions: ["https://*.instructure.com/*"]`, `optional_host_permissions: ["https://*/*"]`, `permissions: ["storage", "scripting", "activeTab"]`.
- **Custom domain flow:** the user clicks the icon on their school's Canvas. `activeTab` lets us run `canvas-detect` on that page. If it's Canvas, the popup shows **"Turn on themes for canvas.school.edu"**. That calls `permissions.request({ origins: [that origin] })`, which must run inside a click handler, then `scripting.registerContentScripts` for that origin.
- **Upkeep:** re-sync the registrations in `runtime.onInstalled` and `permissions.onRemoved`. It isn't confirmed that registrations survive extension updates, so don't rely on it.
- This avoids the "read and change all your data on all websites" warning at install and the slower Web Store review that broad host permissions trigger.

### Settings
`storage.sync` limits: 100 KB total, 8 KB per item, 120 writes per minute. Store small settings there: enabled, theme id, per-feature settings, custom themes (one key each). Store the domain list and caches in `storage.local`. The content script listens to `storage.onChanged`, so toggling never needs a reload.

### Firefox notes (verify while building)
- WXT handles `browser.*` vs `chrome.*` and builds both manifests.
- Firefox MV3 treats host permissions as user-grantable. Check that `*.instructure.com` is actually granted on install and that the popup handles it when it isn't.
- Check `match_origin_as_fallback` and `registerContentScripts` support in current Firefox versions.

## Testing

- **Fixtures:** with your student account, save full pages (SingleFile or Playwright `page.content()` plus assets) for the pages we support. **These contain your name, grades and classmates' names, so they stay gitignored.** If we ever commit fixtures, scrub them first.
- **Playwright with the extension loaded** (persistent context + `--load-extension`):
  1. **Visual tests:** screenshot each fixture with each theme and compare against approved baselines. This is how we "don't break".
  2. **Contrast audit:** run axe-core color-contrast checks on each themed fixture.
  3. **Live smoke test:** run against the real Canvas with a saved logged-in profile. Run it manually, not in CI.
- **Unit tests (Vitest):** contrast math, settings schema migrations, `canvas-detect`.
- **Quizzes get their own checklist:** classic quiz and New Quizzes. Every question type renders, answer choices are visible, and selected/correct states are distinguishable.
- **Teacher pages:** later. Free-for-Teacher signups appear limited in 2026, so check canvaslms.com/try-canvas. The fallback is running open-source canvas-lms locally in Docker.

## Milestones

1. **Setup:** `npx wxt@latest init` (React + TS), git, ESLint/Prettier, Vitest. Load unpacked in Chrome and Firefox.
2. **Walking skeleton:** popup toggle → storage → content script sets `html[data-cpp-theme]` on `*.instructure.com`, with one rule (dark background). Verify there's no flash on hard reload.
3. **Test harness:** save about 15 fixtures, set up Playwright with the extension, and capture the first visual baselines. *Done before the CSS work, so every rule after this gets checked.*
4. **Tokens and dark theme, student pages:** global nav + trays, dashboard (cards and list view), planner, course home, modules, assignments list and detail, submission page, grades, syllabus, pages, announcements, discussions, files, calendar, inbox, account settings, notifications, the To Do sidebar.
5. **Frames:** RCE iframe + TinyMCE toolbar, classic quizzes, New Quizzes. Confirm DocViewer and LTI tools are left alone and look intentional.
6. **Contrast pass** on course content, plus restore-on-disable.
7. **Custom domains:** detection, the permission flow, dynamic registration, and the domain list in options.
8. **More themes:** add an OLED/black theme, then a tinted one. This proves themes really are just data. Then the custom theme editor in options.
9. **Store prep:**
   - Icons, screenshots, short and long descriptions.
   - A privacy policy page ("we collect nothing; settings stay in your browser"). Chrome requires one even for storage-only extensions.
   - Single-purpose statement, a justification for each permission, no remote code, no minified/obfuscated source (WXT output is fine; AMO may ask for source).
   - $5 Chrome developer fee. Submit to the Chrome Web Store and AMO. Review takes from days to a few weeks.
10. **After launch:** keyboard shortcut, teacher pages (SpeedGrader, gradebook), the next canvas++ feature.

## Risks

| Risk | Mitigation |
|---|---|
| Canvas UI updates break rules | Stable selectors only, visual tests, and a scheduled live smoke run |
| Quiz content hidden or unreadable | Dedicated quiz fixtures + checklist. Never set `color` equal to the background on inputs/labels |
| Contrast pass slows huge pages | Process only added subtrees, debounce, skip containers that aren't content |
| Light flash on load | Manifest CSS + localStorage copy read synchronously at `document_start` |
| Store rejection over permissions | Narrow required hosts, optional per-domain hosts, clear justifications |
| Copying Better Canvas | Use it only as a reference for *which* areas need styling. Write our own rules |
