import { syncThemeToPage } from '@/features/themes/page';
import '@/features/themes/theme.css';

export default defineContentScript({
  matches: ['https://*.instructure.com/*'],
  // Canvas embeds some of itself from other instructure.com origins, like New
  // Quizzes (*.quiz-lti-*-prod.instructure.com); theme those frames too.
  allFrames: true,
  // DocViewer (canvadocs, canvadocs-iad-prod, …): PDF annotations' colors
  // carry meaning, so it keeps its own look
  excludeGlobs: ['https://canvadocs*'],
  runAt: 'document_start',
  main: syncThemeToPage,
});
