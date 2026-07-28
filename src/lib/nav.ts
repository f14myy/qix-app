import { goto } from '$app/navigation';

/**
 * Depth of the in-app history stack. Only entries we pushed ourselves may be
 * popped — otherwise `history.back()` would leave the app entirely.
 */
let depth = 0;

export function trackNavigation(type: string) {
	if (type === 'popstate') depth = Math.max(0, depth - 1);
	else if (type === 'link' || type === 'goto' || type === 'form') depth += 1;
}

export function goBack(fallback = '/') {
	if (depth > 0 && typeof history !== 'undefined') {
		history.back();
		return;
	}
	void goto(fallback, { replaceState: true });
}
