<script lang="ts">
	import { onMount } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { APP_VERSION } from '$lib/version';

	const i18n = useI18n();
	const STORAGE_KEY = 'qix-seen-version';

	let visible = $state(false);

	onMount(() => {
		try {
			const seen = localStorage.getItem(STORAGE_KEY);
			if (seen !== APP_VERSION) visible = true;
		} catch { /* SSR / incognito */ }
	});

	function dismiss() {
		visible = false;
		try { localStorage.setItem(STORAGE_KEY, APP_VERSION); } catch { /* ignore */ }
	}

	const entries = $derived([
		{ icon: '🖥️', text: i18n.t('whatsnew.e1') },
		{ icon: '🎨', text: i18n.t('whatsnew.e2') },
		{ icon: '🌈', text: i18n.t('whatsnew.e3') },
		{ icon: '✨', text: i18n.t('whatsnew.e4') },
		{ icon: '🎬', text: i18n.t('whatsnew.e5') },
		{ icon: '👆', text: i18n.t('whatsnew.e6') },
		{ icon: '💫', text: i18n.t('whatsnew.e7') },
		{ icon: '🔧', text: i18n.t('whatsnew.e8') },
		{ icon: '📞', text: i18n.t('whatsnew.e9') },
		{ icon: '♿', text: i18n.t('whatsnew.e10') },
	]);
</script>

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="wn-backdrop" onclick={dismiss}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="wn-card" onclick={(e) => e.stopPropagation()}>
			<div class="wn-header">
				<span class="wn-sparkle"><Sparkles size={22} /></span>
				<h2 class="wn-title">{i18n.t('whatsnew.title', { version: APP_VERSION })}</h2>
			</div>

			<ul class="wn-list">
				{#each entries as entry}
					<li class="wn-entry">
						<span class="wn-entry-icon">{entry.icon}</span>
						<span class="wn-entry-text">{entry.text}</span>
					</li>
				{/each}
			</ul>

			<button class="btn wn-dismiss" type="button" onclick={dismiss}>
				{i18n.t('whatsnew.dismiss')}
			</button>
		</div>
	</div>
{/if}
