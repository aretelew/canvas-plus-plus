import { describe, expect, it } from 'vitest';
import {
  darkenGradient,
  recolorRing,
  roleOf,
  shadowKind,
  toRgb,
} from './palette';

describe('toRgb', () => {
  it.each([
    ['#003071', 'rgb(0, 48, 113)'],
    [' #fff ', 'rgb(255, 255, 255)'],
    ['rgb(1, 2, 3)', 'rgb(1, 2, 3)'],
    ['', ''],
    ['navy', ''],
  ])('%j -> %j', (css, rgb) => {
    expect(toRgb(css)).toBe(rgb);
  });
});

// Colors measured on real Canvas pages
describe('roleOf', () => {
  it.each([
    ['rgb(255, 255, 255)', 'surface'],
    ['rgba(255, 255, 255, 0.95)', 'surface'],
    ['rgb(242, 244, 244)', 'surface'],
    ['rgb(224, 235, 245)', 'surface'],
  ])('background %s is %s', (css, role) => {
    expect(roleOf('bg', css)).toBe(role);
  });

  it.each([
    ['rgb(0, 0, 0)', 'text'],
    ['rgb(39, 53, 64)', 'text'],
    ['rgb(61, 69, 76)', 'text'],
    ['rgb(71, 71, 71)', 'muted'],
    ['rgb(88, 104, 116)', 'muted'],
    ['rgb(136, 136, 136)', 'muted'],
  ])('text %s is %s', (css, role) => {
    expect(roleOf('fg', css)).toBe(role);
  });

  it.each([
    ['rgb(232, 234, 236)', 'border'],
    ['rgb(204, 204, 204)', 'border'],
    ['rgb(141, 149, 159)', 'border-strong'],
    ['rgb(106, 120, 131)', 'border-strong'],
    ['rgb(255, 255, 255)', 'hidden'],
    ['rgb(0, 0, 0)', 'emphasis'], // selected radio button
    ['rgb(39, 53, 64)', null], // dark text grey used as a border: left alone
  ])('border %s is %s', (css, role) => {
    expect(roleOf('border', css)).toBe(role);
  });

  it("maps the school's link color in text to link", () => {
    expect(roleOf('fg', 'rgb(0, 48, 113)', 'rgb(0, 48, 113)')).toBe('link');
  });

  it.each([
    ['rgb(212, 30, 0)'], // course red
    ['rgb(0, 132, 0)'], // course green
    ['rgb(225, 24, 92)'], // course pink
  ])('lifts dark colored text %s', (css) => {
    expect(roleOf('fg', css)).toBe('lift');
  });

  it.each([
    ['bg', 'rgb(0, 48, 113)'], // brand navy (nav, primary buttons)
    ['bg', 'rgb(0, 132, 0)'], // course card green
    ['bg', 'rgb(212, 30, 0)'], // course card red
    ['bg', 'rgb(39, 53, 64)'], // tooltip: already dark
    ['bg', 'rgba(0, 0, 0, 0)'], // transparent
    ['fg', 'rgb(255, 255, 255)'], // white text on dark/brand
    ['fg', 'rgb(138, 180, 255)'], // light colored text already reads on dark
  ] as const)('leaves %s %s alone', (channel, css) => {
    expect(roleOf(channel, css)).toBeNull();
  });
});

// Shadows measured on real Canvas pages
describe('shadowKind', () => {
  it.each([
    ['rgba(0, 0, 0, 0.3) 0px 2px 5px 0px', 'drop'], // dashboard card
    ['rgb(255, 255, 255) 0px 1px 0px 0px', 'emboss'], // ul.pill
    ['rgba(255, 255, 255, 0.5) 1px 1px 0px', 'emboss'], // module header text
    ['rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset', null], // inset outline
    ['rgba(0, 0, 0, 0.2) 0px 1px 0px 0px', null], // hard line, no blur
    ['none', null],
  ])('%s is %s', (css, kind) => {
    expect(shadowKind(css)).toBe(kind);
  });
});

describe('darkenGradient', () => {
  it('turns a fade-to-white into a fade-to-page', () => {
    // Recent Feedback items, .event-details::after
    expect(
      darkenGradient(
        'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgb(255, 255, 255) 80%)',
        'var(--cpp-bg)',
      ),
    ).toBe(
      'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, var(--cpp-bg) 80%)',
    );
  });

  it.each([
    'none',
    'url("hero.png")',
    'linear-gradient(rgb(0, 48, 113), rgb(0, 132, 0))', // real colors
    'linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5))', // dark scrim
  ])('leaves %s alone', (css) => {
    expect(darkenGradient(css, 'var(--cpp-bg)')).toBeNull();
  });
});

describe('recolorRing', () => {
  it('recolors a solid near-black ring, keeping its shape', () => {
    // selected radio button in New Quizzes
    expect(
      recolorRing('rgb(0, 0, 0) 0px 0px 0px 4px inset', 'var(--cpp-emphasis)'),
    ).toBe('var(--cpp-emphasis) 0px 0px 0px 4px inset');
  });

  it.each([
    'none',
    'rgba(0, 0, 0, 0.3) 0px 2px 5px 0px', // drop shadow (blurred)
    'rgb(255, 255, 255) 0px 1px 0px 0px', // emboss (light)
    'rgb(0, 48, 113) 0px 0px 0px 2px', // brand-colored focus ring
  ])('leaves %s alone', (css) => {
    expect(recolorRing(css, 'var(--cpp-emphasis)')).toBeNull();
  });
});
