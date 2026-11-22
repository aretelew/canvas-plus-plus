// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  countedShare,
  finalsLast,
  hasScheme,
  isFinal,
  isDefaultScheme,
  parsePercent,
  possibleOf,
  readGroups,
  readScheme,
  readWeights,
  shownGroups,
  standing,
  tidyPoints,
  type Group,
} from './breakdown';

// a group's total row at the foot of Canvas's grades table, as its scripts
// leave it
const groupRow = (name: string, grade: string, points: string) => `
  <tr class="student_assignment hard_coded group_total" id="submission_group-1">
    <th class="title" scope="row">
      ${name}
    </th>
    <td class="due"></td>
    <td class="assignment_score">
      <div class="score_holder">
        <span class="tooltip"><span class="grade">${grade}</span></span>
        <div style="display: none;"><span class="group_weight">10.0</span></div>
      </div>
    </td>
    <td class="details">
      <span class="possible points_possible">${points}</span>
    </td>
  </tr>`;

function table(rows: string): Element {
  const element = document.createElement('table');
  element.id = 'grades_summary';
  element.innerHTML = `<tbody>
    <tr class="student_assignment editable"><th class="title">Lab 1</th>
      <td class="assignment_score"><span class="grade">5</span></td></tr>
    ${rows}
    <tr class="student_assignment hard_coded final_grade"><th class="title">Total</th>
      <td class="assignment_score"><span class="grade">89.67%</span></td></tr>
  </tbody>`;
  return element;
}

// the sidebar's table of weights, shown only in a weighted course
function weightTable(weights: [string, string][]): Element {
  const element = document.createElement('table');
  element.className = 'summary';
  element.innerHTML = `
    <thead><tr><th scope="col">Group</th><th scope="col">Weight</th></tr></thead>
    <tbody>
      ${weights.map(([name, weight]) => `<tr><th scope="row">${name}</th><td>${weight}</td></tr>`).join('')}
      <tr style="font-weight: bold;"><th scope="row">Total</th><td>100%</td></tr>
    </tbody>`;
  return element;
}

const group = (name: string, percent?: number, weight?: number): Group => ({
  name,
  percent,
  weight,
});

describe('parsePercent', () => {
  it('reads Canvas’s percentages', () => {
    expect(parsePercent('89.67%')).toBe(89.67);
    expect(parsePercent(' 100% ')).toBe(100);
    expect(parsePercent('89,67 %')).toBe(89.67);
    expect(parsePercent('112.5%')).toBe(112.5);
  });

  it('reads nothing else', () => {
    expect(parsePercent('N/A')).toBeUndefined();
    expect(parsePercent('-')).toBeUndefined();
    expect(parsePercent('')).toBeUndefined();
    expect(parsePercent('290 / 320')).toBeUndefined();
  });
});

describe('tidyPoints', () => {
  it('drops the zero decimals', () => {
    expect(tidyPoints('29.00 / 32.00')).toBe('29 / 32');
    expect(tidyPoints(' 66.50 / 76.00 ')).toBe('66.50 / 76');
    expect(tidyPoints('29,00 / 32,00')).toBe('29 / 32');
  });

  it('gives nothing when nothing is possible', () => {
    expect(tidyPoints('0.00 / 0.00')).toBeUndefined();
    expect(tidyPoints('')).toBeUndefined();
  });
});

describe('possibleOf', () => {
  it('reads the points possible', () => {
    expect(possibleOf('29.00 / 32.00')).toBe(32);
    expect(possibleOf('29,50 / 32,50')).toBe(32.5);
    expect(possibleOf('0.00 / 0.00')).toBeUndefined();
    expect(possibleOf('')).toBeUndefined();
  });
});

describe('readGroups', () => {
  it('reads each group’s total with its weight', () => {
    const groups = readGroups(
      table(
        groupRow('Assignments', '90.63%', '29.00 / 32.00') +
          groupRow('Final Exam', 'N/A', '0.00 / 0.00'),
      ),
      readWeights(
        weightTable([
          ['Assignments', '10%'],
          ['Final Exam', '40%'],
        ]),
      ),
    );
    expect(groups).toEqual([
      {
        name: 'Assignments',
        percent: 90.63,
        points: '29 / 32',
        possible: 32,
        weight: 10,
      },
      {
        name: 'Final Exam',
        percent: undefined,
        points: undefined,
        possible: undefined,
        weight: 40,
      },
    ]);
  });

  it('leaves weights out of an unweighted course', () => {
    const [homework] = readGroups(
      table(groupRow('Homework', '100%', '55.00 / 55.00')),
      readWeights(null),
    );
    expect(homework?.weight).toBeUndefined();
  });
});

describe('readWeights', () => {
  it('reads the weights by name, its Total row too', () => {
    expect(
      readWeights(
        weightTable([
          ['Exams', '40%'],
          ['Imported Assignments', '0%'],
        ]),
      ),
    ).toEqual(
      new Map([
        ['Exams', 40],
        ['Imported Assignments', 0],
        ['Total', 100],
      ]),
    );
  });
});

describe('shownGroups', () => {
  it('keeps graded groups and ungraded ones that will count', () => {
    const groups = [
      group('Exams', 86.84, 40),
      group('Final Exam', undefined, 40),
      group('Imported Assignments', undefined, 0),
      group('Extra credit', 100, 0),
      group('Readings'),
    ];
    expect(shownGroups(groups).map((g) => g.name)).toEqual([
      'Exams',
      'Final Exam',
      'Extra credit',
    ]);
  });
});

describe('countedShare', () => {
  it('is the weight of the graded groups', () => {
    expect(
      countedShare([
        group('Assignments', 90, 10),
        group('Participation', 100, 10),
        group('Exams', 86, 40),
        group('Final Exam', undefined, 40),
      ]),
    ).toBe(60);
  });

  it('is out of the weights there are, when they don’t add up to 100', () => {
    expect(
      countedShare([group('Labs', 90, 30), group('Final', undefined, 10)]),
    ).toBe(75);
  });

  it('is nothing once everything counts, or in an unweighted course', () => {
    expect(
      countedShare([group('Labs', 90, 50), group('Exams', 80, 50)]),
    ).toBeUndefined();
    expect(countedShare([group('Labs', 90), group('Exams')])).toBeUndefined();
    expect(countedShare([group('Exams', undefined, 100)])).toBe(0);
  });
});

const ENV_SCRIPT = `
  ENV = {"course_id":"53976","course_active_grading_scheme":{"id":"","title":"Default Canvas Grading Scheme","scaling_factor":1.0,"points_based":false,"data":[{"name":"B","value":0.84},{"name":"A","value":0.94},{"name":"A-","value":0.9},{"name":"B+","value":0.87},{"name":"F","value":0.0}]},"assignments_2_student_enabled":true,"notices":[]};
`;

describe('readScheme', () => {
  it('reads the scheme from Canvas’s ENV, highest first', () => {
    expect(readScheme(ENV_SCRIPT)).toEqual([
      { name: 'A', value: 0.94 },
      { name: 'A-', value: 0.9 },
      { name: 'B+', value: 0.87 },
      { name: 'B', value: 0.84 },
      { name: 'F', value: 0 },
    ]);
  });

  it('reads none without one, or for a scheme in points', () => {
    expect(
      readScheme('ENV = {"course_active_grading_scheme":null};'),
    ).toBeUndefined();
    expect(readScheme('var x = 1;')).toBeUndefined();
    expect(
      readScheme(
        ENV_SCRIPT.replace('"points_based":false', '"points_based":true'),
      ),
    ).toBeUndefined();
  });
});

describe('isDefaultScheme', () => {
  it('tells Canvas’s default, which has no id, from a chosen scheme', () => {
    expect(isDefaultScheme(ENV_SCRIPT)).toBe(true);
    expect(isDefaultScheme(ENV_SCRIPT.replace('"id":""', '"id":"123"'))).toBe(
      false,
    );
    expect(
      isDefaultScheme('ENV = {"course_active_grading_scheme":null};'),
    ).toBe(false);
  });

  it('knows there’s a scheme at all, in points too', () => {
    expect(
      hasScheme(
        ENV_SCRIPT.replace('"points_based":false', '"points_based":true'),
      ),
    ).toBe(true);
    expect(hasScheme('ENV = {"course_active_grading_scheme":null};')).toBe(
      false,
    );
  });
});

describe('standing', () => {
  const scheme = readScheme(ENV_SCRIPT) ?? [];

  it('finds the letter and how far the next is', () => {
    expect(standing(89.67, scheme)).toEqual({
      letter: 'B+',
      next: { letter: 'A-', gap: 0.33 },
    });
  });

  it('counts a cutoff reached exactly', () => {
    expect(standing(90, scheme)?.letter).toBe('A-');
  });

  it('has no next letter at the top', () => {
    expect(standing(97, scheme)).toEqual({ letter: 'A', next: undefined });
  });

  it('gives the lowest letter below every cutoff', () => {
    expect(standing(-5, scheme)?.letter).toBe('F');
  });
});

describe('isFinal', () => {
  it('knows a final by the word', () => {
    expect(isFinal('Final Exam')).toBe(true);
    expect(isFinal('Finals')).toBe(true);
    expect(isFinal('Midterm & final project')).toBe(true);
    expect(isFinal('Finalists')).toBe(false);
    expect(isFinal('Semifinal')).toBe(false);
    expect(isFinal('Exams')).toBe(false);
  });
});

describe('finalsLast', () => {
  const named = (...names: string[]): Group[] =>
    names.map((name) => ({ name }));
  const names = (groups: Group[]) => groups.map((g) => g.name);
  const none = () => false;

  it('puts the finals last, in their order', () => {
    expect(
      names(
        finalsLast(
          named('Homework', 'Final Exam', 'Labs', 'Final Project'),
          none,
        ),
      ),
    ).toEqual(['Homework', 'Labs', 'Final Exam', 'Final Project']);
  });

  it('puts what the fallback picks last when no group is a final', () => {
    expect(
      names(
        finalsLast(named('Comprehensive Exam', 'Labs'), (g) =>
          g.name.startsWith('Comp'),
        ),
      ),
    ).toEqual(['Labs', 'Comprehensive Exam']);
  });

  it('ignores the fallback when there’s a final', () => {
    expect(
      names(finalsLast(named('Final', 'Labs'), (g) => g.name === 'Labs')),
    ).toEqual(['Labs', 'Final']);
  });
});
