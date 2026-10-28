import {
  darkenGradient,
  liftsOn,
  recolorRing,
  roleOf,
  shadowKind,
  tints,
  toRgb,
  type Role,
} from './palette';

// Tags each element with the roles of its colors as data-cpp-* attributes
// (plus a few custom properties carrying original colors); theme.css maps them
// to theme tokens while a theme is on. Tags are inert when the theme is off, so
// turning it off needs no cleanup, and turning it on again only has to tag what
// was added meanwhile.
//
// New elements are queued as they appear and tagged in one batch per frame,
// from requestAnimationFrame: that runs before the frame paints (so nothing
// flashes light) and after the stylesheets it needs have loaded (so computed
// colors are Canvas's real ones).
//
// Colors that only exist in a state (a row that turns light blue on hover) are
// invisible at that point, so each element is probed again the first time it's
// hovered or focused, before that frame paints.
//
// Canvas also recolors by moving a class (the global nav's white "active"
// highlight follows the clicked item), so an element whose class changes is
// forgotten, with its insides if it's a small component, and tagged again like
// a new one.

// Light backgrounds inside these keep a lighter shade so controls stay visible;
// everything else light goes flat (page color), or card color if Canvas lifts
// it with a drop shadow.
const CONTROLS = [
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '.btn',
  '.Button',
  '[class*="-textInput__facade"]',
  '[class*="-select__"]',
  '[class*="-checkboxFacade"]',
].join(',');

// Shadowed like cards, but callouts in the page flow rather than floating.
const IN_FLOW = '[class*="-view-alert"], [role="alert"]';

// What teachers write (pages, assignments, announcements, discussions, quiz
// questions, the syllabus): their highlights and colored cells, too light for
// the theme's text, are darkened to a shade of their color.
const CONTENT = '.user_content';

type Background = 'page' | 'elevated' | 'control';

let observer: MutationObserver | undefined;
let queue: Element[] = [];
let brand = '';
// Canvas's own background for every element tagged so far, to tell a state
// color from the resting one. Each is tagged once (until forgotten):
// afterwards its computed colors are ours, not Canvas's.
const resting = new WeakMap<Element, string>();
const probed = {
  mouseover: new WeakSet<Element>(),
  focusin: new WeakSet<Element>(),
};

export function startRecolor(): void {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const { type, target, addedNodes } of records) {
      if (type === 'attributes' && target instanceof Element) {
        forget(target);
        enqueue(target);
      }
      for (const node of addedNodes) {
        if (node instanceof Element) enqueue(node);
      }
    }
  });
  // the document, not <html>: document.open() replaces <html>
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributeFilter: ['class'],
  });
  enqueue(document.documentElement);
  for (const type of ['mouseover', 'focusin']) {
    document.addEventListener(type, probeStates, {
      capture: true,
      passive: true,
    });
  }
}

export function stopRecolor(): void {
  observer?.disconnect();
  observer = undefined;
  queue = [];
  for (const type of ['mouseover', 'focusin']) {
    document.removeEventListener(type, probeStates, { capture: true });
  }
}

function enqueue(el: Element): void {
  if (queue.push(el) === 1) requestAnimationFrame(flush);
}

// el is tagged from scratch on the next flush, and so is everything inside it
// if it's a small component. Big containers change classes all the time that
// don't recolor their insides (body's "webkit chrome", each module's
// "completed" while Modules loads), and tagging those again costs a lot.
function forget(el: Element): void {
  const inside = isSmallComponent(el) ? [...el.querySelectorAll('*')] : [];
  for (const inner of [el, ...inside]) {
    resting.delete(inner);
    probed.mouseover.delete(inner);
    probed.focusin.delete(inner);
  }
}

interface Tags {
  attrs: Record<string, string>;
  vars: Record<string, string>; // custom properties on the element
}

function flush(): void {
  const roots = queue;
  queue = [];
  if (!observer) return;
  // Canvas also uses its brand color for link and heading text
  brand ||= toRgb(
    getComputedStyle(document.documentElement).getPropertyValue(
      '--ic-brand-primary',
    ),
  );
  const elements = new Set<Element>();
  for (const root of roots) {
    if (!root.isConnected) continue;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (!resting.has(el)) elements.add(el);
    }
  }
  // Old tags off (on forgotten elements), then all reads, then all writes:
  // interleaving them would force a style recalculation per element, and every
  // read sees Canvas's original colors. Transitions stay off throughout, or
  // taking a tag off would start a fade to Canvas's light color.
  withoutTransitions([...elements], () => {
    for (const el of elements) untag(el);
    const tagged = [...elements].map((el) => [el, classify(el)] as const);
    for (const [el, tags] of tagged) apply(el, tags);
  });
}

function classify(el: Element): Tags {
  const style = getComputedStyle(el);
  resting.set(el, style.backgroundColor);
  const attrs: Record<string, string> = {};
  const vars: Record<string, string> = {};

  const borderColor = visibleBorderColor(style);
  const border = borderColor ? roleOf('border', borderColor) : null;
  if (border) attrs['data-cpp-border'] = border;

  if (roleOf('bg', style.backgroundColor)) {
    attrs['data-cpp-bg'] = background(el, style, border);
  } else if (tints(style.backgroundColor) && el.closest(CONTENT)) {
    attrs['data-cpp-bg'] = 'tint';
    vars['--cpp-tint'] = style.backgroundColor;
  }
  const fg = roleOf('fg', style.color, brand);
  if (fg === 'lift') {
    if (onDarkenedBackdrop(el)) {
      attrs['data-cpp-fg'] = 'lift';
      vars['--cpp-fg'] = style.color;
    }
  } else if (fg) {
    attrs['data-cpp-fg'] = fg;
  }
  if (el instanceof SVGElement && onDarkenedBackdrop(el)) {
    // lines drawn for a white page (spinner tracks, progress rings)
    if (roleOf('bg', style.stroke)) attrs['data-cpp-stroke'] = '';
    // icons filled with Canvas's text greys; currentColor ones (same as
    // color) already follow the fg tag, and must keep following it on hover
    const fill = style.fill === style.color ? null : roleOf('fg', style.fill);
    if (fill === 'text' || fill === 'muted') attrs['data-cpp-fill'] = fill;
  }

  // fades made to melt into white, on the element or its ::before/::after
  const gradients = (
    [
      ['self', style],
      ['before', getComputedStyle(el, '::before')],
      ['after', getComputedStyle(el, '::after')],
    ] as const
  ).flatMap(([layer, layerStyle]) => {
    const gradient = darkenGradient(
      layerStyle.backgroundImage,
      'var(--cpp-surface, var(--cpp-bg))',
    );
    if (gradient) vars[`--cpp-${layer}-gradient`] = gradient;
    return gradient ? [layer] : [];
  });
  if (gradients.length) attrs['data-cpp-gradient'] = gradients.join(' ');

  const emboss = [
    shadowKind(style.boxShadow) === 'emboss' ? ['box'] : [],
    shadowKind(style.textShadow) === 'emboss' ? ['text'] : [],
  ].flat();
  if (emboss.length) attrs['data-cpp-emboss'] = emboss.join(' ');

  // solid black rings drawn with box-shadow (selected radio buttons)
  const ring = recolorRing(style.boxShadow, 'var(--cpp-emphasis)');
  if (ring) {
    attrs['data-cpp-ring'] = '';
    vars['--cpp-ring'] = ring;
  }

  return { attrs, vars };
}

function background(
  el: Element,
  style: CSSStyleDeclaration,
  border: Role | null,
): Background {
  // a control only stands out where Canvas made it: with a visible border, or
  // a shade other than what's behind it (not a white arrow on a white toolbar)
  if (inControl(el)) {
    return (border && border !== 'hidden') ||
      style.backgroundColor !== backdrop(el)
      ? 'control'
      : 'page';
  }
  return shadowKind(style.boxShadow) === 'drop' && !el.matches(IN_FLOW)
    ? 'elevated'
    : 'page';
}

// Every data-cpp-* attribute is a tag of ours, except the switch on <html>
// that turns the theme on (page.ts).
function untag(el: Element): void {
  for (const { name } of [...el.attributes]) {
    if (name.startsWith('data-cpp-') && name !== 'data-cpp-theme') {
      el.removeAttribute(name);
    }
  }
  // and the custom properties classify() set (original colors)
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    for (const name of [...el.style]) {
      if (name.startsWith('--cpp-')) el.style.removeProperty(name);
    }
  }
}

// a button, a nav item, a list row: styles keyed to its state or class reach
// inside it (`button:hover > span`, `.active a`)
function isSmallComponent(el: Element): boolean {
  return el.getElementsByTagName('*').length <= 50;
}

function inControl(el: Element): boolean {
  return el.closest(CONTROLS) !== null;
}

function apply(el: Element, { attrs, vars }: Tags): void {
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    for (const [name, value] of Object.entries(vars)) {
      el.style.setProperty(name, value);
    }
  }
}

// Hover and focus apply to the target and all its ancestors, so walk up and
// look at Canvas's color for each in this state; light ones get a state tag.
// Hover styles also reach into small components (`button:hover > span`), so
// their insides are checked too, with the hovered element as the owner whose
// state turns them on.
//
// Elements not tagged yet are skipped (a dialog that focuses its button as it
// opens): their color now is their resting one, which flush() is about to
// read. Inner elements aren't marked as probed either: they're only in the
// state while their owner is, so each new owner looks at them again until one
// finds a state.
function probeStates(event: Event): void {
  const seenFor = probed[event.type as keyof typeof probed];
  // element -> owner; the innermost owner wins
  const candidates = new Map<HTMLElement, Element>();
  const consider = (el: Element, owner: Element) => {
    if (
      el instanceof HTMLElement &&
      resting.has(el) &&
      !el.hasAttribute('data-cpp-state') &&
      !candidates.has(el)
    ) {
      candidates.set(el, owner);
    }
  };
  for (
    let el = event.target instanceof Element ? event.target : null;
    el && el !== document.body;
    el = el.parentElement
  ) {
    if (seenFor.has(el) || !resting.has(el)) continue;
    seenFor.add(el);
    consider(el, el);
    if (isSmallComponent(el)) {
      for (const inner of el.querySelectorAll('*')) consider(inner, el);
    }
  }
  if (!candidates.size) return;

  // Transitions stay off until the state tags are on: looking commits
  // Canvas's color, which the state tag then replaces.
  const elements = [...candidates.keys()];
  withoutTransitions(elements, () => {
    const now = canvasBackgrounds(elements);
    elements.forEach((el, i) => {
      const background = now[i] ?? '';
      if (!roleOf('bg', background) || background === resting.get(el)) return;
      el.setAttribute('data-cpp-state', inControl(el) ? 'control' : 'row');
      const owner = candidates.get(el);
      if (owner !== el) owner?.setAttribute('data-cpp-state-owner', '');
    });
  });
}

// Canvas's backgrounds for the elements' current state, without our tags, read
// in one pass. Transitions must be off, or this reports colors partway through
// a fade.
function canvasBackgrounds(elements: HTMLElement[]): string[] {
  const tags = elements.map((el) => el.getAttribute('data-cpp-bg'));
  for (const el of elements) el.removeAttribute('data-cpp-bg');
  const backgrounds = elements.map(
    (el) => getComputedStyle(el).backgroundColor,
  );
  elements.forEach((el, i) => {
    const tag = tags[i];
    if (tag) el.setAttribute('data-cpp-bg', tag);
  });
  return backgrounds;
}

// Changes our tags without Canvas's transitions animating the change: an
// element that fades its background would otherwise fade from Canvas's light
// color to ours (a white flash) whenever it's tagged or probed. The result is
// committed before the transitions come back, or they would still start from
// the last style the browser computed.
function withoutTransitions(elements: Element[], change: () => void): void {
  const animated = elements.flatMap((el) =>
    (el instanceof HTMLElement || el instanceof SVGElement) &&
    getComputedStyle(el)
      .transitionDuration.split(',')
      .some((duration) => parseFloat(duration) > 0)
      ? [{ el, transition: el.style.transition }]
      : [],
  );
  for (const { el } of animated) el.style.transition = 'none';
  change();
  // all commits, then all restores: one style recalculation, not one each
  for (const { el } of animated) {
    void getComputedStyle(el).getPropertyValue('transition');
  }
  for (const { el, transition } of animated) el.style.transition = transition;
}

// The color of the first side that actually draws a border. Sides without one
// still report a color (the text color, by default), which says nothing.
function visibleBorderColor(style: CSSStyleDeclaration): string | null {
  for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    const lineStyle = style[`border${side}Style`];
    if (
      parseFloat(style[`border${side}Width`]) > 0 &&
      lineStyle !== 'none' &&
      lineStyle !== 'hidden'
    ) {
      return style[`border${side}Color`];
    }
  }
  return null;
}

// Canvas's own background behind el: the first opaque one among its
// ancestors, or the white page if none.
function backdrop(el: Element): string {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const color = resting.get(node) ?? getComputedStyle(node).backgroundColor;
    if (liftsOn(color) !== undefined) return color;
  }
  return 'rgb(255, 255, 255)';
}

// Whether el sits on a background the theme darkens (its own or what's behind
// it): a neutral one, or in course content any that tints. Colored ones in
// Canvas's own UI (badges) aren't.
function onDarkenedBackdrop(el: Element): boolean {
  const content = el.closest(CONTENT) !== null;
  return (
    liftsOn(getComputedStyle(el).backgroundColor, content) ??
    liftsOn(backdrop(el), content) !== false
  );
}
