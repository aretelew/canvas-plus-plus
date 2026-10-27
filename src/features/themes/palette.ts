// Canvas paints almost everything from a small neutral palette: white and
// near-white surfaces, a ladder of near-black text greys, light grey borders.
// Classifying a computed color into one of those roles lets the theme recolor
// any Canvas UI (legacy or InstUI, whose class names don't say which color
// they use) while leaving meaningful colors (course colors, status red and
// green, brand) alone: anything saturated has no role, except dark saturated
// text, which keeps its hue but is lifted to stay readable on dark surfaces.

// For backgrounds the color only says "light neutral" ('surface'); whether it
// becomes page, card or control color depends on the element (recolor.ts).
export type Role =
  | 'surface'
  | 'text'
  | 'muted'
  | 'link'
  | 'lift'
  | 'border'
  | 'border-strong'
  | 'hidden'
  | 'emphasis';

export type Channel = 'bg' | 'fg' | 'border';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parse(css: string): Rgba | null {
  const [r, g, b, a = 1] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return r === undefined || g === undefined || b === undefined
    ? null
    : { r, g, b, a };
}

/**
 * A CSS color as getComputedStyle reports it ("rgb(0, 48, 113)"), for
 * comparing a variable's value (usually hex) with computed colors.
 * Returns '' for anything it can't read.
 */
export function toRgb(css: string): string {
  const value = css.trim();
  if (value.startsWith('rgb')) return value;
  let hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)?.[1];
  if (!hex) return '';
  if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

// WCAG relative luminance, 0 (black) to 1 (white)
function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) =>
    (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Canvas's greys carry a slight blue tint (#273540, #586874); real colors
// start well above this.
const isNeutral = ({ r, g, b }: Rgba) =>
  Math.max(r, g, b) - Math.min(r, g, b) <= 32;

/**
 * The role a computed color plays, or null to leave it alone.
 * `brand` is the school's brand color, which Canvas also uses for link text.
 */
export function roleOf(
  channel: Channel,
  css: string,
  brand?: string,
): Role | null {
  const color = parse(css);
  if (!color || color.a < 0.5) return null;
  if (channel === 'fg' && brand && css === brand) return 'link';
  const l = luminance(color);
  if (!isNeutral(color)) return channel === 'fg' && l < 0.2 ? 'lift' : null;

  switch (channel) {
    case 'bg':
      return l >= 0.7 ? 'surface' : null;
    case 'fg':
      return l < 0.06 ? 'text' : l < 0.35 ? 'muted' : null;
    case 'border':
      // black is Canvas's strongest mark (selected radio, focus); on dark the
      // strongest mark is light
      if (l < NEAR_BLACK) return 'emphasis';
      // white borders are invisible separators on white; keep them invisible
      return band(l, [
        [0.95, 'hidden'],
        [0.5, 'border'],
        [0.12, 'border-strong'],
      ]);
  }
}

// #262626 and darker; Canvas's dark text greys (#273540, ...) stay out
const NEAR_BLACK = 0.025;

/**
 * Whether lifted text may sit on this background: an opaque neutral one, which
 * the theme darkens. Colored ones (highlights, badges) keep dark text.
 * Returns undefined for transparent backgrounds, which don't decide.
 */
export function liftsOn(background: string): boolean | undefined {
  const color = parse(background);
  if (!color || color.a < 0.5) return undefined;
  return isNeutral(color);
}

/**
 * What a computed box-shadow or text-shadow is for. `drop`: a dark, blurred
 * shadow that lifts an element (cards, menus), shown on dark as a lighter
 * surface. `emboss`: light shadows that fake an engraved edge on light grey,
 * which on dark look like a ghost copy of the text or a stray line.
 */
export function shadowKind(css: string): 'drop' | 'emboss' | null {
  if (css === 'none') return null;
  const shadows = parseShadows(css);
  const light = ({ color }: (typeof shadows)[number]) =>
    !!color && color.a > 0 && luminance(color) > 0.5;
  if (shadows.every(light)) return 'emboss';
  return shadows.some((s) => !s.inset && !light(s) && s.blur > 0)
    ? 'drop'
    : null;
}

/**
 * A box-shadow used as a solid near-black ring (no blur, like the thick ring
 * on a selected radio button) with its color replaced by `to`, keeping the
 * ring's geometry. Null for any other shadow.
 */
export function recolorRing(css: string, to: string): string | null {
  if (css === 'none') return null;
  const solidBlack = parseShadows(css).every(
    ({ color, blur }) =>
      !!color &&
      color.a >= 0.5 &&
      blur === 0 &&
      isNeutral(color) &&
      luminance(color) < NEAR_BLACK,
  );
  return solidBlack ? css.replace(/rgba?\([^)]*\)/g, to) : null;
}

// computed form: "<color> <x> <y> <blur> [<spread>] [inset]", comma-separated
function parseShadows(css: string) {
  return css.split(/,(?![^(]*\))/).map((shadow) => ({
    color: parse(/^\s*(rgba?\([^)]*\))/.exec(shadow)?.[1] ?? ''),
    blur: parseFloat(shadow.split('px')[2] ?? '0'),
    inset: shadow.includes('inset'),
  }));
}

/**
 * A gradient built from light neutrals (fades made to melt into a white
 * page) with those colors replaced by `to`, so it melts into the theme's page
 * instead. Null for anything else, including gradients with real colors.
 */
export function darkenGradient(css: string, to: string): string | null {
  if (!css.includes('gradient(')) return null;
  const colors = (css.match(/rgba?\([^)]*\)/g) ?? []).map((c) => ({
    css: c,
    rgba: parse(c),
  }));
  const light = (c: Rgba) => c.a > 0 && isNeutral(c) && luminance(c) >= 0.7;
  const meaningful = colors.some(
    ({ rgba }) => rgba && rgba.a > 0 && !isNeutral(rgba),
  );
  if (meaningful || !colors.some(({ rgba }) => rgba && light(rgba))) {
    return null;
  }
  return css.replace(/rgba?\([^)]*\)/g, (c) => {
    const rgba = parse(c);
    return rgba && light(rgba) ? to : c;
  });
}

// The role of the first band (brightest first) whose minimum l reaches.
function band(l: number, bands: [number, Role][]): Role | null {
  return bands.find(([min]) => l >= min)?.[1] ?? null;
}
