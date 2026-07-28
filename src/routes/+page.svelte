<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import Archive from '@lucide/svelte/icons/archive';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import Bell from '@lucide/svelte/icons/bell';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Mic from '@lucide/svelte/icons/mic';
	import ImageIcon from '@lucide/svelte/icons/image';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Pin from '@lucide/svelte/icons/pin';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '$lib/components/Avatar.svelte';
	import ChannelAvatar from '$lib/components/ChannelAvatar.svelte';
	import GroupAvatar from '$lib/components/GroupAvatar.svelte';
	import CoachTip from '$lib/components/CoachTip.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { decryptMessageBody } from '$lib/e2ee/messages';
	import { setRequestBadge, setUnreadBadge } from '$lib/badges.svelte';
	import { lastMessagePreview } from '$lib/chatPreview';
	import { dismissCoach, markCoachShown, shouldShowCoach } from '$lib/coach';
	import { toast } from '$lib/flash.svelte';
	import { haptic } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { notifyMessage } from '$lib/notify';
	import { shouldForceOnboarding } from '$lib/onboarding';
	import { listQueued } from '$lib/sendQueue';
	import { formatRelativeTime, isOnlineIso } from '$lib/time';
	import { APP_VERSION } from '$lib/version';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let filter = $state('');
	let searching = $state(false);
	let showSearchHint = $state(false);
	let showChannelsHint = $state(false);
	let searchChats = $state<PageData['chats']>([]);
	let decryptedPreviews = $state<Record<string, string>>({});

	$effect(() => {
		if (!data.user) return;
		for (const chat of data.chats) {
			const lastBody = chat.lastMessage?.body;
			if (!lastBody || !lastBody.startsWith('e2ee:1:')) continue;
			if (decryptedPreviews[chat.id]) continue;
			if (chat.kind === 'dm' && chat.peer?.e2eePublicKey) {
				const chatId = chat.id;
				const peerId = chat.peer.id;
				const pubKey = chat.peer.e2eePublicKey;
				const userId = data.user.id;
				decryptMessageBody(userId, peerId, pubKey, lastBody)
					.then((dec) => {
						if (dec && dec !== '🔒') {
							decryptedPreviews[chatId] = dec;
						}
					})
					.catch(() => {});
			}
		}
	});
	let searchPeople = $state<
		Array<{ id: string; username: string; displayName: string | null; avatarPath: string | null }>
	>([]);
	let searchMessages = $state<
		Array<{
			messageId: string;
			chatId: string;
			body: string;
			createdAt: string;
			peer: {
				id: string;
				username: string;
				displayName: string | null;
				avatarPath: string | null;
			} | null;
			channel: { key: string; title: string } | null;
		}>
	>([]);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let menuId = $state<string | null>(null);
	let skipClickUntil = 0;
	let detachPointerListeners: (() => void) | null = null;
	let prefBusy = $state(false);
	let pullStartY = 0;
	let pullY = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	let listEl: HTMLDivElement | undefined = $state();
	let presenceMap = $state<Record<string, string>>({});
	let openingUser = $state(false);
	let searchInput: HTMLInputElement | undefined = $state();
	let drafts = $state<Record<string, string>>({});
	let failedChats = $state<Set<string>>(new Set());
	let swipeId = $state<string | null>(null);
	let swipeX = $state(0);
	let openSwipeId = $state<string | null>(null);
	let deleteTarget = $state<{ id: string; title: string } | null>(null);

	const SKIP_CLICK_MS = 650;
	/** Must match --row-actions-w in app.css. */
	const SWIPE_OPEN = 186;
	const SWIPE_START = 14;
	const SWIPE_TRIGGER = 64;

	const menuChat = $derived(
		menuId
			? data.chats.find((c) => c.id === menuId) ??
					searchChats.find((c) => c.id === menuId) ??
					null
			: null
	);

	const q = $derived(filter.trim());
	const isSearch = $derived(q.length > 0);

	const pinned = $derived(data.chats.filter((c) => c.pinned));
	const unpinned = $derived(data.chats.filter((c) => !c.pinned));

	const searchHasResults = $derived(
		searchChats.length > 0 || searchPeople.length > 0 || searchMessages.length > 0
	);

	$effect(() => {
		setUnreadBadge(
			data.chats.reduce((sum, c) => sum + (c.muted ? 0 : c.unreadCount), 0)
		);
	});

	function closeSwipe() {
		openSwipeId = null;
		swipeId = null;
		swipeX = 0;
	}

	function rowOffset(id: string) {
		if (swipeId === id) return swipeX;
		if (openSwipeId === id) return -SWIPE_OPEN;
		return 0;
	}

	function loadLocalHints() {
		const nextDrafts: Record<string, string> = {};
		try {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (!key?.startsWith('qix-draft-')) continue;
				const chatId = key.slice('qix-draft-'.length);
				const val = localStorage.getItem(key)?.trim();
				if (val) nextDrafts[chatId] = val;
			}
		} catch {
			/* ignore */
		}
		drafts = nextDrafts;
		listQueued()
			.then((items) => {
				failedChats = new Set(items.map((i) => i.chatId));
			})
			.catch(() => {
				failedChats = new Set();
			});
		fetch('/api/requests')
			.then((r) => r.json())
			.then((j) => {
				setRequestBadge(Array.isArray(j.requests) ? j.requests.length : 0);
			})
			.catch(() => {
				setRequestBadge(0);
			});
	}

	function preview(chat: PageData['chats'][number]) {
		return lastMessagePreview(chat, {
			userId: data.user?.id,
			t: i18n.t,
			draft: drafts[chat.id],
			failed: failedChats.has(chat.id),
			decryptedBody: decryptedPreviews[chat.id]
		});
	}

	function previewIcon(chat: PageData['chats'][number]) {
		if (drafts[chat.id] || failedChats.has(chat.id)) return null;
		if (!chat.lastMessage || chat.lastMessage.deleted) return null;
		if (chat.lastMessage.kind === 'voice') return 'voice';
		if (chat.lastMessage.kind === 'video') return 'image';
		if (chat.lastMessage.hasAttachment && !chat.lastMessage.body) return 'image';
		return null;
	}

	function displayName(chat: PageData['chats'][number]) {
		if (chat.kind === 'channel' && chat.channel) {
			return i18n.t(`channel.${chat.channel.key}.title`);
		}
		if (chat.kind === 'group' && chat.group) return chat.group.title;
		return chat.peer?.displayName || chat.peer?.username || '';
	}

	function peerOnline(chat: PageData['chats'][number]) {
		if (!chat.peer) return false;
		const seen = presenceMap[chat.peer.id] ?? chat.peer.lastSeenAt;
		return isOnlineIso(seen);
	}

	function snippet(body: string, query: string) {
		const lower = body.toLowerCase();
		const i = lower.indexOf(query.toLowerCase());
		if (i < 0) return body.slice(0, 100);
		const start = Math.max(0, i - 24);
		const end = Math.min(body.length, i + query.length + 40);
		return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
	}

	function onFilterInput() {
		clearTimeout(searchTimer);
		const next = filter.trim();
		if (!next) {
			searchChats = [];
			searchPeople = [];
			searchMessages = [];
			searching = false;
			return;
		}
		searchTimer = setTimeout(() => runSearch(next), 220);
	}

	async function runSearch(query: string) {
		searching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			const json = await res.json();
			if (!res.ok) return;
			searchChats = json.chats ?? [];
			searchPeople = json.people ?? [];
			searchMessages = json.messages ?? [];
		} finally {
			searching = false;
		}
	}

	function clearSearch() {
		filter = '';
		searchChats = [];
		searchPeople = [];
		searchMessages = [];
		searching = false;
	}

	async function refresh() {
		refreshing = true;
		try {
			await invalidateAll();
			loadLocalHints();
			if (q) await runSearch(q);
		} finally {
			refreshing = false;
			pullY = 0;
		}
	}

	async function setPref(chatId: string, patch: { pinned?: boolean; muted?: boolean; archived?: boolean }) {
		if (prefBusy) return;
		prefBusy = true;
		try {
			await fetch(`/api/chats/${chatId}/prefs`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(patch)
			});
			closeMenu();
			closeSwipe();
			await invalidateAll();
		} finally {
			prefBusy = false;
		}
	}

	function promptDeleteChat(id: string) {
		const chat = data.chats.find((c) => c.id === id) ?? searchChats.find((c) => c.id === id);
		if (!chat) return;
		closeSwipe();
		closeMenu();
		deleteTarget = { id, title: displayName(chat) };
		setSheetOpen(true);
	}

	async function confirmDeleteChat(id: string, mode: 'self' | 'everyone') {
		if (prefBusy) return;
		prefBusy = true;
		try {
			await fetch(`/api/chats/${id}`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			deleteTarget = null;
			setSheetOpen(false);
			await invalidateAll();
			toast(mode === 'everyone' ? i18n.t('chat.deletedBody') : i18n.t('chats.archive'));
		} finally {
			prefBusy = false;
		}
	}

	function portal(node: HTMLElement) {
		const host = document.querySelector('.app-shell') ?? document.body;
		host.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function setSheetOpen(open: boolean) {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('sheet-open', open);
	}

	function closeMenu() {
		menuId = null;
		prefBusy = false;
		detachPointerListeners?.();
		detachPointerListeners = null;
		setSheetOpen(false);
	}

	function openMenu(id: string) {
		pulling = false;
		pullY = 0;
		closeSwipe();
		menuId = id;
		skipClickUntil = Date.now() + SKIP_CLICK_MS;
		setSheetOpen(true);
		haptic([8, 40, 14]);
	}

	function onRowPointerDown(e: PointerEvent, id: string) {
		if (e.button !== undefined && e.button !== 0) return;
		if (menuId) {
			closeMenu();
			skipClickUntil = Date.now() + SKIP_CLICK_MS;
			return;
		}
		if (openSwipeId) {
			const wasOpen = openSwipeId;
			closeSwipe();
			if (wasOpen === id) {
				skipClickUntil = Date.now() + SKIP_CLICK_MS;
				return;
			}
		}

		detachPointerListeners?.();
		const startX = e.clientX;
		const startY = e.clientY;

		const pointerId = e.pointerId;
		const onMove = (ev: PointerEvent) => {
			if (ev.pointerId !== pointerId) return;
			if (menuId) return;
			const dx = ev.clientX - startX;
			const dy = ev.clientY - startY;

			if (swipeId === id) {
				swipeX = Math.max(-(SWIPE_OPEN + 28), Math.min(0, dx));
				return;
			}
			if (dx < -SWIPE_START && Math.abs(dx) > Math.abs(dy) * 1.4) {
				swipeId = id;
				swipeX = Math.max(-(SWIPE_OPEN + 28), dx);
			}
		};

		const onUp = (ev: PointerEvent) => {
			if (ev.pointerId !== pointerId) return;
			if (swipeId === id) {
				swipeId = null;
				skipClickUntil = Date.now() + SKIP_CLICK_MS;
				if (swipeX <= -SWIPE_TRIGGER) {
					swipeX = -SWIPE_OPEN;
					openSwipeId = id;
					haptic(10);
				} else {
					swipeX = 0;
				}
			}
			detachPointerListeners?.();
			detachPointerListeners = null;
		};

		window.addEventListener('pointermove', onMove, { passive: true });
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		detachPointerListeners = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
	}

	function onRowContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function onRowClick(id: string) {
		if (Date.now() < skipClickUntil) return;
		if (menuId) {
			closeMenu();
			return;
		}
		openChat(id);
	}

	function onMenuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuId) {
			e.preventDefault();
			closeMenu();
		}
	}

	function onListScroll() {
		if (openSwipeId) closeSwipe();
	}

	function onListTouchStart(e: TouchEvent) {
		if (menuId || swipeId || openSwipeId) return;
		if (!listEl || listEl.scrollTop > 0 || refreshing) return;
		pullStartY = e.touches[0].clientY;
		pulling = true;
	}

	function onListTouchMove(e: TouchEvent) {
		if (menuId || swipeId) {
			pulling = false;
			pullY = 0;
			return;
		}
		if (!pulling || refreshing) return;
		const dy = e.touches[0].clientY - pullStartY;
		if (dy > 0 && listEl && listEl.scrollTop <= 0) {
			pullY = Math.min(72, dy * 0.45);
		} else {
			pullY = 0;
		}
	}

	async function onListTouchEnd() {
		if (!pulling) return;
		pulling = false;
		if (pullY > 52) await refresh();
		else pullY = 0;
	}

	function openChat(id: string, messageId?: string) {
		closeMenu();
		closeSwipe();
		// Never navigate into a built-in channel id by mistake from DM helpers
		const href = messageId ? `/chat/${id}?m=${encodeURIComponent(messageId)}` : `/chat/${id}`;
		void goto(href);
	}

	async function openUser(username: string) {
		openingUser = true;
		try {
			const res = await fetch('/api/chats', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ peerUsername: username })
			});
			const json = await res.json();
			if (res.status === 202 || json.pending) {
				toast(i18n.t('requests.sent'));
				return;
			}
			if (res.ok && json.chatId) openChat(json.chatId);
			else toast(json.error || i18n.t('common.error'), 'err');
		} finally {
			openingUser = false;
		}
	}

	onMount(() => {
		if (shouldForceOnboarding()) {
			void goto('/onboarding');
			return;
		}
		loadLocalHints();
		try {
			if (shouldShowCoach('qix-hint-search')) {
				showSearchHint = true;
				markCoachShown('qix-hint-search');
			} else if (shouldShowCoach('qix-hint-channels') && data.chats.some((c) => c.kind === 'channel')) {
				showChannelsHint = true;
				markCoachShown('qix-hint-channels');
			}
		} catch {
			/* ignore */
		}
		if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('focus')) {
			queueMicrotask(() => searchInput?.focus());
			history.replaceState({}, '', '/');
		}
		fetch('/api/presence', { method: 'POST' });

		let beat: ReturnType<typeof setInterval> | undefined;
		let es: EventSource | null = null;

		function connect() {
			es?.close();
			if (beat) clearInterval(beat);
			es = new EventSource('/api/events');
			es.addEventListener('chat_update', (ev) => {
				try {
					const d = JSON.parse(ev.data) as { chatId?: string };
					const chat = data.chats.find((c) => c.id === d.chatId);
					if (chat && !chat.muted) {
						notifyMessage({
							title: displayName(chat),
							body: preview(chat),
							tag: `chat-${chat.id}`,
							href: `/chat/${chat.id}`
						});
					}
				} catch {
					/* ignore */
				}
				invalidateAll();
				loadLocalHints();
			});
			es.addEventListener('presence', (ev) => {
				try {
					const d = JSON.parse(ev.data) as { userId: string; lastSeenAt: string };
					presenceMap = { ...presenceMap, [d.userId]: d.lastSeenAt };
				} catch {
					/* ignore */
				}
				invalidateAll();
			});
			es.addEventListener('message_request', () => {
				loadLocalHints();
			});
			beat = setInterval(() => fetch('/api/presence', { method: 'POST' }), 25000);
		}

		function disconnect() {
			es?.close();
			es = null;
			if (beat) {
				clearInterval(beat);
				beat = undefined;
			}
		}

		const onVisibility = () => {
			if (document.hidden) disconnect();
			else {
				connect();
				fetch('/api/presence', { method: 'POST' });
				loadLocalHints();
			}
		};

		connect();
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			clearTimeout(searchTimer);
			detachPointerListeners?.();
			detachPointerListeners = null;
			setSheetOpen(false);
		};
	}); // end onMount
</script>

<svelte:window onfocus={refresh} onkeydown={onMenuKeydown} />

<div class="screen chats-screen">
	<header class="topbar">
		<h1 class="brand brand-animate">{i18n.t('chats.title')}</h1>
	</header>

	{#if showSearchHint}
		<CoachTip
			class="list-coach"
			actionLabel={i18n.t('coach.gotIt')}
			ondismiss={() => {
				showSearchHint = false;
				dismissCoach('qix-hint-search');
			}}
		>
			{#snippet icon()}
				<Search size={20} />
			{/snippet}
			<p>{i18n.t('coach.search')}</p>
		</CoachTip>
	{:else if showChannelsHint}
		<CoachTip
			class="list-coach"
			tone="soft"
			actionLabel={i18n.t('coach.gotIt')}
			ondismiss={() => {
				showChannelsHint = false;
				dismissCoach('qix-hint-channels');
			}}
		>
			{#snippet icon()}
				<Bell size={20} />
			{/snippet}
			<p>{i18n.t('coach.channels')}</p>
		</CoachTip>
	{/if}

	<div class="list-filter">
		<span class="list-filter-ico" aria-hidden="true"><Search size={16} /></span>
		<input
			bind:this={searchInput}
			type="search"
			placeholder={i18n.t('chats.filter')}
			aria-label={i18n.t('common.search')}
			bind:value={filter}
			oninput={onFilterInput}
			autocomplete="off"
			enterkeyhint="search"
		/>
		{#if filter}
			<button
				type="button"
				class="list-filter-clear"
				aria-label={i18n.t('common.clear')}
				onclick={clearSearch}
			>
				<X size={16} />
			</button>
		{/if}
	</div>

	<div
		class="list"
		class:is-holding={!!menuId}
		bind:this={listEl}
		role="list"
		onscroll={onListScroll}
		ontouchstart={onListTouchStart}
		ontouchmove={onListTouchMove}
		ontouchend={onListTouchEnd}
	>
		{#if pullY > 8 || refreshing}
			<div class="pull-indicator" style="height:{refreshing ? 40 : pullY}px">
				<span class="pull-spinner" class:spin={refreshing || pullY > 40}></span>
				<span class:spin={refreshing}>{refreshing ? '…' : i18n.t('chats.pullRefresh')}</span>
			</div>
		{/if}

		{#if isSearch}
			{#if searching && !searchHasResults}
				<div class="empty empty-animate">
					<p>{i18n.t('chats.searching')}</p>
				</div>
			{:else if !searchHasResults}
				<div class="empty empty-animate">
					<p>{i18n.t('chats.emptyFilter', { q })}</p>
					<p class="search-hint">{i18n.t('chats.searchHint')}</p>
				</div>
			{:else}
				{#if searchChats.length}
					<div class="list-section-label">{i18n.t('chats.searchChats')}</div>
					{#each searchChats as chat, i (chat.id)}
						{@render chatRow(chat, i, true)}
					{/each}
				{/if}

				{#if searchPeople.length}
					<div class="list-section-label">{i18n.t('chats.searchPeople')}</div>
					{#each searchPeople as user (user.id)}
						<button
							class="user-row search-user-row"
							type="button"
							disabled={openingUser}
							onclick={() => openUser(user.username)}
						>
							<Avatar
								name={user.displayName || user.username}
								size={44}
								avatarPath={user.avatarPath}
								userId={user.id}
							/>
							<span class="search-user-meta">
								<span class="name">{user.displayName || user.username}</span>
								<span class="hint">@{user.username}</span>
							</span>
						</button>
					{/each}
				{/if}

				{#if searchMessages.length}
					<div class="list-section-label">{i18n.t('chats.searchMessages')}</div>
					{#each searchMessages as hit (hit.messageId)}
						<button
							class="user-row search-msg-row"
							type="button"
							onclick={() => openChat(hit.chatId, hit.messageId)}
						>
							{#if hit.channel}
								<ChannelAvatar channelKey={hit.channel.key} size={44} />
								<span class="search-user-meta">
									<span class="name">{i18n.t(`channel.${hit.channel.key}.title`)}</span>
									<span class="hint msg-snippet">{snippet(hit.body, q)}</span>
								</span>
							{:else if hit.peer}
								<Avatar
									name={hit.peer.displayName || hit.peer.username}
									size={44}
									avatarPath={hit.peer.avatarPath}
									userId={hit.peer.id}
								/>
								<span class="search-user-meta">
									<span class="name">{hit.peer.displayName || hit.peer.username}</span>
									<span class="hint msg-snippet">{snippet(hit.body, q)}</span>
								</span>
							{/if}
							<span class="time">{formatRelativeTime(hit.createdAt, i18n.locale)}</span>
						</button>
					{/each}
				{/if}
			{/if}
		{:else if data.chats.length === 0}
			<div class="empty empty-animate">
				<span class="empty-icon"><MessageCircle size={28} /></span>
				<strong>{i18n.t('chats.emptyTitle')}</strong>
				<p>{i18n.t('chats.empty')}</p>
				<button
					type="button"
					class="btn"
					onclick={() => {
						searchInput?.focus();
						filter = '';
					}}
				>
					{i18n.t('chats.emptyCta')}
				</button>
			</div>
		{:else}
			{#if pinned.length}
				<div class="list-section-label">{i18n.t('chats.pinnedSection')}</div>
				{#each pinned as chat, i (chat.id)}
					{@render chatRow(chat, i, true)}
				{/each}
			{/if}
			{#each unpinned as chat, i (chat.id)}
				{@render chatRow(chat, pinned.length + i, true)}
			{/each}
		{/if}
		<p class="app-version" aria-hidden="true">{APP_VERSION}</p>
	</div>

	<a class="fab" href="/new" aria-label={i18n.t('chats.newTitle')} title={i18n.t('chats.newTitle')}>
		<PenLine size={22} />
	</a>
</div>

{#if menuChat}
	<div class="chat-menu-portal" use:portal>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="menu-backdrop" role="presentation" onclick={closeMenu}></div>
		<div
			class="msg-sheet"
			role="dialog"
			aria-modal="true"
			aria-label={displayName(menuChat)}
		>
			<div class="msg-menu">
				<button
					type="button"
					disabled={prefBusy}
					onclick={() => setPref(menuChat.id, { pinned: !menuChat.pinned })}
				>
					<span class="sheet-row-ico">
						{#if menuChat.pinned}
							<PinOff size={18} />
						{:else}
							<Pin size={18} />
						{/if}
					</span>
					{menuChat.pinned ? i18n.t('actions.unpin') : i18n.t('actions.pin')}
				</button>
				<button
					type="button"
					disabled={prefBusy}
					onclick={() => setPref(menuChat.id, { muted: !menuChat.muted })}
				>
					<span class="sheet-row-ico">
						{#if menuChat.muted}
							<Bell size={18} />
						{:else}
							<BellOff size={18} />
						{/if}
					</span>
					{menuChat.muted ? i18n.t('actions.unmute') : i18n.t('actions.mute')}
				</button>
				<button
					type="button"
					class="danger"
					disabled={prefBusy}
					onclick={() => setPref(menuChat.id, { archived: true })}
				>
					<span class="sheet-row-ico"><Archive size={18} /></span>
					{i18n.t('chat.archive')}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if deleteTarget}
	<div class="chat-menu-portal" use:portal>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="menu-backdrop" role="presentation" onclick={() => { deleteTarget = null; setSheetOpen(false); }}></div>
		<div class="msg-sheet delete-dialog-sheet">
			<div class="msg-menu pad-sheet">
				<h3 class="sheet-title">{i18n.t('chat.deleteChatTitle')}</h3>
				<p class="sheet-desc">{deleteTarget.title}</p>
				<button
					type="button"
					class="btn btn-block"
					disabled={prefBusy}
					onclick={() => confirmDeleteChat(deleteTarget!.id, 'self')}
				>
					{i18n.t('chat.deleteForMe')}
				</button>
				<button
					type="button"
					class="btn btn-block btn-danger-outline"
					disabled={prefBusy}
					onclick={() => confirmDeleteChat(deleteTarget!.id, 'everyone')}
				>
					{i18n.t('chat.deleteForEveryone')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-block"
					onclick={() => { deleteTarget = null; setSheetOpen(false); }}
				>
					{i18n.t('chat.keep')}
				</button>
			</div>
		</div>
	</div>
{/if}

{#snippet chatRow(chat: PageData['chats'][number], index: number, withActions: boolean)}
	{@const icon = previewIcon(chat)}
	{@const offset = rowOffset(chat.id)}
	<div
		class="chat-row-wrap"
		class:menu-open={menuId === chat.id}
		class:swiping={swipeId === chat.id}
		class:swipe-open={openSwipeId === chat.id}
		style="animation-delay:{Math.min(index, 5) * 22}ms"
		role="group"
	>
		{#if withActions}
			<div class="row-actions-under">
				<button
					type="button"
					class="row-action mute"
					disabled={prefBusy}
					onclick={() => setPref(chat.id, { muted: !chat.muted })}
				>
					{#if chat.muted}
						<Bell size={17} />
					{:else}
						<BellOff size={17} />
					{/if}
					<span>{chat.muted ? i18n.t('actions.unmute') : i18n.t('actions.mute')}</span>
				</button>
				<button
					type="button"
					class="row-action archive"
					disabled={prefBusy}
					onclick={() => setPref(chat.id, { archived: true })}
				>
					<Archive size={17} />
					<span>{i18n.t('chat.archive')}</span>
				</button>
				{#if chat.kind !== 'channel' && !chat.channel}
					<button
						type="button"
						class="row-action delete"
						disabled={prefBusy}
						onclick={() => promptDeleteChat(chat.id)}
					>
						<Trash2 size={17} />
						<span>{i18n.t('chat.delete')}</span>
					</button>
				{/if}
			</div>
		{/if}
		<button
			type="button"
			class="chat-row"
			class:muted={chat.muted}
			class:unread={chat.unreadCount > 0}
			style={offset ? `transform:translate3d(${offset}px,0,0)` : ''}
			onclick={() => (withActions ? onRowClick(chat.id) : openChat(chat.id))}
			onpointerdown={withActions ? (e) => onRowPointerDown(e, chat.id) : undefined}
			oncontextmenu={withActions ? (e) => onRowContextMenu(e) : undefined}
		>
			{#if chat.kind === 'channel' && chat.channel}
				<ChannelAvatar channelKey={chat.channel.key} size={48} />
			{:else if chat.kind === 'group' && chat.group}
				<GroupAvatar
					title={chat.group.title}
					chatId={chat.id}
					avatarPath={chat.group.avatarPath}
					size={48}
				/>
			{:else if chat.peer}
				<Avatar
					name={displayName(chat)}
					avatarPath={chat.peer.avatarPath}
					userId={chat.peer.id}
					online={peerOnline(chat)}
				/>
			{/if}
			<div class="meta">
				<div class="row-top">
					<p class="name">
						{#if chat.pinned}
							<span class="pin-icon"><Pin size={12} /></span>
						{/if}
						{#if chat.kind === 'channel' || chat.kind === 'group'}
							{displayName(chat)}
						{:else}
							<NameWithBadges
								name={displayName(chat)}
								badges={chat.peer?.badges ?? []}
								size="sm"
							/>
						{/if}
					</p>
					{#if chat.lastMessage}
						<span class="time">{formatRelativeTime(chat.lastMessage.createdAt, i18n.locale)}</span>
					{/if}
				</div>
				<div class="row-bottom">
					<p class="preview" class:draft={!!drafts[chat.id]} class:failed-send={failedChats.has(chat.id)}>
						{#if icon === 'voice'}
							<span class="preview-ico"><Mic size={14} /></span>
						{:else if icon === 'image'}
							<span class="preview-ico"><ImageIcon size={14} /></span>
						{/if}
						{preview(chat)}
					</p>
					{#if failedChats.has(chat.id)}
						<span class="unread-badge fail">!</span>
					{:else if chat.unreadCount > 0}
						<span class="unread-badge pop" class:quiet={chat.muted}
							>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span
						>
					{/if}
				</div>
			</div>
		</button>
	</div>
{/snippet}
