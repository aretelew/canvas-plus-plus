import { loadCourses } from '@/core/courses';
import { syncCardFeature, type Card } from '@/core/dashboard-cards';
import { currentScores, formatScore } from './scores';
import { cardGrades } from './storage';

// Puts each course's current grade on its dashboard card: a pill at the top
// left of the card's color or image, linking to the course's Grades page.
// Courses with nothing to show (no grades yet, totals hidden by the teacher,
// not a student there) get no pill. The scores come from the user's courses
// (core/courses.ts), asked for the first time grades are on.

const PILL = 'cpp-card-grade';

export function syncCardGrades(): Promise<void> {
  return syncCardFeature({
    setting: cardGrades,
    marker: PILL,
    // none on a failed request; they're tried again on the next page load
    load: async () => currentScores(await loadCourses()),
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
