<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Avatar from '$lib/components/Avatar.svelte';
	import { confirmDialog } from '$lib/flash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	type Blocked = {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
		blockedAt: string;
	};

	const i18n = useI18n();
	let blocked = $state<Blocked[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const res = await fetch('/api/me/blocked');
		const json = await res.json();
		if (res.ok) blocked = json.blocked;
		loading = false;
	});

	async function unblock(user: Blocked) {
		if (!(await confirmDialog(i18n.t('settings.unblockConfirm', { user: user.username })))) return;
		const res = await fetch(`/api/me/blocked/${user.id}`, { method: 'DELETE' });
		const json = await res.json();
		if (res.ok) blocked = json.blocked;
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.blocked')}</h1>
	</header>

	<div class="settings-body">
		{#if loading}
			<div class="empty empty-animate"><p>…</p></div>
		{:else if blocked.length === 0}
			<div class="empty empty-animate">
				<p>{i18n.t('settings.blockedEmpty')}</p>
			</div>
		{:else}
			<section class="settings-section">
				<div class="settings-card soft">
					{#each blocked as user (user.id)}
						<div class="settings-row blocked-row">
							<a class="blocked-user" href="/u/{user.username}">
								<Avatar
									name={user.displayName || user.username}
									size={42}
									avatarPath={user.avatarPath}
									userId={user.id}
								/>
								<span class="blocked-meta">
									<span class="label">{user.displayName || user.username}</span>
									<span class="hint">@{user.username}</span>
								</span>
							</a>
							<button class="btn btn-ghost blocked-unblock-btn" type="button" onclick={() => unblock(user)}>
								<ShieldCheck size={16} />
								{i18n.t('settings.unblock')}
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
