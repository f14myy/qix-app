<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import {
		fetchSettings,
		patchSettings,
		type ClientSettings,
		type LastSeenVisibility,
		type ProfileVisibility,
		type WhoCanMessage
	} from '$lib/settings';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	const i18n = useI18n();
	let settings = $state<ClientSettings | null>(null);

	onMount(async () => {
		settings = await fetchSettings();
	});

	async function setLastSeen(v: LastSeenVisibility) {
		settings = await patchSettings({ lastSeenVisibility: v });
	}

	async function setWho(v: WhoCanMessage) {
		settings = await patchSettings({ whoCanMessage: v });
	}

	async function setProfileVis(v: ProfileVisibility) {
		settings = await patchSettings({ profileVisibility: v });
	}

	async function toggle(key: 'readReceipts' | 'showTyping' | 'lastSeenReciprocity') {
		if (!settings) return;
		settings = await patchSettings({ [key]: !settings[key] });
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.privacy')}</h1>
	</header>

	<div class="settings-body">
		{#if settings}
			<section class="settings-section">
				<h2>{i18n.t('settings.lastSeen')}</h2>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills stacked-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={settings.lastSeenVisibility === 'everyone'}
								onclick={() => setLastSeen('everyone')}>{i18n.t('settings.lastSeenEveryone')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.lastSeenVisibility === 'chats'}
								onclick={() => setLastSeen('chats')}>{i18n.t('settings.lastSeenChats')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.lastSeenVisibility === 'nobody'}
								onclick={() => setLastSeen('nobody')}>{i18n.t('settings.lastSeenNobody')}</button
							>
						</div>
					</div>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.lastSeenReciprocity')}</span>
							<span class="hint">{i18n.t('settings.lastSeenReciprocityHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.lastSeenReciprocity}
							onchange={() => toggle('lastSeenReciprocity')}
						/>
					</label>
				</div>
			</section>

			<section class="settings-section">
				<h2>{i18n.t('settings.whoCanMessage')}</h2>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills stacked-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={settings.whoCanMessage === 'everyone'}
								onclick={() => setWho('everyone')}>{i18n.t('settings.whoEveryone')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.whoCanMessage === 'chats'}
								onclick={() => setWho('chats')}>{i18n.t('settings.whoChats')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.whoCanMessage === 'nobody'}
								onclick={() => setWho('nobody')}>{i18n.t('settings.whoNobody')}</button
							>
						</div>
					</div>
				</div>
			</section>

			<section class="settings-section">
				<h2>{i18n.t('settings.profileVisibility')}</h2>
				<p class="settings-section-hint">{i18n.t('settings.profileVisibilityHint')}</p>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills stacked-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={settings.profileVisibility === 'everyone'}
								onclick={() => setProfileVis('everyone')}>{i18n.t('settings.lastSeenEveryone')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.profileVisibility === 'chats'}
								onclick={() => setProfileVis('chats')}>{i18n.t('settings.lastSeenChats')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={settings.profileVisibility === 'nobody'}
								onclick={() => setProfileVis('nobody')}>{i18n.t('settings.lastSeenNobody')}</button
							>
						</div>
					</div>
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-card soft">
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.readReceipts')}</span>
							<span class="hint">{i18n.t('settings.readReceiptsHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.readReceipts}
							onchange={() => toggle('readReceipts')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.showTyping')}</span>
							<span class="hint">{i18n.t('settings.showTypingHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.showTyping}
							onchange={() => toggle('showTyping')}
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>
</div>
