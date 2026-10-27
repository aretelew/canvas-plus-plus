// Turns a raw HAR recorded on a school's Canvas into a replayable fixture:
// login secrets are dropped, and the school's host is rewritten to one that
// the content script matches (custom domains like canvas.case.edu don't).
// Rewriting the host, not the origin, also covers URL-encoded origins (form
// posts, query strings) and bare hosts (CSP frame-ancestors, which otherwise
// stop the replayed New Quizzes frame from loading).

export const FIXTURE_ORIGIN = 'https://fixture.instructure.com';
const FIXTURE_HOST = new URL(FIXTURE_ORIGIN).host;

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
  request: {
    method: string;
    url: string;
    headers: Header[];
    cookies?: unknown[];
    postData?: { text?: string };
  };
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
  const keep = (headers: Header[]) =>
    headers.filter((h) => !SECRET_HEADERS.has(h.name.toLowerCase()));
  const withoutSecrets = {
    ...har,
    log: {
      ...har.log,
      entries: withBodies(har.log.entries).map(
        ({ request, response, ...entry }) => ({
          ...entry,
          request: { ...request, headers: keep(request.headers), cookies: [] },
          response: {
            ...response,
            headers: keep(response.headers),
            cookies: [],
          },
        }),
      ),
    },
  };
  // The host turns up in URLs, headers, bodies, form posts, query strings and
  // CSP, so replace it in the serialized HAR. Binary bodies are base64, whose
  // alphabet has no '.', so a host can't occur in one by accident.
  return JSON.parse(
    JSON.stringify(withoutSecrets).replaceAll(
      new URL(schoolOrigin).host,
      FIXTURE_HOST,
    ),
  ) as Har;
}

// A request made twice can be recorded once without its body: a download cut
// short when the page asked again (DocViewer does this with the PDF). Replay
// serves the first match, so drop those when another copy has the body.
function withBodies(entries: Entry[]): Entry[] {
  const key = ({ request }: Entry) =>
    `${request.method} ${request.url} ${request.postData?.text ?? ''}`;
  const hasBody = (entry: Entry) => Boolean(entry.response.content.text);
  const recorded = new Set(entries.filter(hasBody).map(key));
  return entries.filter((entry) => hasBody(entry) || !recorded.has(key(entry)));
}
