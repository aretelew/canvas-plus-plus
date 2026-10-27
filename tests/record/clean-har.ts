// Turns a raw HAR recorded on a school's Canvas into a replayable fixture:
// login secrets are dropped, and the school's origin is rewritten to one that
// the content script matches (custom domains like canvas.case.edu don't).

export const FIXTURE_ORIGIN = 'https://fixture.instructure.com';

const SECRET_HEADERS = new Set([
  'cookie',
  'set-cookie',
  'authorization',
  'x-csrf-token',
]);

interface Header {
  name: string;
  value: string;
}

interface Entry {
  startedDateTime: string;
  request: { url: string; headers: Header[]; cookies?: unknown[] };
  response: {
    headers: Header[];
    cookies?: unknown[];
    content: { text?: string; encoding?: string };
  };
}

export interface Har {
  log: { entries: Entry[] };
}

export function cleanHar(har: Har, schoolOrigin: string): Har {
  const rewrite = (s: string) => s.replaceAll(schoolOrigin, FIXTURE_ORIGIN);
  const keepHeaders = (headers: Header[]) =>
    headers
      .filter((h) => !SECRET_HEADERS.has(h.name.toLowerCase()))
      .map((h) => ({ ...h, value: rewrite(h.value) }));

  return {
    ...har,
    log: {
      ...har.log,
      entries: har.log.entries.map(({ request, response, ...entry }) => {
        const { text, encoding } = response.content;
        return {
          ...entry,
          request: {
            ...request,
            url: rewrite(request.url),
            headers: keepHeaders(request.headers),
            cookies: [],
          },
          response: {
            ...response,
            headers: keepHeaders(response.headers),
            cookies: [],
            content: {
              ...response.content,
              // base64 bodies are images/fonts; only text can carry URLs
              ...(text !== undefined &&
                encoding !== 'base64' && { text: rewrite(text) }),
            },
          },
        };
      }),
    },
  };
}
