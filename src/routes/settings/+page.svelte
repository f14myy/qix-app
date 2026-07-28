<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Bell from '@lucide/svelte/icons/bell';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Palette from '@lucide/svelte/icons/palette';
	import Shield from '@lucide/svelte/icons/shield';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Ban from '@lucide/svelte/icons/ban';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Avatar from '$lib/components/Avatar.svelte';
	import { isAdmin } from '$lib/admin';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { dismissInstallTip, isStandaloneDisplay, shouldShowInstallTip } from '$lib/pwa';
	import { forgetLogin } from '$lib/net/auth';
	import { invalidateSessionUser } from '../+layout';
	import CoachTip from '$lib/components/CoachTip.svelte';
	import { dismissCoach, markCoachShown, shouldShowCoach } from '$lib/coach';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let showInstall = $state(false);
	let standalone = $state(false);
	let showSettingsCoach = $state(false);
	const meTitle = $derived(data.user?.displayName || data.user?.username || '');
	const showAdmin = $derived(isAdmin(data.user));

	onMount(() => {
		standalone = isStandaloneDisplay();
		showInstall = shouldShowInstallTip();
		try {
			if (shouldShowCoach('qix-hint-settings')) {
				showSettingsCoach = true;
				markCoachShown('qix-hint-settings');
			}
		} catch {
			/* ignore */
		}
	});

	function hideInstall() {
		dismissInstallTip();
		showInstall = false;
	}

	async function logout() {
		// No service worker here, so there is no push endpoint to unregister —
		// background delivery is torn down by `forgetLogin()` instead.
		await fetch('/api/auth/logout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ endpoint: '' })
		});
		await forgetLogin();
		invalidateSessionUser();
		await goto('/login', { invalidateAll: true });
	}

	const nav = [
		{ href: '/settings/appearance', icon: Palette, label: 'settings.navAppearance' },
		{ href: '/settings/notifications', icon: Bell, label: 'settings.navNotifications' },
		{ href: '/settings/chats', icon: MessageSquare, label: 'settings.navChats' },
		{ href: '/settings/privacy', icon: Shield, label: 'settings.navPrivacy' },
		{ href: '/settings/invite', icon: Link2, label: 'settings.navInvite' },
		{ href: '/settings/blocked', icon: Ban, label: 'settings.navBlocked' }
	] as const;
</script>

<div class="screen settings-screen">
	<header class="topbar">
		<h1>{i18n.t('settings.title')}</h1>
	</header>

	<div class="settings-body">
		{#if showSettingsCoach}
			<CoachTip
				class="list-coach"
				actionLabel={i18n.t('coach.gotIt')}
				ondismiss={() => {
					showSettingsCoach = false;
					dismissCoach('qix-hint-settings');
				}}
			>
				{#snippet icon()}
					<Palette size={20} />
				{/snippet}
				<p>{i18n.t('coach.settings')}</p>
			</CoachTip>
		{/if}
		{#if standalone}
			<section class="settings-section install-section">
				<div class="install-tip installed">
					<span class="install-ico"><Smartphone size={20} /></span>
					<p>{i18n.t('settings.installInstalled')}</p>
				</div>
			</section>
		{:else if showInstall}
			<section class="settings-section install-section">
				<div class="install-tip">
					<span class="install-ico"><Smartphone size={22} /></span>
					<div class="install-copy">
						<strong>{i18n.t('settings.installTitle')}</strong>
						<p>{i18n.t('settings.installBody')}</p>
					</div>
					<button class="btn btn-ghost install-dismiss" type="button" onclick={hideInstall}>
						{i18n.t('settings.installDismiss')}
					</button>
				</div>
			</section>
		{/if}

		<section class="settings-section">
			<h2>{i18n.t('settings.sectionAccount')}</h2>
			<a class="settings-profile-card" href="/u/{data.user?.username}">
				<Avatar
					name={meTitle}
					size={60}
					avatarPath={data.user?.avatarPath ?? null}
					userId={data.user?.id}
				/>
				<div class="settings-profile-copy">
					<strong>{meTitle}</strong>
					<span>@{data.user?.username}</span>
					<span class="hint">{i18n.t('settings.viewProfile')}</span>
				</div>
				<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
			</a>
			<div class="settings-card soft" style="margin-top:10px">
				<a class="settings-row link-row settings-nav-row" href="/settings/profile">
					<span class="settings-nav-icon"><UserRound size={18} /></span>
					<span class="label">{i18n.t('settings.editProfile')}</span>
					<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
				</a>
				<a class="settings-row link-row settings-nav-row" href="/settings/security">
					<span class="settings-nav-icon"><KeyRound size={18} /></span>
					<span class="label">{i18n.t('settings.navSecurity')}</span>
					<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
				</a>
			</div>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('settings.sectionPrefs')}</h2>
			<div class="settings-card soft">
				{#each nav.slice(0, 3) as item}
					{@const Icon = item.icon}
					<a class="settings-row link-row settings-nav-row" href={item.href}>
						<span class="settings-nav-icon"><Icon size={18} /></span>
						<span class="label">{i18n.t(item.label)}</span>
						<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
					</a>
				{/each}
			</div>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('settings.sectionSafety')}</h2>
			<div class="settings-card soft">
				{#each nav.slice(3) as item}
					{@const Icon = item.icon}
					<a class="settings-row link-row settings-nav-row" href={item.href}>
						<span class="settings-nav-icon"><Icon size={18} /></span>
						<span class="label">{i18n.t(item.label)}</span>
						<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
					</a>
				{/each}
			</div>
		</section>

		{#if showAdmin}
			<section class="settings-section">
				<h2>{i18n.t('settings.sectionAdmin')}</h2>
				<div class="settings-card soft">
					<a class="settings-row link-row settings-nav-row" href="/admin">
						<span class="settings-nav-icon"><ShieldCheck size={18} /></span>
						<span class="label">{i18n.t('settings.navAdmin')}</span>
						<span class="settings-nav-chevron"><ChevronRight size={18} /></span>
					</a>
				</div>
			</section>
		{/if}

		<section class="settings-section">
			<button class="btn btn-block btn-danger-outline" type="button" onclick={logout}
				>{i18n.t('settings.logout')}</button
			>
		</section>
	</div>
</div>
