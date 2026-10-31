# Privacy policy

canvas++ is a browser extension that restyles Canvas LMS and adds a few features to it. It has no server of its own: nothing it reads or saves is sent to the developer or to anyone else.

## What it reads

On a Canvas site, canvas++ reads the page to restyle it, and, when you turn the matching features on, uses Canvas's own API with your existing Canvas session to get:

- your courses and their current scores, to show each course's grade on its dashboard card;
- your planner items (assignments, quizzes, discussions and the like that are due), to list them on each course's dashboard card.
- your starred courses, your groups and your recent page history in Canvas, to list them in the left sidebar.

These are shown on the page. They're fetched again on each page load and not stored, except the left sidebar's list (see below).

When you open the canvas++ popup, it checks whether the current tab is a Canvas page, to offer turning canvas++ on there.

## What it changes in Canvas

If you check off an item in a dashboard card's list, canvas++ marks it as done in your Canvas planner, the same as checking it in Canvas's own To Do list. Unchecking it marks it as not done. It makes no other changes to your Canvas account.

## What it saves

- Your settings (which features are on), in the browser's extension storage. If you use your browser's sync, the browser syncs them across your devices like any other extension's settings.
- On each Canvas site where the theme is on, one value in that site's local storage, so the theme can apply before the page first paints.
- With the left sidebar on, your name, your courses, groups and how much is due in each, and the names of your last few pages, noted as you open them, in that site's local storage, so the sidebar can show before the page first paints. It stays in your browser, is refreshed after 10 minutes, and is removed when you turn the sidebar off.
- The Canvas sites you've turned canvas++ on for, as the browser's own site permissions, which you can remove from the canvas++ settings (the gear in its popup) or the browser's extension settings.

## Where data goes

canvas++ only makes requests to the Canvas site you're on. It has no analytics, ads or tracking, loads no remote code, and doesn't sell or share any data.

## Contact

Questions or concerns: open an issue at https://github.com/aretelew/canvas-plus-plus/issues.

Last updated October 28, 2026.
