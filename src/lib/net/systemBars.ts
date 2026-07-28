/**
 * Keeps Android's status and navigation bars in step with the app's theme.
 *
 * Qix picks its theme and palette in localStorage, independent of the phone's
 * dark mode setting. Android has no way to know that, so it draws the system
 * bar icons according to the *system* theme: choose a light Qix look on a phone
 * in dark mode and the clock, battery and gesture pill turn white on a
 * near-white header and vanish.
 *
 * `theme.ts` already broadcasts `qix-theme` on every theme or look change, so
 * this hooks that and reports the result to the native side — no changes to the
 * shared theme code, which stays identical to the site's.
 */
import { getStoredTheme, resolveTheme, statusBarColor } from '$lib/theme';
import { isAndroid, isTauri } from './platform';

type NativeBridge = {
	setSystemBars: (dark: boolean, color: string) => void;
	requestInsets: () => void;
};

function bridge(): NativeBridge | null {
	if (typeof window === 'undefined') return null;
	const found = (window as unknown as { QixNative?: NativeBridge }).QixNative;
	return typeof found?.setSystemBars === 'function' ? found : null;
}

function sync() {
	const native = bridge();
	if (!native) return;
	try {
		const mode = resolveTheme(getStoredTheme());
		native.setSystemBars(mode === 'dark', statusBarColor());
	} catch {
		/* the bridge is best-effort — never let it break rendering */
	}
}

/**
 * Starts the sync. Returns a teardown for the layout's onMount.
 * A no-op anywhere the bridge does not exist (desktop, browser dev).
 */
export function initSystemBars(): () => void {
	if (!isTauri() || !isAndroid() || typeof window === 'undefined') {
		return () => {};
	}

	sync();

	// The first inset delivery can land before this document existed, leaving
	// the safe areas at zero — ask for them again now that we are mounted.
	try {
		bridge()?.requestInsets();
	} catch {
		/* older build without the method */
	}

	window.addEventListener('qix-theme', sync);

	// With the preference on "system", the resolved theme changes without any
	// in-app event firing.
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	mq.addEventListener('change', sync);

	return () => {
		window.removeEventListener('qix-theme', sync);
		mq.removeEventListener('change', sync);
	};
}
