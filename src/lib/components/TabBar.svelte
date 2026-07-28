<script lang="ts">
	import { page } from '$app/state';
	import Archive from '@lucide/svelte/icons/archive';
	import Inbox from '@lucide/svelte/icons/inbox';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Settings from '@lucide/svelte/icons/settings';
	import { getRequestBadge, getUnreadBadge } from '$lib/badges.svelte';
	import { haptic } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';

	/**
	 * `secondary` marks routes that are not top-level destinations. Those keep
	 * the bar mounted so the desktop side rail is always present, but hide it
	 * on phone widths where the bottom bar would compete with the back button.
	 */
	let { secondary = false }: { secondary?: boolean } = $props();

	const i18n = useI18n();
	const path = $derived(page.url.pathname);

	const tabs = $derived([
		{
			href: '/',
			label: i18n.t('tabs.chats'),
			icon: MessageCircle,
			badge: getUnreadBadge()
		},
		{
			href: '/requests',
			label: i18n.t('tabs.requests'),
			icon: Inbox,
			badge: getRequestBadge()
		},
		{ href: '/archive', label: i18n.t('tabs.archive'), icon: Archive, badge: 0 },
		{ href: '/settings', label: i18n.t('tabs.settings'), icon: Settings, badge: 0 }
	]);

	/** A chat belongs to the chats tab, a settings sub-page to settings, etc. */
	function isActive(href: string) {
		if (path === href) return true;
		if (href === '/') return path.startsWith('/chat/') || path.startsWith('/u/') || path === '/new';
		return path.startsWith(`${href}/`);
	}
</script>

<nav class="tabbar" class:is-secondary={secondary} aria-label={i18n.t('tabs.label')}>
	{#each tabs as tab (tab.href)}
		{@const active = isActive(tab.href)}
		<a
			class="tab"
			class:active
			href={tab.href}
			aria-current={active ? 'page' : undefined}
			onclick={() => {
				if (!active) haptic(6);
			}}
		>
			<span class="tab-ico">
				<tab.icon size={22} />
				{#if tab.badge > 0}
					<span class="tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
				{/if}
			</span>
			<span class="tab-label">{tab.label}</span>
		</a>
	{/each}
</nav>
