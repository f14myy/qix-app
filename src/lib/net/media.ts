import { absoluteApiUrl } from './config';
import { getToken } from './session';

/**
 * URL for media the webview fetches on its own — `<img src>`, `<video src>`,
 * download links.
 *
 * These never pass through `fetch`, so they cannot carry an Authorization
 * header, and `/api/files/*`, `/api/avatars/*` and `/api/banners/*` all require a
 * session. The server therefore also accepts the token as `?t=` on GET requests.
 *
 * Call sites pass the same app-relative path the site uses, e.g.
 * `mediaUrl(`/api/files/${id}`)`.
 */
export function mediaUrl(path: string): string {
	const url = absoluteApiUrl(path);
	const token = getToken();
	if (!token) return url;
	return `${url}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}
