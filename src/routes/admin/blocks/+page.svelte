<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { adminConfirm, adminToast } from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let busyKey = $state<string | null>(null);

	async function remove(blockerId: string, blockedId: string) {
		if (!(await adminConfirm(i18n.t('admin.removeBlockConfirm')))) return;
		const key = `${blockerId}:${blockedId}`;
		busyKey = key;
		try {
			const res = await fetch('/api/admin/blocks', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ blockerId, blockedId })
			});
			if (!res.ok) {
				const json = await res.json();
				adminToast(json.error || 'Error', 'err');
				return;
			}
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busyKey = null;
		}
	}

	function goPage(p: number) {
		goto(p > 1 ? `/admin/blocks?page=${p}` : '/admin/blocks');
	}
</script>

<section class="admin-section">
	<h2>{i18n.t('admin.navBlocks')}</h2>
	<p class="admin-lead">{i18n.t('admin.blocksLead')}</p>
	<p class="admin-meta">{i18n.t('admin.blocksCount', { n: String(data.total) })}</p>

	{#if data.blocks.length === 0}
		<p class="admin-empty">{i18n.t('admin.blocksEmpty')}</p>
	{:else}
		<div class="admin-list">
			{#each data.blocks as row}
				{@const key = `${row.blockerId}:${row.blockedId}`}
				<div class="admin-block-row">
					<div class="admin-block-copy">
						<p>
							<a href="/admin/users/{row.blockerId}">@{row.blockerUsername}</a>
							<span class="admin-arrow">→</span>
							<a href="/admin/users/{row.blockedId}">@{row.blockedUsername}</a>
						</p>
						<span class="admin-user-sub">{formatRelativeTime(row.createdAt, i18n.locale)}</span>
					</div>
					<button
						class="btn btn-ghost"
						type="button"
						disabled={busyKey === key}
						onclick={() => remove(row.blockerId, row.blockedId)}
					>
						{i18n.t('admin.removeBlock')}
					</button>
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
