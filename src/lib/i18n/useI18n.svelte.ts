import { onMount } from 'svelte';
import { getLocale, initLocale, setLocale, subscribeLocale, t as translate, type Locale } from './index';

/** Reactive i18n helper for Svelte 5 components */
export function useI18n() {
	let locale = $state<Locale>('en');
	let tick = $state(0);

	onMount(() => {
		locale = initLocale();
		return subscribeLocale(() => {
			locale = getLocale();
			tick++;
		});
	});

	function t(key: string, vars?: Record<string, string | number>) {
		tick;
		locale;
		return translate(key, vars);
	}

	function set(next: Locale) {
		setLocale(next);
		locale = next;
	}

	return {
		get locale() {
			return locale;
		},
		t,
		setLocale: set
	};
}
