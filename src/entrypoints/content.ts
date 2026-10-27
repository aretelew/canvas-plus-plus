export default defineContentScript({
  matches: ['https://*.instructure.com/*'],
  main() {
    console.log('[canvas++] content script loaded on', location.hostname);
  },
});
