# Privacy policy

canvas++ is a browser extension that restyles Canvas LMS and adds a few features to it. It has no server of its own: nothing it reads or saves is sent to the developer or to anyone else.

## What it reads

On a Canvas site, canvas++ reads the page to restyle it, and, when you turn the matching features on, uses Canvas's own API with your existing Canvas session to get:

- your courses and their current scores, to show each course's grade on its dashboard card;
- your planner items (assignments, quizzes, discussions and the like that are due), to list them on each course's dashboard card.

These are shown on the page and not stored anywhere. They're fetched again on each page load.

When you open the canvas++ popup, it checks whether the current tab is a Canvas page, to offer turning canvas++ on there.

## What it changes in Canvas

If you check off an item in a dashboard card's list, canvas++ marks it as done in your Canvas planner, the same as checking it in Canvas's own To Do list. Unchecking it marks it as not done. It makes no other changes to your Canvas account.

## What it saves

- Your settings (which features are on), in the browser's extension storage. If you use your browser's sync, the browser syncs them across your devices like any other extension's settings.
- On each Canvas site where the theme is on, one value in that site's local storage, so the theme can apply before the page first paints.
- The Canvas sites you've turned canvas++ on for, as the browser's own site permissions, which you can remove from the canvas++ options page or the browser's extension settings.

## Where data goes

canvas++ only makes requests to the Canvas site you're on. It has no analytics, ads or tracking, loads no remote code, and doesn't sell or share any data.

## Contact

Questions or concerns: open an issue at https://github.com/aretelew/canvas-plus-plus/issues.

Last updated October 28, 2026.
