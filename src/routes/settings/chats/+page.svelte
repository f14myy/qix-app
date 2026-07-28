<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { fetchSettings, patchSettings, type ClientSettings } from '$lib/settings';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	const i18n = useI18n();
	let settings = $state<ClientSettings | null>(null);

	onMount(async () => {
		settings = await fetchSettings();
	});

	async function toggle(
		key: 'sendWithEnter' | 'linkPreviews' | 'confirmMessageDelete' | 'autoPlayVoice'
	) {
		if (!settings) return;
		settings = await patchSettings({ [key]: !settings[key] });
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.chatsPrefs')}</h1>
	</header>

	<div class="settings-body">
		{#if settings}
			<section class="settings-section">
				<h2>{i18n.t('settings.navChats')}</h2>
				<div class="settings-card soft">
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.sendWithEnter')}</span>
							<span class="hint">{i18n.t('settings.sendWithEnterHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.sendWithEnter}
							onchange={() => toggle('sendWithEnter')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.linkPreviews')}</span>
							<span class="hint">{i18n.t('settings.linkPreviewsHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.linkPreviews}
							onchange={() => toggle('linkPreviews')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.confirmMessageDelete')}</span>
							<span class="hint">{i18n.t('settings.confirmMessageDeleteHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.confirmMessageDelete}
							onchange={() => toggle('confirmMessageDelete')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.autoPlayVoice')}</span>
							<span class="hint">{i18n.t('settings.autoPlayVoiceHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.autoPlayVoice}
							onchange={() => toggle('autoPlayVoice')}
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>
</div>
