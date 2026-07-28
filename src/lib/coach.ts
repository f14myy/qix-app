const MAX_SHOWS = 4;

/** Show a coach tip up to MAX_SHOWS visits until the user dismisses it. */
export function shouldShowCoach(key: string): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		const v = localStorage.getItem(key);
		if (v === 'done' || v === '1') return false; // '1' = legacy one-shot dismiss
		const n = Number(v || '0');
		return Number.isFinite(n) && n < MAX_SHOWS;
	} catch {
		return false;
	}
}

/** Call when the tip is actually shown. */
export function markCoachShown(key: string) {
	if (typeof localStorage === 'undefined') return;
	try {
		const v = localStorage.getItem(key);
		if (v === 'done' || v === '1') return;
		const n = Number(v || '0');
		localStorage.setItem(key, String((Number.isFinite(n) ? n : 0) + 1));
	} catch {
		/* ignore */
	}
}

export function dismissCoach(key: string) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, 'done');
	} catch {
		/* ignore */
	}
}
