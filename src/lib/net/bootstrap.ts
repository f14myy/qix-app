/**
 * Makes the site's own networking code work unchanged inside the app.
 *
 * Every screen ported from `qix-www` calls `fetch('/api/…')` and
 * `new EventSource('/api/…')` — 87 call sites. Rewriting each one would mean the
 * app's source permanently diverges from the site's, and every future change to
 * the site would have to be re-applied by hand. Instead the two globals are
 * wrapped once, here, so the ported code stays byte-identical:
 *
 *   - app-relative `/api/…` URLs are pointed at the real server;
 *   - the session token is attached (header for fetch, `?t=` for EventSource,
 *     which cannot send headers);
 *   - a 401 on anything other than the auth endpoints raises `qix-unauthorized`,
 *     which the root layout turns into a redirect to /login.
 *
 * Nothing else is touched: URLs that are not `/api/…` go straight through.
 */
import { API_PREFIX, SERVER_URL, absoluteApiUrl, isApiPath } from './config';
import { getToken } from './session';

export const UNAUTHORIZED_EVENT = 'qix-unauthorized';

/** A 401 here means "wrong password", not "session expired" — never sign out. */
const AUTH_PATHS = '/api/auth/';

let installed = false;

export function installNetworkShims(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	installFetch();
	installEventSource();
}

/**
 * Resolves what the site would have requested against its own origin into an
 * absolute URL on the Qix server. Returns null when the URL is not ours to touch.
 */
function apiPathOf(rawUrl: string): string | null {
	if (isApiPath(rawUrl)) return rawUrl;

	// Already absolute — either pre-resolved by SvelteKit or written out in full.
	try {
		const base = typeof location !== 'undefined' ? location.href : SERVER_URL;
		const parsed = new URL(rawUrl, base);
		const isOwnOrigin =
			typeof location !== 'undefined' && parsed.origin === location.origin;
		if ((isOwnOrigin || parsed.origin === SERVER_URL) && parsed.pathname.startsWith(API_PREFIX)) {
			return parsed.pathname + parsed.search;
		}
	} catch {
		/* not a URL we can parse — leave it alone */
	}

	return null;
}

function withAuth(headers: Headers): Headers {
	const token = getToken();
	if (token && !headers.has('authorization')) {
		headers.set('authorization', `Bearer ${token}`);
	}
	return headers;
}

function installFetch(): void {
	const nativeFetch = window.fetch.bind(window);

	window.fetch = async function patchedFetch(
		input: RequestInfo | URL,
		init?: RequestInit
	): Promise<Response> {
		const rawUrl =
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const path = apiPathOf(rawUrl);
		if (!path) return nativeFetch(input as RequestInfo, init);

		const target = absoluteApiUrl(path);
		let response: Response;

		if (input instanceof Request) {
			const headers = withAuth(new Headers(input.headers));
			if (init?.headers) {
				new Headers(init.headers).forEach((v, k) => headers.set(k, v));
			}
			response = await nativeFetch(target, {
				method: input.method,
				headers,
				body: input.body,
				credentials: input.credentials,
				mode: input.mode,
				cache: input.cache,
				redirect: input.redirect,
				referrer: input.referrer,
				integrity: input.integrity,
				...init
			});
		} else {
			const headers = withAuth(new Headers(init?.headers));
			response = await nativeFetch(target, { ...init, headers });
		}

		if (response.status === 401 && !path.startsWith(AUTH_PATHS)) {
			window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
		}

		return response;
	};
}

function installEventSource(): void {
	const Native = window.EventSource;
	if (!Native) return;

	function PatchedEventSource(this: unknown, url: string | URL, init?: EventSourceInit) {
		const finalUrl = resolveStreamUrl(String(url));
		return new Native(finalUrl, init);
	}

	PatchedEventSource.prototype = Native.prototype;
	Object.assign(PatchedEventSource, {
		CONNECTING: Native.CONNECTING,
		OPEN: Native.OPEN,
		CLOSED: Native.CLOSED
	});

	window.EventSource = PatchedEventSource as unknown as typeof EventSource;
}

/** EventSource cannot send headers, so the token rides along in the query string. */
function resolveStreamUrl(rawUrl: string): string {
	const path = apiPathOf(rawUrl);
	if (!path) return rawUrl;

	const url = absoluteApiUrl(path);
	const token = getToken();
	if (!token) return url;
	return `${url}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}
