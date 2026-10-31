# Chrome Web Store listing

Text for the developer dashboard, kept here so it changes with the code. The name ("canvas++") and summary come from the manifest, which takes them from `wxt.config.ts` and `package.json`'s `description`. The store shows the summary right above the description, so the description doesn't repeat it.

## Store listing tab

**Category:** Education (under Productivity)

**Language:** English

**Description:**

```
canvas++ restyles Canvas and adds a few things it's missing, with more on the way. Everything starts off, and you turn on what you want from the toolbar button.

• Dark theme: a dark mode made for Canvas, with no white flash between pages. Course colors, grades and your school's logo keep their meaning.
• True black: a pure black version of the dark theme for OLED screens.
• More themes: warm Ember, slate blue Nord, purple Rosé Pine, vivid Dracula, grey-green Everforest and dark teal Deep Sea.
• Grades on cards: each dashboard card shows your current grade in that course.
• Assignments on cards: each card lists what's due. Check something off there and Canvas marks it done in your To Do list too.

It works right away on any Canvas at *.instructure.com. If your school uses its own address, like canvas.yourschool.edu, open Canvas, click the canvas++ button and choose Enable.

canvas++ has no server. It only talks to your school's Canvas, using your existing login, and never sends your data anywhere else. There are no ads or tracking.

Source code: https://github.com/aretelew/canvas-plus-plus

canvas++ is an independent project and isn't affiliated with or endorsed by Instructure. Canvas is a trademark of Instructure, Inc.
```

## Privacy practices tab

**Single purpose:**

```
canvas++ improves the Canvas LMS website. It restyles Canvas pages with a dark theme and adds each course's grade and assignments to the Canvas dashboard.
```

**Permission justifications:**

`storage`

```
Saves which canvas++ features the user has turned on.
```

`scripting`

```
Registers the content script on a school's own Canvas address after the user turns canvas++ on for that site. Also checks whether the current tab is a Canvas page when the user opens the popup.
```

`activeTab`

```
When the user opens the popup, checks whether the current tab is a Canvas page, so the popup can offer to turn canvas++ on for that site.
```

Host permissions (content script on `https://*.instructure.com/*`, optional `https://*/*`)

```
The content script runs on *.instructure.com, where Canvas is hosted, to restyle pages and add the dashboard features. Some schools host Canvas on their own domain, so https://*/* is optional. canvas++ requests it for one site at a time (for example https://canvas.yourschool.edu/*) when the user clicks Enable in the popup, and the user can remove a site from the settings in the popup.
```

**Remote code:** No, I am not using remote code.

**Data usage:** check "Website content" only. Google counts data handled on the device, not just data sent off it, and canvas++ reads course names, grades and assignments from Canvas to show them on the dashboard (see [PRIVACY.md](../PRIVACY.md)). It reads no names, emails or other personal details, and nothing leaves the device.

**Certifications:** check all three (no selling data, no use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL:** https://github.com/aretelew/canvas-plus-plus/blob/main/PRIVACY.md

## Graphics

- Icon: `public/icon/128.png`, uploaded with the zip.
- Small promo tile (required): `store/promo-tile.png`, 440×280.
- Screenshots: the five 1280×800 images in `store/screenshots/`, in file order. `npm run store-images` renders them from the recorded dashboard with made-up courses, grades and assignments; look each one over for real data before uploading.

## Distribution

Start with **Unlisted** visibility and deferred publishing, then switch to Public once it's been tried.
