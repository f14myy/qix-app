/**
 * Sign-in plumbing.
 *
 * The site's auth screens post to `/api/auth/*` and rely on the response's
 * Set-Cookie. The app has to keep the returned session id instead, so each screen
 * calls `persistLogin()` with the parsed response body — the only change those
 * screens need.
 */
import { disableBackgroundNotifications, resumeBackgroundNotifications } from './background';
import { clearToken, setToken } from './session';

type AuthResponse = { token?: unknown };

/** Stores the session id returned by login / register / recover. */
export async function persistLogin(body: AuthResponse): Promise<boolean> {
	const token = typeof body?.token === 'string' ? body.token : '';
	if (!token) return false;

	await setToken(token);
	// A fresh token invalidates the one the background service is holding.
	await resumeBackgroundNotifications();
	return true;
}

/**
 * Drops the local session. The caller decides where to navigate — sign-out from
 * the settings screen and an expired token take different routes.
 */
export async function forgetLogin(): Promise<void> {
	await disableBackgroundNotifications();
	await clearToken();
}
