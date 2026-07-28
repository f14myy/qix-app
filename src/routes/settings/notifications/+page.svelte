<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { fetchSettings, patchSettings, type ClientSettings } from '$lib/settings';
	import { ensureNotificationPermission, subscribeWebPush } from '$lib/notify';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	const i18n = useI18n();
	let settings = $state<ClientSettings | null>(null);
	let permission = $state<NotificationPermission | 'unsupported'>('default');

	onMount(async () => {
		settings = await fetchSettings();
		if (typeof window !== 'undefined' && 'Notification' in window) {
			permission = Notification.permission;
			if (permission === 'granted') await subscribeWebPush();
		} else {
			permission = 'unsupported';
		}
	});

	async function toggle(key: 'notifyMessages' | 'notifyReactions' | 'notifySound') {
		if (!settings) return;
		settings = await patchSettings({ [key]: !settings[key] });
	}

	async function requestPerm() {
		permission = await ensureNotificationPermission();
		if (permission === 'granted') await subscribeWebPush();
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.notifications')}</h1>
	</header>

	<div class="settings-body">
		{#if permission !== 'unsupported'}
			<section class="settings-section">
				<div class="settings-card soft">
					{#if permission === 'granted'}
						<div class="settings-row">
							<span class="toggle-copy">
								<span class="label">{i18n.t('settings.notifyPermissionGranted')}</span>
							</span>
							<span class="value ok-dot" aria-hidden="true">●</span>
						</div>
					{:else if permission === 'denied'}
						<div class="settings-row">
							<span class="toggle-copy">
								<span class="label">{i18n.t('settings.notifyPermissionDenied')}</span>
							</span>
						</div>
					{:else}
						<button class="settings-row link-row" type="button" onclick={requestPerm}>
							<span class="toggle-copy">
								<span class="label">{i18n.t('settings.notifyPermission')}</span>
							</span>
							<span class="value">→</span>
						</button>
					{/if}
				</div>
			</section>
		{/if}

		{#if settings}
			<section class="settings-section">
				<h2>{i18n.t('settings.notifications')}</h2>
				<div class="settings-card soft">
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.notifyMessages')}</span>
							<span class="hint">{i18n.t('settings.notifyMessagesHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.notifyMessages}
							onchange={() => toggle('notifyMessages')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.notifyReactions')}</span>
							<span class="hint">{i18n.t('settings.notifyReactionsHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.notifyReactions}
							onchange={() => toggle('notifyReactions')}
						/>
					</label>
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('settings.notifySound')}</span>
							<span class="hint">{i18n.t('settings.notifySoundHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={settings.notifySound}
							onchange={() => toggle('notifySound')}
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>
</div>
