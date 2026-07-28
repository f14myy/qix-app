<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import { BADGE_COLOR_PRESETS } from '$lib/badges';
	import { adminConfirm, adminToast } from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let label = $state('');
	let color = $state<string>(BADGE_COLOR_PRESETS[0]);
	let busy = $state(false);
	let grantDrafts = $state<Record<string, string>>({});

	async function create(e: Event) {
		e.preventDefault();
		if (!label.trim() || busy) return;
		busy = true;
		try {
			const res = await fetch('/api/admin/badges', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ label: label.trim(), color })
			});
			const json = await res.json();
			if (!res.ok) {
				adminToast(json.error || 'Error', 'err');
				return;
			}
			label = '';
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function remove(id: string) {
		if (!(await adminConfirm(i18n.t('admin.badgeDeleteConfirm')))) return;
		busy = true;
		try {
			const res = await fetch(`/api/admin/badges/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const json = await res.json();
				adminToast(json.error || 'Error', 'err');
				return;
			}
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function grant(badgeId: string) {
		const username = (grantDrafts[badgeId] ?? '').trim();
		if (!username || busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/admin/badges/${badgeId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'grant', username })
			});
			const json = await res.json();
			if (!res.ok) {
				adminToast(json.error || 'Error', 'err');
				return;
			}
			grantDrafts = { ...grantDrafts, [badgeId]: '' };
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function revoke(badgeId: string, userId: string, username: string) {
		if (!(await adminConfirm(i18n.t('admin.badgeRevokeConfirm', { user: username })))) return;
		busy = true;
		try {
			const res = await fetch(`/api/admin/badges/${badgeId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'revoke', userId })
			});
			const json = await res.json();
			if (!res.ok) {
				adminToast(json.error || 'Error', 'err');
				return;
			}
			adminToast(i18n.t('admin.saved'));
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

<section class="admin-section">
	<h2>{i18n.t('admin.navBadges')}</h2>
	<p class="admin-lead">{i18n.t('admin.badgesLead')}</p>

	<form class="admin-badge-create" onsubmit={create}>
		<div class="field">
			<label for="badgeLabel">{i18n.t('admin.badgeLabel')}</label>
			<input id="badgeLabel" maxlength={40} bind:value={label} placeholder={i18n.t('admin.badgeLabelPh')} />
		</div>
		<div class="field" style="margin-top:12px">
			<span class="field-label-text">{i18n.t('admin.badgeColor')}</span>
			<div class="admin-color-row">
				{#each BADGE_COLOR_PRESETS as c}
					<button
						type="button"
						class="admin-color-swatch"
						class:active={color === c}
						style="background:{c}"
						aria-label={c}
						onclick={() => (color = c)}
					></button>
				{/each}
				<input type="color" bind:value={color} aria-label={i18n.t('admin.badgeColor')} />
			</div>
			<div class="admin-badge-preview" style="--badge-color:{color}">
				<BadgeCheck size={18} strokeWidth={2.4} />
				<span>{label.trim() || i18n.t('admin.badgePreview')}</span>
			</div>
		</div>
		<button class="btn btn-block" type="submit" disabled={busy || !label.trim()} style="margin-top:14px">
			{i18n.t('admin.badgeCreate')}
		</button>
	</form>
</section>

<section class="admin-section">
	{#if data.badges.length === 0}
		<p class="admin-empty">{i18n.t('admin.badgesEmpty')}</p>
	{:else}
		<div class="admin-badge-cards">
			{#each data.badges as badge}
				<article class="admin-badge-card">
					<div class="admin-badge-row">
						<span class="admin-badge-preview" style="--badge-color:{badge.color};margin-top:0">
							<BadgeCheck size={18} strokeWidth={2.4} />
							<span>{badge.label}</span>
						</span>
						<button
							class="icon-btn"
							type="button"
							disabled={busy}
							aria-label={i18n.t('admin.badgeDelete')}
							onclick={() => remove(badge.id)}
						>
							<Trash2 size={18} />
						</button>
					</div>

					<div class="admin-badge-grant">
						<input
							type="text"
							autocomplete="off"
							spellcheck="false"
							placeholder={i18n.t('admin.badgeGrantPh')}
							value={grantDrafts[badge.id] ?? ''}
							oninput={(e) => {
								grantDrafts = {
									...grantDrafts,
									[badge.id]: (e.currentTarget as HTMLInputElement).value
								};
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									grant(badge.id);
								}
							}}
						/>
						<button
							class="btn"
							type="button"
							disabled={busy || !(grantDrafts[badge.id] ?? '').trim()}
							onclick={() => grant(badge.id)}
						>
							{i18n.t('admin.badgeGrant')}
						</button>
					</div>

					{#if badge.holders.length === 0}
						<p class="admin-meta">{i18n.t('admin.badgeNoHolders')}</p>
					{:else}
						<ul class="admin-badge-holders">
							{#each badge.holders as holder}
								<li>
									<a href="/admin/users/{holder.id}">
										@{holder.username}
										{#if holder.displayName}
											<span>{holder.displayName}</span>
										{/if}
									</a>
									<button
										class="icon-btn"
										type="button"
										disabled={busy}
										aria-label={i18n.t('admin.badgeRevoke')}
										onclick={() => revoke(badge.id, holder.id, holder.username)}
									>
										<UserMinus size={16} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>
