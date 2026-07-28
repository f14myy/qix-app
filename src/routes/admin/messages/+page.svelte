<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { adminConfirm, adminToast } from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let q = $state(page.url.searchParams.get('q') ?? '');
	let username = $state(page.url.searchParams.get('username') ?? '');
	let busyId = $state<string | null>(null);

	function search(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (q.trim()) params.set('q', q.trim());
		if (username.trim()) params.set('username', username.trim().toLowerCase());
		const qs = params.toString();
		goto(`/admin/messages${qs ? `?${qs}` : ''}`);
	}

	function goPage(p: number) {
		const params = new URLSearchParams();
		if (q.trim()) params.set('q', q.trim());
		if (username.trim()) params.set('username', username.trim().toLowerCase());
		if (p > 1) params.set('page', String(p));
		const qs = params.toString();
		goto(`/admin/messages${qs ? `?${qs}` : ''}`);
	}

	async function softDelete(id: string) {
		if (!(await adminConfirm(i18n.t('admin.deleteMsgConfirm')))) return;
		busyId = id;
		try {
			const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
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

	function preview(body: string, kind: string, deleted: boolean) {
		if (deleted) return i18n.t('chats.deleted');
		if (kind === 'voice') return i18n.t('chats.voice');
		return body || i18n.t('chats.attachment');
	}
</script>

<section class="admin-section">
	<form class="admin-search stacked" onsubmit={search}>
		<div class="admin-search-row">
			<span class="admin-search-ico"><Search size={18} /></span>
			<input type="search" bind:value={q} placeholder={i18n.t('admin.searchMessages')} />
		</div>
		<input type="search" bind:value={username} placeholder={i18n.t('admin.filterUsername')} />
		<button class="btn" type="submit">{i18n.t('admin.search')}</button>
	</form>
	<p class="admin-meta">{i18n.t('admin.messagesCount', { n: String(data.total) })}</p>
</section>

<section class="admin-section">
	{#if data.messages.length === 0}
		<p class="admin-empty">{i18n.t('admin.messagesEmpty')}</p>
	{:else}
		<div class="admin-list">
			{#each data.messages as msg}
				<div class="admin-msg-row" class:deleted={!!msg.deletedAt}>
					<div class="admin-msg-copy">
						<div class="admin-user-top">
							<a href="/admin/users/{msg.sender.id}">
								@{msg.sender.username}
							</a>
							<span class="admin-user-sub">{formatRelativeTime(msg.createdAt, i18n.locale)}</span>
						</div>
						<p class="admin-msg-body">{preview(msg.body, msg.kind, !!msg.deletedAt)}</p>
						<span class="admin-user-sub">chat {msg.chatId.slice(0, 8)} · {msg.kind}</span>
					</div>
					{#if !msg.deletedAt}
						<button
							class="icon-btn"
							type="button"
							disabled={busyId === msg.id}
							aria-label={i18n.t('admin.deleteMsg')}
							onclick={() => softDelete(msg.id)}
						>
							<Trash2 size={18} />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if data.pages > 1}
		<div class="admin-pager">
			<button class="btn btn-ghost" type="button" disabled={data.page <= 1} onclick={() => goPage(data.page - 1)}>
				{i18n.t('admin.prev')}
			</button>
			<span>{data.page} / {data.pages}</span>
			<button
				class="btn btn-ghost"
				type="button"
				disabled={data.page >= data.pages}
				onclick={() => goPage(data.page + 1)}
			>
				{i18n.t('admin.next')}
			</button>
		</div>
	{/if}
</section>
