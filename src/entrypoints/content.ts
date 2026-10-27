import { syncThemeToPage } from '@/features/themes/page';
import '@/features/themes/theme.css';

export default defineContentScript({
  matches: ['https://*.instructure.com/*'],
  runAt: 'document_start',
  main: syncThemeToPage,
});
