import { syncCardAssignments } from '@/features/assignments/cards';
import '@/features/assignments/assignments.css';
import { syncCardGrades } from '@/features/grades/cards';
import '@/features/grades/grades.css';
import { syncThemeToPage } from '@/features/themes/page';
import '@/features/themes/theme.css';

export default defineContentScript({
  matches: ['https://*.instructure.com/*'],
  // Canvas embeds some of itself from other instructure.com origins, like New
  // Quizzes (*.quiz-lti-*-prod.instructure.com); theme those frames too.
  allFrames: true,
  matchOriginAsFallback: true,
  // DocViewer (canvadocs, canvadocs-iad-prod, …): PDF annotations' colors
  // carry meaning, so it keeps its own look
  excludeGlobs: ['https://canvadocs*'],
  runAt: 'document_start',
  main() {
    void syncThemeToPage();
    void syncCardGrades();
    void syncCardAssignments();
  },
});
