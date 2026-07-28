<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import { adminConfirm, adminToast } from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let busyId = $state<string | null>(null);

	async function unban(id: string) {
		if (!(await adminConfirm(i18n.t('admin.unbanConfirm')))) return;
		busyId = id;
		try {
			const res = await fetch(`/api/admin/users/${id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'unban' })
			});
			if (!res.ok) {
				const json = await res.json();
				adminToast(json.error || 'Error', 'err');
				return;
			}
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busyId = null;
		}
	}
</script>

<section class="admin-section">
	<h2>{i18n.t('admin.navBans')}</h2>
	<p class="admin-lead">{i18n.t('admin.bansLead')}</p>

	{#if data.bans.length === 0}
		<p class="admin-empty">{i18n.t('admin.bansEmpty')}</p>
	{:else}
		<div class="admin-list">
			{#each data.bans as user}
				<div class="admin-user-row static">
					<a href="/admin/users/{user.id}" class="admin-user-row-link">
						<Avatar
							name={user.displayName || user.username}
							size={44}
							avatarPath={user.avatarPath}
							userId={user.id}
						/>
						<div class="admin-user-copy">
							<strong>{user.displayName || user.username}</strong>
							<span class="admin-user-sub">@{user.username}</span>
							<span class="admin-user-sub">
								{user.bannedReason || i18n.t('admin.noReason')}
								{#if user.bannedAt}
									· {formatRelativeTime(user.bannedAt, i18n.locale)}
								{/if}
							</span>
						</div>
					</a>
					<button
						class="btn btn-ghost"
						type="button"
						disabled={busyId === user.id}
						onclick={() => unban(user.id)}
					>
						{i18n.t('admin.unban')}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>
