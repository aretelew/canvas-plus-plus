// Requests to Canvas's REST API from a content script, made the way Canvas's
// own scripts make them, with the user's session.

interface Request {
  method?: 'GET' | 'POST' | 'PUT';
  // sent as the JSON body
  json?: unknown;
}

/** `path` is on this Canvas site (or a full URL Canvas gave, like a next page). */
export function canvasFetch(
  path: string,
  { method = 'GET', json }: Request = {},
): Promise<Response> {
  // A content script's own fetch carries the page's cookies and Origin in
  // both browsers under MV3. (Firefox's MV2-era `content.fetch` doesn't
  // exist in MV3 content scripts: calling it throws.)
  return fetch(new URL(path, location.origin), {
    method,
    headers: {
      // ids as strings (some are past what a JS number holds exactly), and
      // application/json, without which Canvas puts `while(1);` in front
      Accept: 'application/json+canvas-string-ids, application/json',
      // Canvas checks writes made with the session cookie against this
      // cookie's value, sent back as a header
      ...(method !== 'GET' && { 'X-CSRF-Token': csrfToken() }),
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

/** The response's JSON, or undefined when the request fails. */
export async function canvasJson<T>(
  path: string,
  request?: Request,
): Promise<T | undefined> {
  try {
    const response = await canvasFetch(path, request);
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** The next page of a list, from a response's Link header. */
export function nextPage(link: string | null): string | undefined {
  const url = /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1];
  // only ever Canvas's own pages
  return url && new URL(url).origin === location.origin ? url : undefined;
}

function csrfToken(): string {
  const token = /(?:^|;\s*)_csrf_token=([^;]*)/.exec(document.cookie)?.[1];
  return token ? decodeURIComponent(token) : '';
}
