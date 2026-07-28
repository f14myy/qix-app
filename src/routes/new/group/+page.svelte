<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '$lib/components/Avatar.svelte';
	import { toast } from '$lib/flash.svelte';
	import { haptic, hapticFail, hapticSuccess } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	type Person = {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
	};

	const i18n = useI18n();

	let title = $state('');
	let query = $state('');
	let people = $state<Person[]>([]);
	let searching = $state(false);
	let creating = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let nameInput: HTMLInputElement | undefined = $state();

	/*
	 * Held as a map rather than a set of ids so a chosen person survives the next
	 * search replacing `people` — the chips have to keep rendering someone who is
	 * no longer in the visible results.
	 */
	let picked = $state<Record<string, Person>>({});
	const pickedList = $derived(Object.values(picked));
	const canCreate = $derived(!!title.trim() && !creating);

	onMount(() => {
		queueMicrotask(() => nameInput?.focus());
		return () => clearTimeout(searchTimer);
	});

	function onSearchInput() {
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
			if (res.ok) people = json.people ?? [];
		} catch {
			people = [];
		} finally {
			searching = false;
		}
	}

	function toggle(person: Person) {
		haptic(8);
		const next = { ...picked };
		if (next[person.id]) delete next[person.id];
		else next[person.id] = person;
		picked = next;
	}

	async function create() {
		if (!canCreate) return;
		const name = title.trim();
		if (!name) {
			toast(i18n.t('group.nameRequired'), 'err');
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/chats/groups', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: name, memberIds: pickedList.map((p) => p.id) })
			});
			const json = await res.json();
			if (!res.ok || !json.chatId) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			hapticSuccess();
			toast(i18n.t('group.created'));
			await goto(`/chat/${json.chatId}`, { replaceState: true });
		} catch {
			hapticFail();
			toast(i18n.t('common.error'), 'err');
		} finally {
			creating = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button
			type="button"
			class="icon-btn"
			aria-label={i18n.t('back')}
			onclick={() => goBack('/new')}
		>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('group.newTitle')}</h1>
		<span class="topbar-ghost" aria-hidden="true"></span>
	</header>

	<div class="group-create-head">
		<span class="group-create-ico" aria-hidden="true"><Users size={22} /></span>
		<input
			bind:this={nameInput}
			class="group-name-input"
			type="text"
			maxlength="60"
			placeholder={i18n.t('group.namePlaceholder')}
			aria-label={i18n.t('group.nameLabel')}
			bind:value={title}
			enterkeyhint="done"
		/>
	</div>

	{#if pickedList.length}
		<div class="picked-chips stagger">
			{#each pickedList as person (person.id)}
				<button type="button" class="picked-chip" onclick={() => toggle(person)}>
					<Avatar
						name={person.displayName || person.username}
						size={22}
						avatarPath={person.avatarPath}
						userId={person.id}
					/>
					<span>{person.displayName || person.username}</span>
					<X size={13} />
				</button>
			{/each}
		</div>
	{/if}

	<div class="list-filter">
		<span class="list-filter-ico" aria-hidden="true"><Search size={16} /></span>
		<input
			type="search"
			placeholder={i18n.t('group.pickHint')}
			aria-label={i18n.t('common.search')}
			bind:value={query}
			oninput={onSearchInput}
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
				}}
			>
				<X size={16} />
			</button>
		{/if}
	</div>

	<div class="list stagger">
		{#if query.trim().length < 2}
			<div class="empty empty-animate">
				<span class="empty-icon"><Users size={28} /></span>
				<strong>{i18n.t('group.pickMembers')}</strong>
				<p>{i18n.t('group.newLead')}</p>
			</div>
		{:else if searching && people.length === 0}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.searching')}</p>
			</div>
		{:else if people.length === 0}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.newNothing', { q: query.trim() })}</p>
			</div>
		{:else}
			{#each people as person (person.id)}
				{@const on = !!picked[person.id]}
				<button class="user-row pick-row" class:picked={on} type="button" onclick={() => toggle(person)}>
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
					<span class="pick-check" class:on aria-hidden="true">
						{#if on}<Check size={14} />{/if}
					</span>
				</button>
			{/each}
		{/if}
	</div>

	<div class="group-create-bar">
		<span class="group-create-count">
			{i18n.t('group.selectedCount', { n: pickedList.length })}
		</span>
		<button type="button" class="btn" disabled={!canCreate} onclick={create}>
			{creating ? i18n.t('group.creating') : i18n.t('group.create')}
		</button>
	</div>
</div>
