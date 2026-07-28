<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Avatar from '$lib/components/Avatar.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { ADMIN_USERNAME } from '$lib/admin';
	import { adminConfirm, adminToast } from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { mediaUrl } from '$lib/net/media';
	import { formatLastSeen, formatRelativeTime, isOnlineIso } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let busy = $state(false);
	let banReason = $state('');
	let showBan = $state(false);

	const u = $derived(data.profile);
	const title = $derived(u.displayName || u.username);
	const isProtected = $derived(u.username === ADMIN_USERNAME);

	async function post(action: string, extra: Record<string, unknown> = {}) {
		busy = true;
		try {
			const res = await fetch(`/api/admin/users/${u.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, ...extra })
			});
			const json = await res.json();
			if (!res.ok) {
				adminToast(json.error || 'Error', 'err');
				return false;
			}
			showBan = false;
			banReason = '';
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
			return true;
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!(await adminConfirm(i18n.t('admin.deleteConfirm', { user: u.username })))) return;
		busy = true;
		try {
			const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
			const json = await res.json();
			if (!res.ok) {
				adminToast(json.error || 'Error', 'err');
				return;
			}
			adminToast(i18n.t('admin.deleted'));
			await goto('/admin/users');
		} finally {
			busy = false;
		}
	}
</script>

<section class="admin-section">
	<a class="admin-back" href="/admin/users">
		<ArrowLeft size={16} />
		{i18n.t('admin.navUsers')}
	</a>

	<div class="admin-detail-hero">
		<div class="profile-banner admin-user-banner" data-banner={u.bannerKey} aria-hidden="true">
			{#if u.bannerPath}
				<img
					class="profile-banner-img"
					src={mediaUrl(`/api/banners/${u.id}?v=${u.bannerPath}`)}
					alt=""
				/>
			{/if}
		</div>
		<div class="admin-detail-avatar-wrap">
			<Avatar
				name={title}
				size={80}
				avatarPath={u.avatarPath}
				userId={u.id}
				online={u.online && !u.bannedAt}
			/>
		</div>
		<h2>
			<NameWithBadges name={title} badges={u.badges} size="lg" />
		</h2>
		<p>@{u.username}</p>
		{#if u.bannedAt}
			<span class="admin-chip banned">{i18n.t('admin.chipBanned')}</span>
		{:else if u.online}
			<span class="admin-chip online">{i18n.t('admin.chipOnline')}</span>
		{/if}
		{#if u.bio}
			<p class="admin-detail-bio">{u.bio}</p>
		{/if}
	</div>

	<div class="profile-meta admin-detail-meta">
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('profile.joined')}</span>
			<span class="profile-meta-value">{formatRelativeTime(u.createdAt, i18n.locale)}</span>
		</div>
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('admin.lastSeen')}</span>
			<span class="profile-meta-value">
				{#if isOnlineIso(u.lastSeenAt)}
					{i18n.t('chat.online')}
				{:else if u.lastSeenAt}
					{formatLastSeen(u.lastSeenAt, i18n.locale)}
				{:else}
					—
				{/if}
			</span>
		</div>
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('admin.stat.messages')}</span>
			<span class="profile-meta-value">{u.messageCount}</span>
		</div>
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('admin.stat.chats')}</span>
			<span class="profile-meta-value">{u.chatCount}</span>
		</div>
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('admin.sessions')}</span>
			<span class="profile-meta-value">{u.sessionCount}</span>
		</div>
		<div class="profile-meta-row">
			<span class="profile-meta-label">{i18n.t('admin.blocking')}</span>
			<span class="profile-meta-value">{u.blockingCount} / {u.blockedByCount}</span>
		</div>
		{#if u.bannedAt}
			<div class="profile-meta-row">
				<span class="profile-meta-label">{i18n.t('admin.banReason')}</span>
				<span class="profile-meta-value">{u.bannedReason || '—'}</span>
			</div>
		{/if}
	</div>

	<div class="admin-actions" style="margin-top:16px">
		<a class="btn btn-ghost btn-block" href="/u/{u.username}">{i18n.t('profile.viewPublic')}</a>

		{#if !isProtected}
			{#if u.bannedAt}
				<button class="btn btn-block" type="button" disabled={busy} onclick={() => post('unban')}>
					{i18n.t('admin.unban')}
				</button>
			{:else if showBan}
				<div class="admin-ban-form">
					<label for="banReason">{i18n.t('admin.banReason')}</label>
					<input id="banReason" maxlength="200" bind:value={banReason} placeholder={i18n.t('admin.banReasonPh')} />
					<button
						class="btn btn-block btn-danger"
						type="button"
						disabled={busy}
						onclick={() => post('ban', { reason: banReason })}
					>
						{i18n.t('admin.confirmBan')}
					</button>
					<button class="btn btn-ghost btn-block" type="button" onclick={() => (showBan = false)}>
						{i18n.t('admin.cancel')}
					</button>
				</div>
			{:else}
				<button class="btn btn-block btn-danger" type="button" disabled={busy} onclick={() => (showBan = true)}>
					{i18n.t('admin.ban')}
				</button>
			{/if}

			<button
				class="btn btn-ghost btn-block"
				type="button"
				disabled={busy}
				onclick={async () => {
					if (await adminConfirm(i18n.t('admin.revokeConfirm'))) post('revoke-sessions');
				}}
			>
				{i18n.t('admin.revokeSessions')}
			</button>

			<button class="btn btn-ghost btn-block admin-danger-text" type="button" disabled={busy} onclick={remove}>
				{i18n.t('admin.deleteUser')}
			</button>
		{:else}
			<p class="admin-protected">{i18n.t('admin.protected')}</p>
		{/if}
	</div>
</section>
