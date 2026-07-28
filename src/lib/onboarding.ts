const DONE_KEY = 'qix-onboarding-done';
const PENDING_KEY = 'qix-onboarding-pending';

export function isOnboardingDone(): boolean {
	if (typeof localStorage === 'undefined') return true;
	try {
		return localStorage.getItem(DONE_KEY) === '1';
	} catch {
		return true;
	}
}

export function markOnboardingDone(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(DONE_KEY, '1');
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		/* ignore */
	}
}

export function markOnboardingPending(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(PENDING_KEY, '1');
	} catch {
		/* ignore */
	}
}

export function isOnboardingPending(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(PENDING_KEY) === '1';
	} catch {
		return false;
	}
}

/** Fresh register pending first-run setup. */
export function shouldForceOnboarding(): boolean {
	return isOnboardingPending() && !isOnboardingDone();
}
