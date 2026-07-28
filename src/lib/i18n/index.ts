import { en, ru, type Dict, type Locale } from './dicts';

const STORAGE_KEY = 'qix-locale';

const dicts: Record<Locale, Dict> = { en, ru };

let current: Locale = 'en';
const listeners = new Set<() => void>();

export function detectLocale(): Locale {
	if (typeof navigator === 'undefined') return 'en';
	return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function getLocale(): Locale {
	return current;
}

export function initLocale(): Locale {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'en' || stored === 'ru') current = stored;
		else current = 'en';
	}
	return current;
}

export function setLocale(locale: Locale): void {
	current = locale;
	if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale);
	for (const l of listeners) l();
}

export function subscribeLocale(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function t(key: string, vars?: Record<string, string | number>): string {
	let s = dicts[current][key] ?? dicts.en[key] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			s = s.replace(`{${k}}`, String(v));
		}
	}
	return s;
}

export type { Locale };
