/**
 * PWA shims.
 *
 * The app is already installed, so there is no service worker to register and no
 * "add to home screen" tip to show. The exports are kept so `+layout.svelte` and
 * the settings screen stay identical to the site's.
 */
import { isTauri } from './net/platform';

/** No service worker in a packaged app — background delivery is the native service. */
export function registerServiceWorker() {
	/* intentionally empty */
}

export function isStandaloneDisplay(): boolean {
	if (typeof window === 'undefined') return false;
	if (isTauri()) return true;
	const mq = window.matchMedia('(display-mode: standalone)').matches;
	const ios =
		'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone;
	return mq || !!ios;
}

const TIP_KEY = 'qix-install-tip-dismissed';

export function shouldShowInstallTip(): boolean {
	if (typeof window === 'undefined') return false;
	if (isStandaloneDisplay()) return false;
	try {
		return localStorage.getItem(TIP_KEY) !== '1';
	} catch {
		return false;
	}
}

export function dismissInstallTip() {
	try {
		localStorage.setItem(TIP_KEY, '1');
	} catch {
		/* ignore */
	}
}
