/** Whether View Transitions are safe for this navigation (desktop hover only). */
export function canUseViewTransition(): boolean {
	if (typeof document === 'undefined' || typeof window === 'undefined') return false;
	if (!('startViewTransition' in document)) return false;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	if (document.documentElement.getAttribute('data-reduce-motion') === '1') return false;
	// Skip on touch / coarse pointers — they glitch chat switches on mobile
	if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
	return true;
}

export function startViewTransition(cb: () => void): void {
	if (!canUseViewTransition()) {
		cb();
		return;
	}
	(
		document as Document & { startViewTransition: (fn: () => void) => void }
	).startViewTransition(cb);
}
