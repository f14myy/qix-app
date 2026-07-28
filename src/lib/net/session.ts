/**
 * The session token.
 *
 * The webview lives on its own origin, so the site's `qix_session` cookie never
 * reaches the server. Instead the server hands back the session id at login and
 * the app sends it as `Authorization: Bearer …` (and as `?t=` on URLs the webview
 * loads by itself — images, media, EventSource). See `qix-www/src/hooks.server.ts`.
 *
 * It is kept in a Tauri store rather than localStorage because the Android
 * background notification service, which runs without a webview, has to read it
 * too. localStorage is only the fallback for running the frontend in a plain
 * browser during development.
 */
import { isTauri } from './platform';

const STORE_FILE = 'qix.json';
const TOKEN_KEY = 'token';
const LS_KEY = 'qix-token';

/**
 * Mirrored in memory because `mediaUrl()` is called while rendering and cannot
 * await. `hydrate()` fills it before the first route renders.
 */
let token: string | null = null;
let hydrated = false;

type TauriStore = {
	get<T>(key: string): Promise<T | null | undefined>;
	set(key: string, value: unknown): Promise<void>;
	delete(key: string): Promise<boolean>;
	save(): Promise<void>;
};

let storePromise: Promise<TauriStore | null> | null = null;

function store(): Promise<TauriStore | null> {
	if (!storePromise) {
		storePromise = isTauri()
			? import('@tauri-apps/plugin-store')
					.then((m) => m.load(STORE_FILE, { autoSave: true }) as unknown as Promise<TauriStore>)
					.catch(() => null)
			: Promise.resolve(null);
	}
	return storePromise;
}

/** Reads the persisted token into memory. Must be awaited before the app renders. */
export async function hydrateSession(): Promise<string | null> {
	if (hydrated) return token;

	const s = await store();
	if (s) {
		token = (await s.get<string>(TOKEN_KEY).catch(() => null)) ?? null;
	} else if (typeof localStorage !== 'undefined') {
		token = localStorage.getItem(LS_KEY);
	}

	hydrated = true;
	return token;
}

/** Synchronous read for render paths. Returns null until `hydrateSession()` runs. */
export function getToken(): string | null {
	return token;
}

export function isSignedIn(): boolean {
	return !!token;
}

export async function setToken(next: string): Promise<void> {
	token = next;
	hydrated = true;

	const s = await store();
	if (s) await s.set(TOKEN_KEY, next);
	else if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, next);
}

export async function clearToken(): Promise<void> {
	token = null;
	hydrated = true;

	const s = await store();
	if (s) await s.delete(TOKEN_KEY);
	else if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
}
