<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Ban from '@lucide/svelte/icons/ban';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Share2 from '@lucide/svelte/icons/share-2';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Avatar from '$lib/components/Avatar.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { confirmDialog, toast } from '$lib/flash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { mediaUrl } from '$lib/net/media';
	import { goBack } from '$lib/nav';
	import { profileThemeVars, resolveProfileTheme } from '$lib/profileTheme';
	import { formatLastSeen, isOnlineIso } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let loading = $state(false);
	let blocking = $state(false);
	let blockedByMe = $state(false);
	let copied = $state(false);

	$effect(() => {
		blockedByMe = data.blockedByMe;
	});

	const title = $derived(data.profile.displayName || data.profile.username);
	const online = $derived(isOnlineIso(data.profile.lastSeenAt));
	/**
	 * The owner's own colour for this page — sampled from their banner, or picked
	 * by them. Null when they have none, in which case the page keeps the viewer's
	 * look untouched.
	 */
	const tint = $derived(resolveProfileTheme(data.profile));
	const status = $derived(
		online
			? i18n.t('chat.online')
			: data.profile.lastSeenAt
				? i18n.t('chat.lastSeen', { when: formatLastSeen(data.profile.lastSeenAt, i18n.locale) })
				: ''
	);

	const joined = $derived(
		new Date(data.profile.createdAt).toLocaleDateString(i18n.locale === 'ru' ? 'ru-RU' : 'en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	async function openChat() {
		if (data.existingChatId) {
			await goto(`/chat/${data.existingChatId}`);
			return;
		}
		loading = true;
		try {
			const res = await fetch('/api/chats', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ peerUsername: data.profile.username })
			});
			const json = await res.json();
			if (res.status === 202 || json.pending) {
				toast(i18n.t('requests.sent'));
				return;
			}
			if (res.ok) await goto(`/chat/${json.chatId}`);
			else toast(json.error || i18n.t('common.error'), 'err');
		} finally {
			loading = false;
		}
	}

	async function toggleBlock() {
		const name = data.profile.username;
		if (blockedByMe) {
			if (!(await confirmDialog(i18n.t('settings.unblockConfirm', { user: name })))) return;
			blocking = true;
			try {
				const res = await fetch(`/api/me/blocked/${data.profile.id}`, { method: 'DELETE' });
				if (res.ok) blockedByMe = false;
			} finally {
				blocking = false;
			}
		} else {
			if (!(await confirmDialog(i18n.t('settings.blockConfirm', { user: name })))) return;
			blocking = true;
			try {
				const res = await fetch('/api/me/blocked', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ userId: data.profile.id })
				});
				if (res.ok) blockedByMe = true;
			} finally {
				blocking = false;
			}
		}
	}

	async function copyUsername() {
		try {
			await navigator.clipboard.writeText(`@${data.profile.username}`);
			copied = true;
			toast(`@${data.profile.username}`);
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* ignore */
		}
	}

	async function shareProfile() {
		const url = `${window.location.origin}/u/${data.profile.username}`;
		if (navigator.share) {
			try {
				await navigator.share({ title: title, url });
				return;
			} catch {
				/* fallback to clipboard */
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			toast(i18n.t('common.copied') || 'Link copied');
		} catch {
			/* ignore */
		}
	}
</script>

<div class="screen profile-screen">
	<header class="topbar topbar-over-media">
		<button type="button" class="icon-btn icon-btn-glass" aria-label={i18n.t('back')} onclick={() => goBack('/')}>
			<ArrowLeft size={20} />
		</button>
		<span class="topbar-spacer"></span>
		<button type="button" class="icon-btn icon-btn-glass" aria-label="Share" onclick={shareProfile}>
			<Share2 size={18} />
		</button>
	</header>

	<div class="profile-page" class:is-tinted={!!tint} style={profileThemeVars(tint)}>
		<div
			class="profile-banner"
			class:is-tinted={!!tint}
			data-banner={data.profile.bannerKey}
			aria-hidden="true"
		>
			{#if data.profile.bannerPath}
				<img
					class="profile-banner-img"
					src={mediaUrl(`/api/banners/${data.profile.id}?v=${data.profile.bannerPath}`)}
					alt=""
				/>
			{/if}
			<span class="profile-banner-shade"></span>
		</div>

		<div class="profile-view">
			<div class="profile-identity">
				<div class="profile-avatar-stage" class:online>
					<Avatar
						name={title}
						size={104}
						avatarPath={data.profile.avatarPath}
						userId={data.profile.id}
						{online}
					/>
				</div>

				{#if data.isSelf}
					<a class="btn btn-ghost profile-edit-pill" href="/settings/profile">
						<Pencil size={16} />
						{i18n.t('settings.profile')}
					</a>
				{:else if !blockedByMe && !data.blocked}
					<button class="btn profile-edit-pill" type="button" disabled={loading} onclick={openChat}>
						<MessageCircle size={16} />
						{data.existingChatId ? i18n.t('profile.openChat') : i18n.t('profile.message')}
					</button>
				{/if}
			</div>

			<div class="profile-copy">
				<h1 class="profile-name">
					<NameWithBadges name={title} badges={data.profile.badges} size="lg" showLabels={true} />
				</h1>

				<button type="button" class="profile-user-btn" class:copied onclick={copyUsername}>
					<span>@{data.profile.username}</span>
					{#if copied}
						<Check size={14} />
					{:else}
						<Copy size={14} />
					{/if}
				</button>

				{#if status}
					<p class="peer-status profile-status" class:online>
						{#if online}<span class="online-dot" aria-hidden="true"></span>{/if}
						{status}
					</p>
				{/if}
			</div>

			{#if data.profile.bio}
				<div class="profile-card profile-bio-card">
					<p class="profile-bio">{data.profile.bio}</p>
				</div>
			{:else if data.isSelf}
				<div class="profile-card profile-bio-card empty">
					<a class="profile-bio profile-bio-empty" href="/settings/profile">
						{i18n.t('profile.bioEmpty')}
					</a>
				</div>
			{/if}

			<div class="profile-card profile-info-card">
				<div class="profile-info-row">
					<span class="profile-info-icon"><Calendar size={16} /></span>
					<span class="profile-info-label">{i18n.t('profile.joined')}</span>
					<span class="profile-info-value">{joined}</span>
				</div>
			</div>

			{#if blockedByMe}
				<p class="blocked-banner">{i18n.t('settings.blockedBanner')}</p>
			{/if}

			{#if !data.isSelf}
				<div class="profile-actions">
					<button
						class="btn btn-block profile-action-block"
						class:is-blocked={blockedByMe}
						type="button"
						disabled={blocking}
						onclick={toggleBlock}
					>
						{#if blockedByMe}
							<ShieldCheck size={18} />
						{:else}
							<Ban size={18} />
						{/if}
						{blockedByMe ? i18n.t('settings.unblock') : i18n.t('settings.block')}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
