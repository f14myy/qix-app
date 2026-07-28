<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Users from '@lucide/svelte/icons/users';
	import GroupAvatar from '$lib/components/GroupAvatar.svelte';
	import { toast } from '$lib/flash.svelte';
	import { hapticFail, hapticSuccess } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	const i18n = useI18n();
	const code = $derived(page.params.code ?? '');

	/*
	 * Previewed before joining so the page can say which group the link leads to.
	 * `member` comes back true when the viewer is already in, and the call to
	 * action turns into "Open" — joining twice is harmless server-side, but
	 * offering it reads as though they were never in.
	 */
	let preview = $state<{
		id: string;
		title: string;
		description: string | null;
		avatarPath: string | null;
	} | null>(null);
	let alreadyMember = $state(false);
	let loading = $state(true);
	let invalid = $state(false);
	let joining = $state(false);

	onMount(() => void load());

	async function load() {
		loading = true;
		try {
			const res = await fetch(`/api/groups/join?code=${encodeURIComponent(code)}`);
			const json = await res.json();
			if (!res.ok || !json.group) {
				invalid = true;
				return;
			}
			preview = json.group;
			alreadyMember = !!json.member;
		} catch {
			invalid = true;
		} finally {
			loading = false;
		}
	}

	async function join() {
		if (joining) return;
		if (alreadyMember && preview) {
			await goto(`/chat/${preview.id}`, { replaceState: true });
			return;
		}
		joining = true;
		try {
			const res = await fetch('/api/groups/join', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ code })
			});
			const json = await res.json();
			if (!res.ok || !json.chatId) {
				hapticFail();
				toast(json.error || i18n.t('group.joinInvalid'), 'err');
				invalid = true;
				return;
			}
			hapticSuccess();
			await goto(`/chat/${json.chatId}`, { replaceState: true });
		} catch {
			hapticFail();
			toast(i18n.t('common.error'), 'err');
		} finally {
			joining = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('group.joinTitle')}</h1>
		<span class="topbar-ghost" aria-hidden="true"></span>
	</header>

	<div class="settings-body">
		{#if loading}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.searching')}</p>
			</div>
		{:else if invalid || !preview}
			<div class="empty empty-animate">
				<span class="empty-icon"><Users size={28} /></span>
				<strong>{i18n.t('group.joinInvalid')}</strong>
			</div>
		{:else}
			<section class="group-hero join-hero">
				<div class="group-hero-photo">
					<GroupAvatar
						title={preview.title}
						chatId={preview.id}
						avatarPath={alreadyMember ? preview.avatarPath : null}
						size={96}
					/>
				</div>
				<h2 class="group-hero-title">{preview.title}</h2>
				<p class="group-hero-sub">{i18n.t('group.joinLead', { title: preview.title })}</p>
				{#if preview.description}
					<p class="group-hero-desc">{preview.description}</p>
				{/if}
				{#if alreadyMember}
					<p class="group-hero-desc muted">{i18n.t('group.joinAlready')}</p>
				{/if}
				<button type="button" class="btn btn-block" disabled={joining} onclick={join}>
					{alreadyMember
						? i18n.t('group.joinOpen')
						: joining
							? i18n.t('group.joining')
							: i18n.t('group.joinCta')}
				</button>
			</section>
		{/if}
	</div>
</div>
