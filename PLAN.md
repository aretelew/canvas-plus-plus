# canvas++ — plan

A browser extension that improves Canvas LMS. Feature #1 is a **theme engine**: dark is the first theme, with more themes and custom themes later. It's built so other features can plug in after.

## Decisions so far

| Topic                   | Decision                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Target                  | Canvas LMS: `*.instructure.com` plus schools' custom domains                                                     |
| Audience                | Public: Chrome Web Store + Firefox Add-ons (AMO)                                                                 |
| Browsers                | Chrome (and therefore Edge/Brave/Arc) and Firefox from day one                                                   |
| Stack                   | WXT + TypeScript; Preact via preact/compat (React API) for all UI; theme engine framework-free                   |
| Backend                 | None. All state lives in `storage`; we collect nothing                                                           |
| Default                 | Themes **off** by default; the user turns them on                                                                |
| Trigger                 | Manual toggle (popup, later a keyboard shortcut)                                                                 |
| Engine                  | Our own token-based CSS + a JS contrast pass for course content                                                  |
| Course content          | Readability wins over author colors                                                                              |
| Third-party LTI iframes | Left alone (stay light)                                                                                          |
| Test coverage v1        | Student-facing pages first; teacher pages later                                                                  |
| Positioning             | **Cleaner, more minimal and lighter than Better Canvas.** It has about 2M users but looks cluttered and is heavy |

### What "minimal and light" commits us to

- **Size limits** (checked in CI): content script under 15 KB gzipped, theme CSS under 20 KB gzipped, popup under 20 KB gzipped (Preact included). Any UI injected into Canvas pages uses Preact too, since it loads on every page view.
- **Runtime:** no work on pages where the extension is off beyond one attribute check. No polling or timers. The MutationObserver only watches content containers.
- **UI:** the popup is one on/off switch per feature (plus, later, a theme picker). A feature's finer settings go in the options page. Every new setting has to justify itself.
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
│  │  ├─ popup/             # Preact: on/off toggle, theme picker, "enable on this site"
│  │  └─ options/           # Preact: full settings, later the custom theme editor
│  ├─ core/
│  │  ├─ canvas-api.ts      # Canvas REST requests with the user's session (CSRF, Firefox's content.fetch)
│  │  ├─ dashboard-cards.ts # keeps a feature's addition on every dashboard card while its setting is on
│  │  ├─ settings.ts        # typed settings schema + storage wrapper + change events
│  │  ├─ features.ts        # feature registry (see below)
│  │  ├─ canvas-detect.ts   # "is this page Canvas?" (window.ENV, #application.ic-app, …)
│  │  └─ domains.ts         # list of enabled custom domains, permission helpers
│  └─ features/
│     └─ themes/
│        ├─ storage.ts      # the setting(s)
│        ├─ page.ts         # turns the theme on/off on the page, no-flash cached copy
│        ├─ palette.ts      # classifies a computed color into a role (pure, unit-tested)
│        ├─ recolor.ts      # tags elements with their roles, once per frame
│        └─ theme.css       # tokens, Canvas variable remaps, one rule per role
└─ tests/
   ├─ fixtures/             # saved Canvas pages (GITIGNORED, has personal data)
   └─ visual/               # Playwright screenshot tests
```

### Feature registry (for later features)

Each feature exports `{ id, name, defaultEnabled, settings schema, apply(ctx), teardown() }`. The content script loads settings once, then runs `apply` for each enabled feature, giving it a context with the document, settings, and an `onSettingsChange` hook. Themes is the first feature. A GPA calculator or a todo tweak would be the next ones, with no changes to the core.

### Theme engine (as built in milestone 4)

Selector files per page turned out to be the wrong tool. Measured on real pages, only 12% of Canvas's color declarations use CSS variables, and InstUI's generated class names don't say which color variant an element uses (the same `-text` class is black, grey, white or link blue). What Canvas does have is a **small, fixed neutral palette**: `#fff` surfaces, `#f2f4f4` secondary surfaces, a ladder of near-black greys for text, light grey borders.

- **Roles, not selectors:** `palette.ts` classifies a computed color by luminance and saturation into a role (`surface` for any light neutral background, `text`, `muted`, `link`, `border`, `border-strong`, `hidden` for white borders). Anything saturated (course colors, status red and green, brand) gets no role and is left alone.
- **Lift:** dark _saturated_ text (course colors as text, status text) gets the `lift` role. CSS keeps its hue and raises its lightness, `oklch(from <color> max(l, 0.75) c h)`, unless it sits on a colored backdrop such as a highlight.
- **Backgrounds by element, not shade:** Canvas is white on white, so containers are invisible; the theme keeps it that way. A light background inside a button or input becomes `control` (lighter), one Canvas lifts with a drop shadow becomes `elevated` (cards, menus, trays; a step lighter), and everything else becomes `page`, the same color as the page. Shadowed callouts in the page flow (InstUI alerts) stay `page`. Flat elements inside a card take the card's color.
- **Decorations made for white:** light "emboss" shadows (`text-shadow`/`box-shadow` such as `1px 1px 0 rgba(255,255,255,.5)`) are removed, because on dark they look like a ghost copy of the text. Light neutral fades (`linear-gradient(..., white)`, also on `::before`/`::after`) are rewritten to fade into the page color. Light SVG strokes (spinner tracks) become the border color.
- **Tagging:** `recolor.ts` sets `data-cpp-bg/-fg/-border` (plus `-emboss`, `-stroke`, `-gradient`) attributes. A MutationObserver queues new elements, and they're tagged in one batch per frame from `requestAnimationFrame`, which runs after the frame's stylesheets have loaded and before it paints. The batch reads every color first, then writes every tag. The first frame is dark, measured as painted. The cost is 2–5 ms per page, about 50 ms once on an 11k-element modules page. It only runs while a theme is on, and tags are inert when it's off.
- **CSS:** `theme.css` holds the token values, remaps Canvas's own variables (link color, font colors, the active nav icon), styles the page body statically for the first frame, and has one `!important` rule per role.
- **States:** a color Canvas only shows on hover or focus (a grades row turning light blue) doesn't exist when elements are tagged. The first time an element is hovered or focused, `recolor.ts` reads Canvas's color for that state with transitions off, and if it's light, tags the element `data-cpp-state` (`row` gets a faint tint, `control` the lighter control shade). Small components' insides are checked too, since hover styles reach into them (`button:hover > span`).
- **Tokens:** `bg`, `elevated`, `control`, `control-hover`, `hover`, `border`, `border-strong`, `text`, `muted`, `link`, `emphasis` (Canvas's black marks: selected radios, black borders). They grow only when a theme needs another distinction.
- **Brand stays:** the global nav and primary buttons keep the school's colors.
- **Themes are data** (milestone 8): a theme is a set of token values, so switching themes rewrites one block of variables.
- **No light flash:** see milestone 2. Manifest CSS is injected before the DOM exists, and the attribute is set from a copy cached in the page's `localStorage`.
- **Known limits:** colors a script sets after an element is tagged (a row selected by clicking) are masked by its role, and specific states may need a rule later. Faded "completed" calendar events stay faded, as Canvas intends.

### Grades on dashboard cards

Off by default (popup switch). On the dashboard (the site root, top frame only), each card gets a pill at the top left of its color/image with the course's current score, linking to `/courses/:id/grades`. Scores come from one `GET /api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&include[]=restrict_quantitative_data` request, sent the first time grades are on (`features/grades/scores.ts` picks the score, unit-tested). In a course with grading periods it's the current period's score. Courses with nothing to show get no pill: no grades yet, totals hidden, between periods, not a student, or percentages hidden from students (the course's `restrict_quantitative_data`; a letter grade alone doesn't mean that, since every course with a grading scheme has one). The pill uses Canvas's white and text colors, so the theme recolors it like any card element. In Firefox the request goes through `content.fetch` so it carries the page's session; that path is still unverified by hand.

### Assignments on dashboard cards

Off by default (popup switch). On the dashboard (site root, top frame), each card ends with a "Due" list of up to 4 items for its course: unfinished work up to 2 weeks overdue (date in red), then everything due in the next 2 weeks, soonest first; finished work stays, struck through and faded. Items come from one `GET /api/v1/planner/items` request (2 weeks either side, `per_page=100`, following `Link: rel="next"`), sent the first time the lists are on. Announcements, calendar events and planner notes are left out. "Done" is Canvas's own planner rule (`features/assignments/planner.ts`, unit-tested): the user's planner override wins either way, else a peer review is done once completed and other work once submitted, unless the teacher asked for a redo. The circle checks an item off in Canvas itself (`POST /api/v1/planner/overrides`, then `PUT …/:id`, with the `_csrf_token` cookie as `X-CSRF-Token`; graded quizzes and discussions through their assignment), so it agrees with Canvas's To Do list and syncs across devices; a refused save is taken back. Better Canvas, by contrast, keeps its checkmarks in extension storage. While a card has a list, its links (Announcements, Assignments, …) sit at the bottom left of its color or image instead of under the title, so the list follows the title and cards get shorter. They're in a pill like the grade pill (white with Canvas's icon grey; the card's shades in the dark theme), since teachers' course images can be busy. This is CSS keyed on `:has(> .cpp-card-due)` (Canvas fixes that area at 146px), so it comes and goes with the list. In the dark theme the pill's colors are `!important`, because the icons may carry roles tagged before the list came. Like the grade pills, the list uses Canvas's own text colors so the theme recolors it, and done rows fade by opacity, which a role can't mask. Lists differ in length, so while they're on, the card container becomes a grid with Canvas's own columns (262px cards after 36px gaps, one full-width column below 620px) and every row as tall as the tallest, which makes every card the same height. In Firefox the requests go through `content.fetch`; unverified by hand.

### Contrast pass (course content)

Partly covered by `lift`: course-colored and status text is readable, and the browser tests check that no page has more contrast problems with the theme on than Canvas itself (`@axe-core/playwright`). What's left for milestone 6 is instructor-authored HTML: arbitrary inline colors and highlights in `.user_content`, page bodies and the RCE iframe, keeping `img`, `svg`, `.equation_image` and MathML alone.

### Domains and permissions (as built in milestone 7)

- **Manifest:** `permissions: ["storage", "scripting", "activeTab"]`, `optional_host_permissions: ["https://*/*"]`. The content script's own match (`https://*.instructure.com/*`) is the only host access at install, so the install prompt has no "all websites" warning. Firefox needs 128+ (optional host permissions, `matchOriginAsFallback` in registrations).
- **Custom domain flow:** on a site that isn't instructure.com, opening the popup (`activeTab`) lets it check the page for Canvas's app shell or brand stylesheet (`features/domains/detect.ts`). If it's Canvas, the popup offers **"Turn on canvas++ here"**, which calls `permissions.request` for that site as the first thing in the click (Firefox requires it, and may close the popup for the prompt).
- **The grants are the list:** the background keeps one runtime-registered content script (the same built files as the manifest one) matching exactly the granted custom domains, and themes tabs already open on a newly granted one. No domain list is stored. The options page lists the grants and removes them.
- **Upkeep:** both browsers drop runtime registrations when the extension updates (checked in Chromium's and Firefox's source), so the background re-syncs on `runtime.onInstalled`, `permissions.onAdded` and `permissions.onRemoved`. Grants made from the browser's own site-access menu are picked up the same way.

### Settings

`storage.sync` limits: 100 KB total, 8 KB per item, 120 writes per minute. Store small settings there: enabled, theme id, per-feature settings, custom themes (one key each). Store the domain list and caches in `storage.local`. The content script listens to `storage.onChanged`, so toggling never needs a reload.

### Firefox notes (verify while building)

- WXT handles `browser.*` vs `chrome.*` and builds both manifests.
- Firefox MV3 treats host permissions as user-grantable. Check that `*.instructure.com` is actually granted on install and that the popup handles it when it isn't.
- Check `match_origin_as_fallback` and `registerContentScripts` support in current Firefox versions.

## Testing

- **Fixtures (built in milestone 3):** `npm run fixtures:record` signs in to your Canvas, discovers about 20 student pages and saves each as a HAR (every request and response, so the page replays offline with Canvas's own JS). Login cookies are stripped and a custom domain is rewritten to `fixture.instructure.com` so the content script runs on it. **They contain your name, grades and classmates' names, so they stay gitignored.** If we ever commit fixtures, scrub them first. agent-browser was tried for recording but loses the bodies of preloaded assets (Canvas's main bundle and fonts), so Playwright records.
- **Playwright with the extension loaded** (persistent context + `--load-extension`, in Chrome for Testing, which still allows that and never auto-updates):
  1. **Visual tests:** replay each fixture with a frozen clock, theme off and on, and compare full-page screenshots against approved baselines with a tight color threshold. This is how we "don't break". The off screenshots also prove our CSS does nothing while off.
  2. **Contrast audit:** axe-core's color-contrast rule on each fixture. The theme may not add violations Canvas doesn't already have.
  3. **Live smoke test:** run against the real Canvas with a saved logged-in profile. Run it manually, not in CI.
- **Unit tests (Vitest):** contrast math, settings schema migrations, `canvas-detect`.
- **Quizzes get their own checklist:** classic quiz and New Quizzes. Every question type renders, answer choices are visible, and selected/correct states are distinguishable.
- **Teacher pages:** later. Free-for-Teacher signups appear limited in 2026, so check canvaslms.com/try-canvas. The fallback is running open-source canvas-lms locally in Docker.

## Milestones

1. **Setup:** `npx wxt@latest init` (React + TS), git, ESLint/Prettier, Vitest. Load unpacked in Chrome and Firefox.
2. **Walking skeleton:** popup toggle → storage → content script sets `html[data-cpp-theme]` on `*.instructure.com`, with one rule (dark background). Verify there's no flash on hard reload.
3. **Test harness:** save about 15 fixtures, set up Playwright with the extension, and capture the first visual baselines. _Done before the CSS work, so every rule after this gets checked._
4. **Tokens and dark theme, student pages** (done for the 27 recorded pages: both dashboard views and two courses; see Theme engine. The nav trays and submission page aren't recorded yet, so they work in principle but are unverified): global nav + trays, dashboard (cards and list view), planner, course home, modules, assignments list and detail, submission page, grades, syllabus, pages, announcements, discussions, files, calendar, inbox, account settings, notifications, the To Do sidebar.
5. **Frames** (done): New Quizzes frames are themed; DocViewer and third-party LTI tools are left alone. The Rich Content Editor's frame (TinyMCE writes it into an iframe with no URL, so the script runs there via `matchOriginAsFallback`) only gets the page attribute and static colors, never element tags: TinyMCE saves the body as shown. Classic quizzes are recorded and pass the quiz checklist.
6. **Contrast pass** on course content, plus restore-on-disable.
7. **Custom domains** (done; see Domains and permissions): detection, the permission flow, dynamic registration, and the domain list in options. The permission prompt itself can't be automated, so the flow is checked by hand in each browser.
8. **More themes:** add an OLED/black theme, then a tinted one. This proves themes really are just data. Then the custom theme editor in options.
9. **Store prep:**
   - Icons, screenshots, short and long descriptions.
   - A privacy policy page ("we collect nothing; settings stay in your browser"). Chrome requires one even for storage-only extensions.
   - Single-purpose statement, a justification for each permission, no remote code, no minified/obfuscated source (WXT output is fine; AMO may ask for source).
   - $5 Chrome developer fee. Submit to the Chrome Web Store and AMO. Review takes from days to a few weeks.
10. **After launch:** keyboard shortcut, teacher pages (SpeedGrader, gradebook), the next canvas++ feature.

## Risks

| Risk                              | Mitigation                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Canvas UI updates break rules     | Stable selectors only, visual tests, and a scheduled live smoke run                             |
| Quiz content hidden or unreadable | Dedicated quiz fixtures + checklist. Never set `color` equal to the background on inputs/labels |
| Contrast pass slows huge pages    | Process only added subtrees, debounce, skip containers that aren't content                      |
| Light flash on load               | Manifest CSS + localStorage copy read synchronously at `document_start`                         |
| Store rejection over permissions  | Narrow required hosts, optional per-domain hosts, clear justifications                          |
| Copying Better Canvas             | Use it only as a reference for _which_ areas need styling. Write our own rules                  |
