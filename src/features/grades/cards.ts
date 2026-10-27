import { canvasFetch } from '@/core/canvas-api';
import { syncCardFeature, type Card } from '@/core/dashboard-cards';
import { currentScores, formatScore, type Course } from './scores';
import { cardGrades } from './storage';

// Puts each course's current grade on its dashboard card: a pill at the top
// left of the card's color or image, linking to the course's Grades page.
// Courses with nothing to show (no grades yet, totals hidden by the teacher,
// not a student there) get no pill. The scores come from one request to
// Canvas's API, made the first time grades are on.

const PILL = 'cpp-card-grade';

// every active course fits in one page (per_page tops out at 100)
const COURSES =
  '/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&include[]=restrict_quantitative_data&per_page=100';

export function syncCardGrades(): Promise<void> {
  return syncCardFeature({
    setting: cardGrades,
    marker: PILL,
    load: fetchScores,
    decorate: addPill,
  });
}

function addPill(card: Card, byCourse: Map<string, number>): void {
  const score = byCourse.get(card.courseId);
  if (score === undefined) return;
  const grade = formatScore(score, document.documentElement.lang || undefined);
  const pill = document.createElement('a');
  pill.className = PILL;
  pill.href = `/courses/${card.courseId}/grades`;
  pill.textContent = grade;
  if (card.name) {
    pill.setAttribute('aria-label', `${card.name} grades: ${grade}`);
  }
  // first, so the tab order follows the layout (it sits top left)
  card.element.querySelector('.ic-DashboardCard__header')?.prepend(pill);
}

// No grades on a failed request; they're tried again on the next page load.
async function fetchScores(): Promise<Map<string, number>> {
  try {
    const response = await canvasFetch(COURSES);
    if (!response.ok) return new Map();
    return currentScores((await response.json()) as Course[]);
  } catch {
    return new Map();
  }
}
