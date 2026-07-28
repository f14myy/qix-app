<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import Avatar from '$lib/components/Avatar.svelte';
	import type { AdminUserFilter, AdminUserSort } from '$lib/admin';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let q = $state(page.url.searchParams.get('q') ?? '');

	const filters: AdminUserFilter[] = ['all', 'online', 'banned', 'badge', 'new'];
	const sorts: AdminUserSort[] = ['created', 'messages', 'seen'];

	function buildUrl(opts: {
		page?: number;
		filter?: AdminUserFilter;
		sort?: AdminUserSort;
		q?: string;
	}) {
		const params = new URLSearchParams();
		const query = opts.q ?? q;
		const filter = opts.filter ?? data.filter;
		const sort = opts.sort ?? data.sort;
		const p = opts.page ?? 1;
		if (query.trim()) params.set('q', query.trim());
		if (filter !== 'all') params.set('filter', filter);
		if (sort !== 'created') params.set('sort', sort);
		if (p > 1) params.set('page', String(p));
		const qs = params.toString();
		return `/admin/users${qs ? `?${qs}` : ''}`;
	}

	function search(e: Event) {
		e.preventDefault();
		goto(buildUrl({ page: 1, q }));
	}

	function setFilter(filter: AdminUserFilter) {
		goto(buildUrl({ page: 1, filter }));
	}

	function setSort(sort: AdminUserSort) {
		goto(buildUrl({ page: 1, sort }));
	}

	function goPage(p: number) {
		goto(buildUrl({ page: p }));
	}
</script>

<section class="admin-section">
	<form class="admin-search" onsubmit={search}>
		<span class="admin-search-ico"><Search size={18} /></span>
		<input
			type="search"
			bind:value={q}
			placeholder={i18n.t('admin.searchUsers')}
			autocomplete="off"
		/>
		<button class="btn" type="submit">{i18n.t('admin.search')}</button>
	</form>

	<div class="admin-filter-row" role="tablist" aria-label={i18n.t('admin.filter')}>
		{#each filters as f}
			<button
				type="button"
				class="admin-chip-btn"
				class:active={data.filter === f}
				onclick={() => setFilter(f)}
			>
				{i18n.t(`admin.filter.${f}`)}
			</button>
		{/each}
	</div>

	<div class="admin-sort-row">
		<span class="admin-sort-label">{i18n.t('admin.sort')}</span>
		{#each sorts as s}
			<button
				type="button"
				class="admin-chip-btn ghost"
				class:active={data.sort === s}
				onclick={() => setSort(s)}
			>
				{i18n.t(`admin.sort.${s}`)}
			</button>
		{/each}
	</div>

	<p class="admin-meta">{i18n.t('admin.usersCount', { n: String(data.total) })}</p>
</section>

<section class="admin-section admin-section-tight">
	{#if data.users.length === 0}
		<div class="admin-empty-card">
			<p class="admin-empty">{i18n.t('admin.usersEmpty')}</p>
		</div>
	{:else}
		<div class="admin-list">
			{#each data.users as user}
				<a class="admin-user-row" href="/admin/users/{user.id}">
					<Avatar
						name={user.displayName || user.username}
						size={44}
						avatarPath={user.avatarPath}
						userId={user.id}
						online={user.online && !user.bannedAt}
					/>
					<div class="admin-user-copy">
						<div class="admin-user-top">
							<strong>{user.displayName || user.username}</strong>
							{#if user.bannedAt}
								<span class="admin-chip banned">{i18n.t('admin.chipBanned')}</span>
							{:else if user.online}
								<span class="admin-chip online">{i18n.t('admin.chipOnline')}</span>
							{/if}
						</div>
						<span class="admin-user-sub">@{user.username} · {user.messageCount} msg</span>
						<span class="admin-user-sub">{formatRelativeTime(user.createdAt, i18n.locale)}</span>
					</div>
				</a>
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
