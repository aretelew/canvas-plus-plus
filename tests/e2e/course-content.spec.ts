// Course content is HTML teachers write in Canvas's editor, with any of its
// colors as text or highlight. With the theme on, every sample must read at
// least 4.5:1, or no worse than the teacher made it; highlights keep a shade of
// their color; and turning the theme off gives back the colors as written.

import type { Page } from '@playwright/test';
import { expect, test } from '../extension';

const URL = 'https://fixture.instructure.com/courses/1/pages/colors';

// The editor's color choices (TinyMCE's default map), for text and highlight
const COLORS = {
  'Light Green': '#BFEDD2',
  'Light Yellow': '#FBEEB8',
  'Light Red': '#F8CAC6',
  'Light Purple': '#ECCAFA',
  'Light Blue': '#C2E0F4',
  Green: '#2DC26B',
  Yellow: '#F1C40F',
  Red: '#E03E2D',
  Purple: '#B96AD9',
  Blue: '#3598DB',
  'Dark Turquoise': '#169179',
  Orange: '#E67E23',
  'Dark Red': '#BA372A',
  'Dark Purple': '#843FA1',
  'Dark Blue': '#236FA1',
  'Light Gray': '#ECF0F1',
  'Medium Gray': '#CED4D9',
  Gray: '#95A5A6',
  'Dark Gray': '#7E8C8D',
  'Navy Blue': '#34495E',
  Black: '#000000',
  White: '#FFFFFF',
};
const named = Object.entries(COLORS);

// each sample's text is the innermost element of its data-sample element
const sample = (label: string, html: string) =>
  `<p data-sample="${label}">${html}</p>`;
const span = (style: string, text: string) =>
  `<span style="${style}">${text}</span>`;

const SAMPLES = [
  sample('plain text', 'Plain paragraph text'),
  sample('plain link', '<a href="#">A plain link</a>'),
  sample('red link', '<a href="#" style="color: #E03E2D">A red link</a>'),
  sample('font tag', '<font color="#ff0000">An old font tag</font>'),
  ...named.map(([name, color]) =>
    sample(`${name} text`, span(`color: ${color}`, name)),
  ),
  ...named.map(([name, color]) =>
    sample(`${name} highlight`, span(`background-color: ${color}`, name)),
  ),
  // the editor's darker text colors on its lighter highlights
  ...(['Black', 'Dark Red', 'Dark Blue', 'Navy Blue'] as const).flatMap(
    (text) =>
      (['Light Yellow', 'Light Blue', 'Yellow', 'Light Gray'] as const).map(
        (highlight) =>
          sample(
            `${text} on ${highlight}`,
            span(
              `color: ${COLORS[text]}; background-color: ${COLORS[highlight]}`,
              `${text} on ${highlight}`,
            ),
          ),
      ),
  ),
  sample(
    'white on red',
    span('color: #FFFFFF; background-color: #E03E2D', 'White on red'),
  ),
  sample(
    'white on navy',
    span('color: #FFFFFF; background-color: #34495E', 'White on navy'),
  ),
  `<h2 data-sample="colored heading" style="color: #236FA1">A heading</h2>`,
  `<table border="1"><tbody>
    <tr style="background-color: #CED4D9">
      <th data-sample="grey header row">Week</th>
      <th data-sample="blue header cell" style="background-color: #C2E0F4">Topic</th>
    </tr>
    <tr>
      <td data-sample="yellow cell" style="background-color: #FBEEB8">1</td>
      <td data-sample="dark cell" style="background-color: #34495E; color: #ECF0F1">2</td>
    </tr>
  </tbody></table>`,
  `<div style="background-color: #fff3cd; padding: 8px">
    <p data-sample="warning box">The quiz closes Friday.</p>
  </div>`,
  `<div style="background-color: #d1ecf1; color: #0c5460; padding: 8px">
    <p data-sample="info box">Office hours moved.</p>
  </div>`,
];

// a course page as Canvas renders it: the teacher's HTML in .user_content
const PAGE = `<!doctype html><meta charset="utf-8"><title>Colors</title>
<body><div class="show-content user_content">${SAMPLES.join('\n')}</div></body>`;

interface Measured {
  ratio: number;
  background: string;
}

// Each sample's contrast against what's actually behind its text: the first
// opaque background among its ancestors, with translucent ones composited.
function measure(page: Page): Promise<Record<string, Measured>> {
  return page.evaluate(() => {
    // computed colors may be oklch(); a canvas turns any of them into sRGB
    const context = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true });
    const rgba = (css: string) => {
      if (!context) throw new Error('no canvas');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      return { r, g, b, a: a / 255 };
    };
    type Rgb = { r: number; g: number; b: number };
    const luminance = ({ r, g, b }: Rgb) => {
      const lin = (c: number) =>
        (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const behind = (el: Element): Rgb => {
      const layers = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color.a === 0) continue;
        layers.push(color);
        if (color.a === 1) break;
      }
      return layers.reverse().reduce<Rgb>(
        (under, { r, g, b, a }) => ({
          r: r * a + under.r * (1 - a),
          g: g * a + under.g * (1 - a),
          b: b * a + under.b * (1 - a),
        }),
        { r: 255, g: 255, b: 255 },
      );
    };
    const hex = ({ r, g, b }: Rgb) =>
      `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

    const results: Record<string, { ratio: number; background: string }> = {};
    for (const el of document.querySelectorAll('[data-sample]')) {
      let text = el;
      while (text.firstElementChild) text = text.firstElementChild;
      const background = behind(text);
      const [light, dark] = [
        luminance(rgba(getComputedStyle(text).color)),
        luminance(background),
      ].sort((a, b) => b - a);
      results[el.getAttribute('data-sample') ?? ''] = {
        ratio:
          Math.round((((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)) * 100) /
          100,
        background: hex(background),
      };
    }
    return results;
  });
}

test('course content reads in every editor color', async ({
  page,
  setTheme,
}) => {
  await page.route(URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGE }),
  );
  await setTheme(false);
  await page.goto(URL);
  const off = await measure(page);

  await setTheme(true);
  // tagged in the frame after the theme comes on
  await expect(
    page.locator('p[data-sample] span[data-cpp-fg]').first(),
  ).toBeAttached();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const on = await measure(page);
  const pageColor = on['plain text']?.background;

  for (const [label, { ratio }] of Object.entries(on)) {
    expect
      .soft(ratio, `${label}: ${String(off[label]?.ratio)} with the theme off`)
      .toBeGreaterThanOrEqual(Math.min(4.5, off[label]?.ratio ?? 0));
  }
  // a highlight stays visible as a highlight: dark, but not the page's color
  for (const label of ['Light Yellow highlight', 'Red highlight']) {
    expect.soft(on[label]?.background, label).not.toBe(pageColor);
  }

  await setTheme(false);
  await expect(page.locator('html')).not.toHaveAttribute('data-cpp-theme');
  expect(await measure(page)).toEqual(off);
});
