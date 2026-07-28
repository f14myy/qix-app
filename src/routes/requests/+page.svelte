<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Avatar from '$lib/components/Avatar.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let busy = $state<string | null>(null);

	async function act(id: string, action: 'accept' | 'decline') {
		busy = id;
		try {
			const res = await fetch('/api/requests', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, action })
			});
			const json = await res.json();
			if (res.ok && action === 'accept' && json.chatId) {
				await goto(`/chat/${json.chatId}`);
				return;
			}
			await invalidateAll();
		} finally {
			busy = null;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<h1>{i18n.t('requests.title')}</h1>
	</header>

	<div class="settings-body">
		{#if data.requests.length === 0}
			<div class="empty empty-animate">
				<span class="empty-icon"><Inbox size={28} /></span>
				<strong>{i18n.t('requests.title')}</strong>
				<p>{i18n.t('requests.empty')}</p>
			</div>
		{:else}
			<div class="request-list">
				{#each data.requests as req (req.id)}
					<article class="request-card">
						<div class="request-head">
							{#if req.from}
								<Avatar
									name={req.from.displayName || req.from.username}
									avatarPath={req.from.avatarPath}
									userId={req.from.id}
									size={44}
								/>
							{/if}
							<div class="request-meta">
								<strong>{req.from?.displayName || req.from?.username || '?'}</strong>
								<span class="request-sub">
									{#if req.from}@{req.from.username} ·{/if}
									{formatRelativeTime(req.createdAt, i18n.locale)}
								</span>
							</div>
						</div>
						{#if req.note}
							<p class="request-note">{req.note}</p>
						{/if}
						<div class="request-actions">
							<button
								class="btn"
								type="button"
								disabled={busy === req.id}
								onclick={() => act(req.id, 'accept')}>{i18n.t('requests.accept')}</button
							>
							<button
								class="btn btn-quiet"
								type="button"
								disabled={busy === req.id}
								onclick={() => act(req.id, 'decline')}>{i18n.t('requests.decline')}</button
							>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</div>
