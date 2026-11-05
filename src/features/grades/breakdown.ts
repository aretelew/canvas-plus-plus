// What the grade breakdown in the grades page's sidebar (sidebar.ts) shows,
// read from what Canvas already worked out. Canvas computes every group's
// grade and the total in the page, with drop rules, excused work and What-If
// scores, so nothing here computes a grade: it only reads Canvas's and
// relates them to the weights and the grading scheme.

import { textOf } from '@/core/text';

/** An assignment group (or, across weighted grading periods, a period). */
export interface Group {
  name: string;
  /** Canvas's grade for it, when it has one (Canvas writes "N/A") */
  percent?: number;
  /** points earned of points possible ("29 / 32"), when there are any */
  points?: string;
  /** its weight in percent, in a weighted course */
  weight?: number;
}

/** A grading scheme's letter and its lowest score, as a fraction. */
export interface Cutoff {
  name: string;
  value: number;
}

/** How the total sits in the grading scheme. */
export interface Standing {
  /** the letter the total earns */
  letter: string;
  /** the next letter up, and how many points of percent it's away */
  next?: { letter: string; gap: number };
}

/**
 * A percentage as Canvas writes it ("89.67%", "89,67 %", "100%"); undefined
 * for anything else ("N/A", "-", "").
 */
export function parsePercent(text: string): number | undefined {
  const number = /^\s*(-?\d+(?:[.,]\d+)?)\s*%\s*$/.exec(text)?.[1];
  return number === undefined ? undefined : Number(number.replace(',', '.'));
}

/** Canvas's "29.00 / 32.00" as "29 / 32"; undefined when nothing's possible. */
export function tidyPoints(text: string): string | undefined {
  const points = text.trim().replace(/\s+/g, ' ');
  const possible = /\/\s*(\S+)$/.exec(points)?.[1];
  if (!possible || Number(possible.replace(',', '.')) === 0) return undefined;
  return points.replace(/[.,]0+(?!\d)/g, '');
}

/**
 * The groups at the foot of Canvas's grades table (`tr.group_total`), with
 * their weights from the sidebar's table of them (`weights`: name to
 * percent), which Canvas shows only when the course is weighted.
 */
export function readGroups(
  table: Element,
  weights: Map<string, number>,
): Group[] {
  return [...table.querySelectorAll('tr.group_total')].map((row) => {
    const name = textOf(row.querySelector('.title'));
    return {
      name,
      percent: parsePercent(
        textOf(row.querySelector('.assignment_score .grade')),
      ),
      points: tidyPoints(
        textOf(row.querySelector('.details .points_possible')),
      ),
      weight: weights.get(name),
    };
  });
}

/** Group name to weight, from Canvas's sidebar table of them. */
export function readWeights(summary: Element | null): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of summary?.querySelectorAll('tbody tr') ?? []) {
    const weight = parsePercent(textOf(row.querySelector('td')));
    const name = textOf(row.querySelector('th'));
    if (weight !== undefined && !weights.has(name)) weights.set(name, weight);
  }
  return weights;
}

/**
 * The groups worth listing: graded ones, and in a weighted course ungraded
 * ones that will count. A group worth nothing with nothing graded in it
 * (Canvas's empty "Imported Assignments") is left out.
 */
export function shownGroups(groups: Group[]): Group[] {
  return groups.filter((g) => g.percent !== undefined || (g.weight ?? 0) > 0);
}

/**
 * How much of a weighted course's grade the total is based on, while Canvas
 * counts only graded work and some weighted groups have none: 60 when the
 * final exam's 40% isn't graded yet. Undefined when it's all of it.
 */
export function countedShare(groups: Group[]): number | undefined {
  const weighted = groups.filter((g) => (g.weight ?? 0) > 0);
  const all = weighted.reduce((sum, g) => sum + (g.weight ?? 0), 0);
  const counted = weighted
    .filter((g) => g.percent !== undefined)
    .reduce((sum, g) => sum + (g.weight ?? 0), 0);
  if (!all || counted === all) return undefined;
  return (counted / all) * 100;
}

/**
 * The course's grading scheme, from the `ENV` Canvas writes into the page's
 * script (`course_active_grading_scheme`), highest letter first; undefined
 * for a scheme in points, or none.
 */
export function readScheme(script: string): Cutoff[] | undefined {
  const at = script.indexOf('"course_active_grading_scheme":{');
  if (at < 0) return undefined;
  // the scheme's object ends with its data array, which holds only objects
  const scheme = /^[^]*?"data":(\[[^\]]*\])/.exec(script.slice(at))?.[0];
  if (!scheme || scheme.includes('"points_based":true')) return undefined;
  try {
    const data: unknown = JSON.parse(
      scheme.slice(scheme.indexOf('"data":') + 7),
    );
    if (!Array.isArray(data)) return undefined;
    const cutoffs = data.filter(
      (c): c is Cutoff =>
        typeof (c as Cutoff).name === 'string' &&
        typeof (c as Cutoff).value === 'number',
    );
    return cutoffs.length
      ? cutoffs.sort((a, b) => b.value - a.value)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The letter a total earns in the scheme, by Canvas's rule (the first
 * letter whose cutoff, to four significant digits, it reaches), and how far
 * the next one up is.
 */
export function standing(
  percent: number,
  scheme: Cutoff[],
): Standing | undefined {
  const cutoff = (c: Cutoff) => Number((c.value * 100).toPrecision(4));
  const at = scheme.findIndex(
    (c, i) => percent >= cutoff(c) || i === scheme.length - 1,
  );
  const earned = scheme[at];
  if (!earned) return undefined;
  const up = scheme[at - 1];
  return {
    letter: earned.name,
    next: up && { letter: up.name, gap: round(cutoff(up) - percent) },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
