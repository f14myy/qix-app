/**
 * Notifications.
 *
 * The site uses the Web Notification API plus Web Push through a service worker.
 * Neither exists in the Tauri webview, so this module keeps the exact same
 * exports — call sites are unchanged — and routes them to the native notification
 * plugin. Background delivery is handled by the Android foreground service
 * instead of Web Push; see `$lib/net/background`.
 */
import { getCachedSettings } from './settings';
import { isTauri } from './net/platform';
import { disableBackgroundNotifications, enableBackgroundNotifications } from './net/background';

type Permission = NotificationPermission | 'unsupported';

export async function ensureNotificationPermission(): Promise<Permission> {
	if (typeof window === 'undefined') return 'unsupported';

	if (isTauri()) {
		try {
			const { isPermissionGranted, requestPermission } = await import(
				'@tauri-apps/plugin-notification'
			);
			if (await isPermissionGranted()) return 'granted';
			const result = await requestPermission();
			return result === 'granted' ? 'granted' : 'denied';
		} catch {
			return 'unsupported';
		}
	}

	// Plain browser (`pnpm dev`).
	if (!('Notification' in window)) return 'unsupported';
	if (Notification.permission === 'granted' || Notification.permission === 'denied') {
		return Notification.permission;
	}
	return Notification.requestPermission();
}

/**
 * Kept under the site's name so `onboarding` and `settings/notifications` do not
 * need to change. In the app it turns on the background notification service
 * rather than registering a Web Push endpoint.
 */
export async function subscribeWebPush(): Promise<boolean> {
	return enableBackgroundNotifications();
}

export async function unsubscribeWebPush(): Promise<void> {
	await disableBackgroundNotifications();
}

export function notifyMessage(opts: { title: string; body: string; tag?: string; href?: string }) {
	const s = getCachedSettings();
	if (!s.notifyMessages) return;
	// Same rule as the site: never interrupt someone who is already looking at it.
	if (typeof document !== 'undefined' && !document.hidden) return;
	if (typeof window === 'undefined') return;

	if (s.notifySound) playNotifySound();

	if (isTauri()) {
		void (async () => {
			try {
				const { isPermissionGranted, sendNotification } = await import(
					'@tauri-apps/plugin-notification'
				);
				if (!(await isPermissionGranted())) return;
				sendNotification({ title: opts.title, body: opts.body });
			} catch {
				/* ignore */
			}
		})();
		return;
	}

	try {
		if (!('Notification' in window) || Notification.permission !== 'granted') return;
		const n = new Notification(opts.title, {
			body: opts.body,
			tag: opts.tag ?? 'qix-message',
			icon: '/icons/icon-192.png'
		});
		n.onclick = () => {
			window.focus();
			if (opts.href) window.location.href = opts.href;
			n.close();
		};
	} catch {
		/* ignore */
	}
}

function playNotifySound() {
	try {
		const Ctx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return;
		const ctx = new Ctx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = 880;
		gain.gain.value = 0.04;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
		osc.stop(ctx.currentTime + 0.2);
		osc.onended = () => ctx.close().catch(() => {});
	} catch {
		/* ignore */
	}
}
