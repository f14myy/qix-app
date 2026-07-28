/**
 * Haptic feedback.
 *
 * Android's WebView implements the Vibration API as long as the app holds the
 * VIBRATE permission (declared in AndroidManifest.xml), so the site's code path
 * works unchanged there. The Tauri haptics plugin is the fallback for webviews
 * that do not expose `navigator.vibrate`; it takes a single duration, so a
 * pattern is reduced to its total buzz time.
 */
import { getCachedSettings } from './settings';
import { isMobile, isTauri } from './net/platform';

export function haptic(ms: number | number[] = 10) {
	try {
		if (!getCachedSettings().haptics) return;

		if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
			navigator.vibrate(ms);
			return;
		}

		if (isTauri() && isMobile()) {
			// Pattern entries alternate buzz/pause; the odd indexes are the pauses.
			const duration = Array.isArray(ms)
				? ms.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0)
				: ms;
			void import('@tauri-apps/plugin-haptics')
				.then((m) => m.vibrate(duration))
				.catch(() => {
					/* no vibrator on this device */
				});
		}
	} catch {
		/* ignore */
	}
}

export function hapticSuccess() {
	haptic([10, 40, 12]);
}

export function hapticFail() {
	haptic([30, 40, 30]);
}

export function hapticPop() {
	haptic([6, 20, 8]);
}

export function hapticSwipe() {
	haptic(12);
}

export function hapticBurst() {
	haptic([8, 15, 8, 15, 12]);
}
