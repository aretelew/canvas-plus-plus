// The store images as HTML, drawn from shots of the extension (store-images.ts).
//
// The first screenshot shows the whole product; each one after it shows a
// feature, its background and text in the tokens of the theme it wears. The
// product runs large and off the edges; the store's images should be full bleed,
// and its promo images should work at half size with no text.

import { readFileSync } from 'node:fs';

// the themes the images wear
export const THEMES = ['dark', 'oled', 'ember', 'rose', 'sea'] as const;

export type Theme = (typeof THEMES)[number];

// the theme the search's slide wears
export const SEARCH_THEME: Theme = 'rose';

// the size of the dashboard in the shots
export const VIEWPORT = { width: 1440, height: 900 };

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// a theme's tokens, as the page has them
export interface Palette {
  bg: string;
  border: string;
  text: string;
  muted: string;
  link: string;
}

export interface Shots {
  looks: Record<Theme, { shot: Buffer; palette: Palette }>;
  regions: { cards: Box[] };
  // the search box, open with its results
  search: Buffer;
  popups: { features: Buffer; themes: Buffer };
}

export interface Image extends Size {
  // in store/
  file: string;
  html: string;
}

interface Size {
  width: number;
  height: number;
}

const SCREENSHOT: Size = { width: 1280, height: 800 };
const TILE: Size = { width: 440, height: 280 };
const MARQUEE: Size = { width: 1400, height: 560 };

// a screenshot's copy, where it goes, and the art beside it
interface Slide {
  left: number;
  top: number;
  width: number;
  headline: string;
  text: string;
  art: string;
}

// the icon's blue, and the color of the mark on it
const BRAND = { blue: '#8ab4ff', grid: '#79a6f7', ink: '#1b1e24' };

const src = (shot: Buffer) =>
  `data:image/png;base64,${shot.toString('base64')}`;
// inlined, so it takes the text color
const MARK = readFileSync(new URL('mark.svg', import.meta.url), 'utf8');

// the promo tile's grid of pluses, every 24px
const pluses = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path stroke="${color}" stroke-width="1.5" d="M12 8v8M8 12h8"/></svg>`,
  )}")`;

const stylesheet = ({ width, height }: Size, colors: string) => `
  <!doctype html>
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=block" rel="stylesheet">
  <style>
    * { margin: 0; box-sizing: border-box; }
    ${colors}
    body {
      width: ${String(width)}px; height: ${String(height)}px;
      position: relative; overflow: hidden;
      font-family: Satoshi, sans-serif; color: var(--text); background: var(--bg);
    }
    .backdrop { position: absolute; inset: 0; opacity: var(--backdrop); background:
      radial-gradient(1000px 760px at 74% 36%, var(--glow), transparent),
      var(--pluses) -12px -12px; }
    .brand { position: absolute; top: 56px; display: flex; align-items: center;
      gap: 12px; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; }
    .brand svg { display: block; width: 33px; height: 32px; }
    .mark { position: absolute; }
    .mark svg { display: block; width: 100%; height: 100%; }
    .copy { position: absolute; display: flex; flex-direction: column; }
    h1 { font-size: 60px; line-height: 1.05; font-weight: 700; letter-spacing: -0.03em; }
    p { margin-top: 22px; font-size: 24px; line-height: 1.4; font-weight: 500; color: var(--muted); }
    .crop { position: relative; overflow: hidden; }
    .crop img { position: absolute; display: block; max-width: none; }
    .float { position: absolute; border-radius: 16px; overflow: hidden; background: var(--bg);
      box-shadow: 0 2px 4px rgb(0 0 0 / 0.2), 0 32px 80px rgb(0 0 0 / 0.45);
      outline: 1px solid var(--border); }
    .float > img { display: block; }
    .tilted { position: absolute; transform-origin: 0 0;
      transform: rotate(-16deg) skewX(16deg); }
    .tilted .crop { border-radius: 14px;
      box-shadow: 0 2px 4px rgb(0 0 0 / 0.2), 0 24px 56px rgb(20 30 60 / 0.4); }
  </style>`;

const colors = (palette: Palette) => `:root {
  --bg: ${palette.bg}; --border: ${palette.border}; --pluses: ${pluses(palette.border)};
  --text: ${palette.text}; --muted: ${palette.muted};
  --glow: color-mix(in oklab, ${palette.link} 26%, transparent); --backdrop: 0.55;
}`;

// the brand's own colors, for the images that wear no theme
const BRANDED = `:root {
  --bg: ${BRAND.blue}; --border: rgb(0 0 0 / 0.12); --pluses: ${pluses(BRAND.grid)};
  --text: ${BRAND.ink}; --muted: ${BRAND.ink}; --glow: transparent; --backdrop: 1;
}`;

const px = (value: number) => `${String(value)}px`;

export function slides({ looks, regions, search, popups }: Shots): Image[] {
  const [first, second, third] = regions.cards;
  if (!first || !second || !third) throw new Error('needs three cards');

  // `box` of the dashboard, at `scale`
  const crop = (theme: Theme, box: Box, scale: number) => `
    <div class="crop" style="width: ${px(box.width * scale)}; height: ${px(box.height * scale)}">
      <img src="${src(looks[theme].shot)}" style="width: ${px(VIEWPORT.width * scale)};
        left: ${px(-box.x * scale)}; top: ${px(-box.y * scale)}">
    </div>`;

  const float = (inner: string, left: number, top: number, padding = 0) =>
    `<div class="float" style="left: ${px(left)}; top: ${px(top)}; padding: ${px(padding)}">${inner}</div>`;

  const popup = (shot: Buffer, width: number, left: number, top: number) =>
    float(`<img src="${src(shot)}" style="width: ${px(width)}">`, left, top);

  // the cards alone, at `scale`, for the promo images
  const tilted = (theme: Theme, left: number, top: number, scale: number) => {
    const last = regions.cards.at(-1) ?? first;
    return `<div class="tilted" style="left: ${px(left)}; top: ${px(top)}">
      ${crop(
        theme,
        {
          x: first.x,
          y: first.y,
          width: last.x + last.width - first.x,
          height: last.y + last.height - first.y,
        },
        scale,
      )}
    </div>`;
  };

  // a screenshot wearing a theme, with its copy on one side
  const themed = (
    file: string,
    theme: Theme,
    { left, top, width, headline, text, art }: Slide,
  ): Image => ({
    file,
    ...SCREENSHOT,
    html: `${stylesheet(SCREENSHOT, colors(looks[theme].palette))}
      <div class="backdrop"></div>
      ${art}
      <div class="brand" style="left: ${px(left)}">${MARK}canvas++</div>
      <div class="copy" style="left: ${px(left)}; top: ${px(top)}; width: ${px(width)}">
        <h1>${headline}</h1><p>${text}</p>
      </div>`,
  });

  return [
    {
      file: 'screenshots/1-overview.png',
      ...SCREENSHOT,
      html: `${stylesheet(SCREENSHOT, BRANDED)}
        <div class="backdrop"></div>
        <div class="brand" style="left: 72px; top: 44px">${MARK}canvas++</div>
        <div class="copy" style="left: 72px; top: 92px; right: 72px">
          <h1 style="font-size: 66px">A cleaner, calmer Canvas</h1>
          <p style="margin-top: 10px">Courses in your sidebar, grades and due dates on your cards, and a choice of themes.</p>
        </div>
        <div class="float" style="left: 72px; top: 236px; border-radius: 16px 16px 0 0">
          ${crop('dark', { x: 0, y: 0, width: VIEWPORT.width, height: 730 }, 0.79)}
        </div>`,
    },
    themed('screenshots/2-sidebar.png', 'oled', {
      left: 838,
      top: 232,
      width: 400,
      headline: 'Every course,<br>one click away',
      text: "Your courses and groups in the left sidebar, with what's due in each and the pages you opened last.",
      art: float(
        crop('oled', { x: 0, y: 0, width: 600, height: 620 }, 1.29),
        -2,
        -2,
      ),
    }),
    themed('screenshots/3-cards.png', 'ember', {
      left: 72,
      top: 232,
      width: 390,
      headline: 'Grades and due dates on your cards',
      text: 'Check work off right there, and Canvas marks it done in your To Do list too.',
      art: [first, second, third]
        .map((card, i) =>
          float(
            crop('ember', card, 1.32),
            500 + i * 370,
            [176, 96, 236][i] ?? 0,
          ),
        )
        .join(''),
    }),
    themed('screenshots/4-search.png', SEARCH_THEME, {
      left: 72,
      top: 250,
      width: 390,
      headline: 'Search all<br>your courses',
      text: 'Press ⌘K and type to jump to a course, assignment, page or announcement.',
      art: popup(search, 740, 492, 222),
    }),
    themed('screenshots/5-control.png', 'sea', {
      left: 72,
      top: 268,
      width: 390,
      headline: 'A switch for every feature',
      text: 'Search is on from the start. Everything else waits for you to turn it on.',
      art:
        popup(popups.features, 370, 484, 200) +
        popup(popups.themes, 370, 874, 300),
    }),
    {
      file: 'promo-tile.png',
      ...TILE,
      html: `${stylesheet(TILE, BRANDED)}
        <div class="backdrop"></div>
        ${tilted('dark', 176, 118, 0.4)}
        <div class="mark" style="left: 36px; top: 94px; width: 96px; height: 93px">${MARK}</div>`,
    },
    {
      file: 'marquee.png',
      ...MARQUEE,
      html: `${stylesheet(MARQUEE, BRANDED)}
        <div class="backdrop"></div>
        ${tilted('dark', 470, 210, 0.92)}
        <div class="mark" style="left: 128px; top: 186px; width: 194px; height: 188px">${MARK}</div>`,
    },
  ];
}
