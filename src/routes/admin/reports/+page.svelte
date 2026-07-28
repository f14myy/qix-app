<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let busy = $state<string | null>(null);

	async function resolve(id: string) {
		busy = id;
		try {
			await fetch('/api/admin/reports', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id })
			});
			await invalidateAll();
		} finally {
			busy = null;
		}
	}
</script>

<section class="admin-section">
	<div class="admin-page-head">
		<h2>{i18n.t('admin.navReports')}</h2>
		<p class="admin-lead">{i18n.t('admin.reportsLead')}</p>
	</div>

	{#if data.reports.length === 0}
		<p class="hint">{i18n.t('admin.reportsEmpty')}</p>
	{:else}
		<div class="admin-list">
			{#each data.reports as r (r.id)}
				<article class="admin-card">
					<p>
						<strong>@{r.reporter.username}</strong>
						→
						<strong>@{r.reported.username}</strong>
					</p>
					<p class="hint">{r.reason}</p>
					<p class="hint">{formatRelativeTime(r.createdAt, i18n.locale)}</p>
					<button
						class="btn btn-ghost"
						type="button"
						disabled={busy === r.id}
						onclick={() => resolve(r.id)}>{i18n.t('admin.reportsResolve')}</button
					>
				</article>
			{/each}
		</div>
	{/if}
</section>
