import { syncPageFlag } from '@/core/page-flag';
import { syncCardAssignments } from '@/features/assignments/cards';
import '@/features/assignments/assignments.css';
import { hideFooter } from '@/features/footer/storage';
import '@/features/footer/footer.css';
import { syncCardGrades } from '@/features/grades/cards';
import '@/features/grades/grades.css';
import '@/features/logo/logo.css';
import { hideLogo } from '@/features/logo/storage';
import '@/features/sensus/sensus.css';
import { hideSensus } from '@/features/sensus/storage';
import { syncSidebar } from '@/features/sidebar/page';
import '@/features/sidebar/sidebar.css';
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
    void syncPageFlag(hideLogo, 'hide-logo');
    void syncPageFlag(hideFooter, 'hide-footer');
    void syncPageFlag(hideSensus, 'hide-sensus');
    void syncCardGrades();
    void syncCardAssignments();
    void syncSidebar();
  },
});
