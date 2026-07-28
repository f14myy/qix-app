/**
 * Explicit API client for `load` functions.
 *
 * Component code keeps calling plain `fetch('/api/…')` — the shim in
 * `./bootstrap` handles those. Load functions cannot rely on it: SvelteKit
 * captures `window.fetch` when its client runtime module is first evaluated,
 * which happens before any of our code runs, so the `fetch` handed to `load`
 * is the untouched original. Loads therefore call these helpers instead.
 */
import { absoluteApiUrl } from './config';
import { getToken } from './session';

export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

export async function api(path: string, init?: RequestInit): Promise<Response> {
	const headers = new Headers(init?.headers);
	const token = getToken();
	if (token && !headers.has('authorization')) {
		headers.set('authorization', `Bearer ${token}`);
	}
	return fetch(absoluteApiUrl(path), { ...init, headers });
}

/** Throws `ApiError` on a non-2xx response, using the server's `error` field. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await api(path, init);
	const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;

	if (!res.ok) {
		throw new ApiError(res.status, body?.error || `Request failed (${res.status})`);
	}
	return body as T;
}

/** Same, but a failed request yields `fallback` instead of throwing. */
export async function apiJsonOr<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
	try {
		return await apiJson<T>(path, init);
	} catch {
		return fallback;
	}
}
