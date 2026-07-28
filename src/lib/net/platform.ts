/**
 * Platform probes.
 *
 * The frontend also runs in a plain browser (`pnpm dev`) for quick UI work, so
 * every Tauri-only path has to be guarded rather than assumed.
 */

export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let androidCache: boolean | null = null;

/**
 * Android needs different treatment in several places — keyboard insets, media
 * cache pressure, the background notification service. Resolved once from the
 * user agent, which the Tauri webview reports honestly.
 */
export function isAndroid(): boolean {
	if (androidCache === null) {
		androidCache =
			typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent ?? '');
	}
	return androidCache;
}

export function isMobile(): boolean {
	return (
		isAndroid() ||
		(typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent ?? ''))
	);
}
