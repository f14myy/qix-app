/**
 * Which Qix server this build talks to.
 *
 * Deliberately not user-configurable: the app is a copy of the site, and adding
 * a "server URL" field would be a screen the site does not have. Point a build
 * at a different instance with VITE_QIX_SERVER at compile time.
 */
const RAW = import.meta.env.VITE_QIX_SERVER ?? 'https://qqqix.ru';

/** No trailing slash — every caller concatenates a path that starts with "/". */
export const SERVER_URL: string = RAW.replace(/\/+$/, '');

/** Paths the app proxies to the server. Everything else stays local to the bundle. */
export const API_PREFIX = '/api/';

/** True for the app-relative API paths the ported site code passes to fetch(). */
export function isApiPath(path: string): boolean {
	return path.startsWith(API_PREFIX);
}

/** Turns "/api/chats" into "https://qqqix.ru/api/chats". */
export function absoluteApiUrl(path: string): string {
	return SERVER_URL + path;
}
