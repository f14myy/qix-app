/**
 * Background message notifications.
 *
 * The site relies on Web Push, which needs a service worker and a browser push
 * service — neither exists here. On Android a foreground service holds the SSE
 * connection to `/api/events` and posts native notifications; see
 * `src-tauri/src/notifications.rs`. On desktop the app itself stays connected
 * whenever it is running, so there is nothing extra to start.
 */
import { SERVER_URL } from './config';
import { isAndroid, isTauri } from './platform';
import { getToken } from './session';

const PREF_KEY = 'qix-background-notifications';

function supported(): boolean {
	return isTauri() && isAndroid();
}

/** Remembered so the service can be restarted after a reboot or an app update. */
export function backgroundNotificationsEnabled(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(PREF_KEY) === '1';
}

export async function enableBackgroundNotifications(): Promise<boolean> {
	if (!supported()) return true;

	const token = getToken();
	if (!token) return false;

	try {
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('start_notification_service', { server: SERVER_URL, token });
		localStorage.setItem(PREF_KEY, '1');
		return true;
	} catch {
		return false;
	}
}

export async function disableBackgroundNotifications(): Promise<void> {
	try {
		localStorage.removeItem(PREF_KEY);
	} catch {
		/* ignore */
	}
	if (!supported()) return;

	try {
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('stop_notification_service');
	} catch {
		/* service was not running */
	}
}

/** Re-arms the service on launch if the user turned it on previously. */
export async function resumeBackgroundNotifications(): Promise<void> {
	if (!supported() || !backgroundNotificationsEnabled()) return;
	await enableBackgroundNotifications();
}
