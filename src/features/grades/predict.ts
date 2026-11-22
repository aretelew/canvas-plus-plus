// Predictions in the grade breakdown (sidebar.ts): a grade the student types
// for any group, what the total would come to with it, and what the one group
// still ungraded (a final exam, often) needs for each letter. Canvas still
// works out every group's own grade, with drop rules, excused work and its
// What-If scores; this only adds the groups up the way Canvas does. In a
// weighted course that's each group's grade by its weight, scaled up while
// the weights that count add up to less than 100; otherwise it's points
// earned over points possible. It's trusted only where, with nothing
// predicted, it comes to Canvas's own total (`agrees`).

import { cutoff, type Cutoff, type Group } from './breakdown';

/** Group name to the percent the student predicts for it. */
export type Predictions = ReadonlyMap<string, number>;

/** What a group needs for a letter. */
export interface Need {
  letter: string;
  percent: number;
}

/** Whether the course weights its groups, by the weights Canvas shows. */
export function isWeighted(groups: Group[]): boolean {
  return groups.some((g) => g.weight !== undefined);
}

/**
 * The total the graded groups come to, as Canvas adds them up; undefined
 * when none counts.
 */
export function totalOf(groups: Group[]): number | undefined {
  const weighted = isWeighted(groups);
  let sum = 0;
  let of = 0;
  for (const group of groups) {
    const share = weighted ? group.weight : group.possible;
    if (group.percent === undefined || share === undefined) continue;
    sum += group.percent * share;
    of += share;
  }
  if (!of) return undefined;
  // weights over 100 aren't scaled down: the extra is extra credit
  return sum / (weighted ? Math.min(of, 100) : of);
}

/** Whether the groups add up, within Canvas's rounding, to its total. */
export function agrees(groups: Group[], total: number): boolean {
  const ours = totalOf(groups);
  return ours !== undefined && Math.abs(ours - total) < 0.05;
}

/**
 * Whether a prediction for the group would move the total: it has a weight,
 * or in an unweighted course, points possible.
 */
export function predictable(group: Group, weighted: boolean): boolean {
  return ((weighted ? group.weight : group.possible) ?? 0) > 0;
}

/** The groups with the predicted grades in place of Canvas's. */
export function withPredictions(
  groups: Group[],
  predictions: Predictions,
): Group[] {
  return groups.map((group) => {
    const percent = predictions.get(group.name);
    return percent === undefined ? group : { ...group, percent };
  });
}

/**
 * What the named group needs for each letter it decides, best first, at most
 * `limit` of them: the letters it can reach at 100% that the total doesn't
 * already have at 0%. Rounded up, so the grade reaches the letter.
 */
export function needs(
  groups: Group[],
  name: string,
  scheme: Cutoff[],
  limit = 3,
): Need[] {
  const at = (percent: number) =>
    totalOf(groups.map((g) => (g.name === name ? { ...g, percent } : g)));
  const low = at(0);
  const high = at(100);
  if (low === undefined || high === undefined || high <= low) return [];
  const found: Need[] = [];
  for (const letter of scheme) {
    const target = cutoff(letter);
    if (target <= low || found.length === limit) break;
    if (target > high) continue;
    found.push({
      letter: letter.name,
      percent: roundUp(((target - low) * 100) / (high - low)),
    });
  }
  return found;
}

// to two decimals, up, past floating point's noise
const roundUp = (n: number) => Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
