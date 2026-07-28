<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Search from '@lucide/svelte/icons/search';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '$lib/components/Avatar.svelte';
	import { toast } from '$lib/flash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	type Person = {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
	};

	const i18n = useI18n();
	let query = $state('');
	let people = $state<Person[]>([]);
	let searching = $state(false);
	let opening = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let input: HTMLInputElement | undefined = $state();

	const q = $derived(query.trim().replace(/^@/, ''));

	onMount(() => {
		queueMicrotask(() => input?.focus());
		return () => clearTimeout(searchTimer);
	});

	function onInput() {
		clearTimeout(searchTimer);
		const next = query.trim().replace(/^@/, '');
		if (next.length < 2) {
			people = [];
			searching = false;
			return;
		}
		searchTimer = setTimeout(() => void runSearch(next), 220);
	}

	async function runSearch(term: string) {
		searching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
			const json = await res.json();
			if (!res.ok) return;
			people = json.people ?? [];
		} catch {
			people = [];
		} finally {
			searching = false;
		}
	}

	async function openUser(username: string) {
		if (opening) return;
		opening = true;
		try {
			const res = await fetch('/api/chats', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ peerUsername: username })
			});
			const json = await res.json();
			if (res.status === 202 || json.pending) {
				toast(i18n.t('requests.sent'));
				goBack('/');
				return;
			}
			if (res.ok && json.chatId) await goto(`/chat/${json.chatId}`, { replaceState: true });
			else toast(json.error || i18n.t('common.error'), 'err');
		} finally {
			opening = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('chats.newTitle')}</h1>
		<span class="topbar-ghost" aria-hidden="true"></span>
	</header>

	<div class="list-filter">
		<span class="list-filter-ico" aria-hidden="true"><Search size={16} /></span>
		<input
			bind:this={input}
			type="search"
			placeholder={i18n.t('chats.newPlaceholder')}
			aria-label={i18n.t('common.search')}
			bind:value={query}
			oninput={onInput}
			autocomplete="off"
			enterkeyhint="search"
		/>
		{#if query}
			<button
				type="button"
				class="list-filter-clear"
				aria-label={i18n.t('common.clear')}
				onclick={() => {
					query = '';
					people = [];
					input?.focus();
				}}
			>
				<X size={16} />
			</button>
		{/if}
	</div>

	<!-- `stagger` cascades the search results in as they replace one another -->
	<div class="list stagger">
		{#if q.length < 2}
			<a class="user-row new-group-row" href="/new/group">
				<span class="avatar-wrap group-avatar-wrap" style="width:44px;height:44px">
					<div class="avatar avatar-letter group-avatar-icon" data-tone="1" style="width:44px;height:44px">
						<Users size={20} />
					</div>
				</span>
				<span class="search-user-meta">
					<span class="name">{i18n.t('group.newTitle')}</span>
					<span class="hint">{i18n.t('group.newLead')}</span>
				</span>
			</a>
			<div class="empty empty-animate" style="padding-top:24px">
				<span class="empty-icon"><UserPlus size={28} /></span>
				<strong>{i18n.t('chats.newTitle')}</strong>
				<p>{i18n.t('chats.newLead')}</p>
			</div>
		{:else if searching && people.length === 0}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.searching')}</p>
			</div>
		{:else if people.length === 0}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.newNothing', { q })}</p>
			</div>
		{:else}
			{#each people as person (person.id)}
				<button
					class="user-row"
					type="button"
					disabled={opening}
					onclick={() => openUser(person.username)}
				>
					<Avatar
						name={person.displayName || person.username}
						size={44}
						avatarPath={person.avatarPath}
						userId={person.id}
					/>
					<span class="search-user-meta">
						<span class="name">{person.displayName || person.username}</span>
						<span class="hint">@{person.username}</span>
					</span>
				</button>
			{/each}
		{/if}
	</div>
</div>
