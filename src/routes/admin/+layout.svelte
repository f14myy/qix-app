<script lang="ts">
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Ban from '@lucide/svelte/icons/ban';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Flag from '@lucide/svelte/icons/flag';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ShieldOff from '@lucide/svelte/icons/shield-off';
	import Users from '@lucide/svelte/icons/users';
	import AdminFlash from '$lib/components/AdminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	const i18n = useI18n();
	let moreOpen = $state(false);

	const primary = [
		{ href: '/admin', icon: LayoutDashboard, label: 'admin.navOverview', exact: true },
		{ href: '/admin/users', icon: Users, label: 'admin.navUsers', exact: false },
		{ href: '/admin/messages', icon: MessageSquare, label: 'admin.navMessages', exact: false }
	] as const;

	const more = [
		{ href: '/admin/badges', icon: BadgeCheck, label: 'admin.navBadges' },
		{ href: '/admin/bans', icon: Ban, label: 'admin.navBans' },
		{ href: '/admin/blocks', icon: ShieldOff, label: 'admin.navBlocks' },
		{ href: '/admin/reports', icon: Flag, label: 'admin.navReports' }
	] as const;

	function active(href: string, exact: boolean) {
		const path = page.url.pathname;
		if (exact) return path === href;
		return path === href || path.startsWith(href + '/');
	}

	const moreActive = $derived(more.some((t) => active(t.href, false)));

	let lastPath = page.url.pathname;
	$effect(() => {
		const path = page.url.pathname;
		if (path !== lastPath) {
			lastPath = path;
			moreOpen = false;
		}
	});

	function toggleMore(e: MouseEvent) {
		e.stopPropagation();
		moreOpen = !moreOpen;
	}

	function closeMore() {
		moreOpen = false;
	}
</script>

<svelte:window onclick={closeMore} />

<div class="screen admin-screen">
	<header class="topbar">
		<a class="icon-btn" href="/settings" aria-label={i18n.t('back')}>
			<ArrowLeft size={22} />
		</a>
		<h1>{i18n.t('admin.title')}</h1>
		<span class="icon-btn" style="visibility:hidden" aria-hidden="true"><ArrowLeft size={22} /></span>
	</header>

	<nav class="admin-tabs" aria-label={i18n.t('admin.title')}>
		{#each primary as tab}
			{@const Icon = tab.icon}
			<a class="admin-tab" class:active={active(tab.href, tab.exact)} href={tab.href}>
				<Icon size={16} />
				<span>{i18n.t(tab.label)}</span>
			</a>
		{/each}

		<div class="admin-more-wrap">
			<button
				type="button"
				class="admin-tab admin-more-btn"
				class:active={moreActive || moreOpen}
				aria-expanded={moreOpen}
				aria-haspopup="menu"
				onclick={toggleMore}
			>
				<Ellipsis size={16} />
				<span>{i18n.t('admin.navMore')}</span>
			</button>
			{#if moreOpen}
				<div class="admin-more-menu">
					{#each more as tab}
						{@const Icon = tab.icon}
						<a
							class="admin-more-item"
							class:active={active(tab.href, false)}
							href={tab.href}
							onclick={closeMore}
						>
							<Icon size={16} />
							{i18n.t(tab.label)}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</nav>

	<div class="admin-body">
		{@render children()}
	</div>

	<AdminFlash />
</div>
