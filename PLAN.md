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
- **UI:** the popup is one on/off switch per feature (plus, later, a theme picker), grouped into sections by the part of Canvas they change (Appearance, Dashboard, Sidebar). Its main page lists the sections, and each opens to its switches with a back arrow. Themes opens to Ember, Nord and a Dark mode page (Dark, Dark (OLED), System). The gear opens the settings: what's set once rather than flipped often (school domains, reset, about). Every new setting has to justify itself.
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
- **CSS:** `theme.css` holds the token values, remaps Canvas's own variables (link color, font colors, the global nav), styles the page body statically for the first frame, and has one `!important` rule per role.
- **States:** a color Canvas only shows on hover or focus (a grades row turning light blue) doesn't exist when elements are tagged. The first time an element is hovered or focused, `recolor.ts` reads Canvas's color for that state with transitions off, and if it's light, tags the element `data-cpp-state` (`row` gets a faint tint, `control` the lighter control shade). Small components' insides are checked too, since hover styles reach into them (`button:hover > span`).
- **Tokens:** `bg`, `elevated`, `control`, `control-hover`, `hover`, `border`, `border-strong`, `text`, `muted`, `link`, `nav`, `emphasis` (Canvas's black marks: selected radios, black borders), `lift-l`, `tint-l`, `tint-c`. They grow only when a theme needs another distinction.
- **The global nav takes the theme:** each theme has a `nav` token, its own color apart from page and cards, and remaps Canvas's `--ic-brand-global-nav-*` variables, so the nav is right from the first frame and on any school's colors. The active item is the page's color, like a tab into the page, and counts use the link color. The logo's tile goes while the school's color is dark (`oklch` lightness under 0.6), since that means a light logo that reads on the nav; a light one may mean a dark logo, so the tile stays. Primary buttons keep the school's colors.
- **Themes are data** (milestone 8): a theme is a set of token values, so switching themes rewrites one block of variables. Dark, OLED, Ember (warm brown-black, amber links) and Nord (the Nord palette's slate blues) are built this way. Nord's surfaces are lighter than the others', so two tokens set how far it lifts colored text and tints teachers' highlights, and mid-toned colored text gets its own `lift-mid` role, which only Nord acts on.
- **No light flash:** see milestone 2. Manifest CSS is injected before the DOM exists, and the attribute is set from a copy cached in the page's `localStorage`.
- **Known limits:** colors a script sets after an element is tagged (a row selected by clicking) are masked by its role, and specific states may need a rule later. Faded "completed" calendar events stay faded, as Canvas intends.

### Grades on dashboard cards

Off by default (popup switch). On the dashboard (the site root, top frame only), each card gets a pill at the top left of its color/image with the course's current score, linking to `/courses/:id/grades`. Scores come from one `GET /api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&include[]=restrict_quantitative_data` request, sent the first time grades are on (`features/grades/scores.ts` picks the score, unit-tested). In a course with grading periods it's the current period's score. Courses with nothing to show get no pill: no grades yet, totals hidden, between periods, not a student, or percentages hidden from students (the course's `restrict_quantitative_data`; a letter grade alone doesn't mean that, since every course with a grading scheme has one). The pill uses Canvas's white and text colors, so the theme recolors it like any card element. In Firefox the request goes through `content.fetch` so it carries the page's session; that path is still unverified by hand.

### Assignments on dashboard cards

Off by default (popup switch). On the dashboard (site root, top frame), each card ends with a "Due" list of up to 4 items for its course: unfinished work up to 2 weeks overdue (date in red), then everything due in the next 2 weeks, soonest first; finished work stays, struck through and faded. Items come from one `GET /api/v1/planner/items` request (2 weeks either side, `per_page=100`, following `Link: rel="next"`), sent the first time the lists are on. Announcements, calendar events and planner notes are left out. "Done" is Canvas's own planner rule (`core/planner.ts`, unit-tested): the user's planner override wins either way, else a peer review is done once completed and other work once submitted, unless the teacher asked for a redo. Past Canvas's rule, work the teacher graded or excused is done too, since an exam taken on paper is never "submitted". The circle (`core/done-check.ts`) checks an item off in Canvas itself (`POST /api/v1/planner/overrides`, then `PUT …/:id`, with the `_csrf_token` cookie as `X-CSRF-Token`; graded quizzes and discussions through their assignment), so it agrees with Canvas's To Do list and syncs across devices; a refused save is taken back. The planner request and the work it gives are shared with the sidebar's To Do, so checking work off in either shows in both. Better Canvas, by contrast, keeps its checkmarks in extension storage. While a card has a list, its links (Announcements, Assignments, …) sit at the bottom left of its color or image instead of under the title, so the list follows the title and cards get shorter. They're in a pill like the grade pill (white with Canvas's icon grey; the card's shades in the dark theme), since teachers' course images can be busy. This is CSS keyed on `:has(> .cpp-card-due)` (Canvas fixes that area at 146px), so it comes and goes with the list. In the dark theme the pill's colors are `!important`, because the icons may carry roles tagged before the list came. Like the grade pills, the list uses Canvas's own text colors so the theme recolors it, and done rows fade by opacity, which a role can't mask. Lists differ in length, so while they're on, the card container becomes a grid with Canvas's own columns (262px cards after 36px gaps, one full-width column below 620px) and every row as tall as the tallest, which makes every card the same height. In Firefox the requests go through `content.fetch`; unverified by hand.

### Tidy To Do list (sidebar)

Off by default (popup switch). Canvas's right sidebar (the dashboard's, and a course home's) has a To Do list and Recent Feedback. Canvas's To Do asks the planner for the first 14 unfinished items from two weeks back, and an unread announcement counts as unfinished, so in a recorded dashboard 13 of the 14 were announcements and real work fell off the list. The switch replaces both lists with two of our own in one style: each row a title (two lines at most), its course's code with a dot in the course's color, and on the right its due date or score.

- **To Do:** work only, from the shared planner request (`core/planner.ts`): assignments, quizzes, graded discussions, pages with a to-do date, peer reviews and the user's own notes (no link: they have no page). Announcements and calendar events are left out; unread announcements still show on the dashboard cards' badges. Done and dismissed work is left out. Rows are grouped Overdue (red), Today, Tomorrow, This week, Later (`features/sidebar/todo.ts`, unit-tested), each showing only what its group doesn't say (a time, a weekday, a date). The first 7 show, then "Show N more", which becomes "Show less" once the rest are shown. The heading counts what's left. The circle is the shared one, so work checked off here stays struck through until the page reloads, and its card agrees. If the planner request fails, Canvas's own list stays.
- **Recent Feedback:** read from Canvas's own list, already in the page (`features/sidebar/feedback.ts`), so it costs no request and keeps the teacher's comment, which the grades API doesn't give. Scores are shortened ("95/100"), comments shown in italics up to two lines. The first 3 show (Canvas hides the rest), then "Show N more" (and "Show less" after), and on the dashboard "All grades" replaces Canvas's View Grades button. Canvas doesn't say when feedback came, so it stays in Canvas's order.
- **Course labels:** codes from the user's active courses (`core/courses.ts`, the same request as the card grades, now shared) and colors from `GET /api/v1/users/self/colors`. Without them a row falls back to what Canvas gave. On a course's own pages both lists are that course's, without labels.
- **Page:** `html[data-cpp-sidebar]` hides Canvas's lists, cached in the page's `localStorage` like the logo switch so they don't show for a moment. The dashboard's sidebar comes in a request after the page loads (`/dashboard-sidebar`) and Canvas draws its To Do with React after that, so an observer on `#right-side` adds ours when they come. On the dashboard, To Do's heading line is lowered to continue the Dashboard heading's line. Canvas's hidden To Do still makes its own request.

### Hiding the school logo

Off by default (popup switch). It hides the school's logo at the top of the global nav with `visibility: hidden` on `.ic-app-header__logomark-container`, which keeps the logo's space so the nav's buttons stay exactly where they were, in the expanded and the collapsed nav alike. It also takes the logo's link out of the tab order and away from screen readers; the Dashboard button goes to the same place. The switch is `html[data-cpp-hide-logo]`, cached in the page's `localStorage` like the theme (`core/page-mirror.ts`) so the logo doesn't show for a moment on every page load. The theme's recolor pass only takes off the tags it sets, so switches like this one survive it.

### Hiding the footer

Off by default (popup switch). It hides the bar of Instructure's links at the bottom of every page (Privacy Policy, Cookie Notice, Acceptable Use Policy, Facebook, X.com) with `display: none` on `#footer.ic-app-footer`; nothing comes after it, so nothing else moves. The switch is `html[data-cpp-hide-footer]`, cached like the logo's: both go through `core/page-flag.ts`, which tags `<html>` while a switch is on and keeps the copy in the page's `localStorage`.

### Hiding SensusAccess

Off by default (popup switch), since some students rely on the tool. SensusAccess Inside is a third-party tool a school can add to Canvas: its "S" buttons convert a file or page to audio, Braille, an e-book and so on. Canvas doesn't list it as a tool: the school's global JS loads it, and its script adds the buttons to list rows (modules, files, assignments, quizzes, discussions, announcements) and the headings of content pages, each wrapped in `.sensus-access-button-item`, which takes `display: none` under `html[data-cpp-hide-sensus]` (`core/page-flag.ts`, like the footer). On the Pages list the wrapper is a `td` and the script also appends an empty `th` to `tr.header-row`; that's hidden too, only while the list has the buttons, since Canvas's own last header cell can be empty. Its enable/disable link in Course Settings (`.sensus-enable-disable`) goes with them. No recorded page has the Pages list or Course Settings, so the e2e tests use the script's markup; the Pages list was also checked once on live Canvas, while Course Settings answers 401 for students. The scripts still load: this only hides what they add.

### Contrast pass (course content, as built in milestone 6)

Teachers write course content in Canvas's editor, which offers 22 colors (TinyMCE's default map) for text and highlight. Canvas renders it inside `.user_content` on every content page (pages, assignments, announcements, discussions, both quiz types, the syllabus). Measured with the theme on, colored _text_ already read through `lift`; colored _backgrounds_ didn't: the theme made the text light but left a highlight, colored table cell or callout box as written, so light highlights fell to about 1:1.

- **Tint:** inside `.user_content`, a background too light for the theme's text (luminance above 0.12; `tints()` in `palette.ts`) is tagged `tint`, and CSS turns it into a dark shade of its own hue (`oklch(from <color> var(--cpp-tint-l) min(c, var(--cpp-tint-c)) h)`, 0.32 and 0.07 in the dark theme). Yellow stays recognizably yellow, and light text reads on it at 8:1 or better. Light neutral ones are surfaces as before; dark ones (a teacher's navy banner with white text) read as they are and stay.
- **Text on a tint:** dark colored text on a tinted background is lifted like colored text on the page (`liftsOn(…, content)`). Outside course content, colored backgrounds (Canvas's badges, course colors) still keep dark text and their colors.
- **Restore on disable:** nothing to do. Like every tag, `tint` is inert without `html[data-cpp-theme]`, which the test checks by turning the theme off again.
- **Test:** `tests/e2e/course-content.spec.ts` renders every editor color as text and highlight, plus common combinations, tables and callouts, and requires each to read at 4.5:1 with the theme on, or no worse than the teacher made it. The recorded courses use no inline colors, so the visual tests can't catch this.
- **Known limits:** the Rich Content Editor's frame is never tagged (see milestone 5), so a highlight is still light text on a light color while editing. A pale color close to grey (`#d1ecf1`) counts as a neutral surface and goes flat, losing its box but staying readable. `.equation_image` (black ink on transparent) is untested: none of the recorded pages have one.

### Domains and permissions (as built in milestone 7)

- **Manifest:** `permissions: ["storage", "scripting", "activeTab"]`, `optional_host_permissions: ["https://*/*"]`. The content script's own match (`https://*.instructure.com/*`) is the only host access at install, so the install prompt has no "all websites" warning. Firefox needs 128+ (optional host permissions, `matchOriginAsFallback` in registrations).
- **Custom domain flow:** on a site that isn't instructure.com, opening the popup (`activeTab`) lets it check the page for Canvas's app shell or brand stylesheet (`features/domains/detect.ts`). If it's Canvas, the popup offers to **Enable** canvas++ there, which calls `permissions.request` for that site as the first thing in the click (Firefox requires it, and may close the popup for the prompt).
- **The grants are the list:** the background keeps one runtime-registered content script (the same built files as the manifest one) matching exactly the granted custom domains, and themes tabs already open on a newly granted one. No domain list is stored. The popup's settings list the grants and remove them.
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
6. **Contrast pass** (done; see Contrast pass): teachers' highlights and colored cells darkened to a shade of their color. Left: the editor's frame and equation images.
7. **Custom domains** (done; see Domains and permissions): detection, the permission flow, dynamic registration, and the domain list in options. The permission prompt itself can't be automated, so the flow is checked by hand in each browser.
8. **More themes** (OLED, Ember and Nord done): each is a token block, which proves themes really are just data. Next is a theme tinted from the school's brand color, then a light one, then the custom theme editor in options.
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
