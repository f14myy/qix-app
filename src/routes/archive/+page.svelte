<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Avatar from '$lib/components/Avatar.svelte';
	import ChannelAvatar from '$lib/components/ChannelAvatar.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { lastMessagePreview } from '$lib/chatPreview';
	import { toast } from '$lib/flash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';
	import { formatRelativeTime } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();
	let prefBusy = $state(false);
	let deleteTarget = $state<{ id: string; title: string } | null>(null);

	function title(chat: PageData['chats'][number]) {
		if (chat.kind === 'channel' && chat.channel) {
			return i18n.t(`channel.${chat.channel.key}.title`);
		}
		return chat.peer?.displayName || chat.peer?.username || '';
	}

	async function unarchive(chatId: string) {
		if (prefBusy) return;
		prefBusy = true;
		try {
			await fetch(`/api/chats/${chatId}/prefs`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ archived: false })
			});
			await invalidateAll();
			toast(i18n.t('chats.unarchived'));
		} finally {
			prefBusy = false;
		}
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
			await invalidateAll();
			toast(i18n.t('chat.deletedBody'));
		} finally {
			prefBusy = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button
			type="button"
			class="icon-btn"
			aria-label={i18n.t('back')}
			onclick={() => goBack('/')}
		>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('chats.archive')}</h1>
	</header>

	<div class="list">
		{#if data.chats.length === 0}
			<div class="empty empty-animate">
				<span class="empty-icon"><ArchiveRestore size={28} /></span>
				<p>{i18n.t('chats.archiveEmpty')}</p>
			</div>
		{:else}
			{#each data.chats as chat (chat.id)}
				<div class="chat-row-wrap archive-row">
					<button type="button" class="chat-row" onclick={() => goto(`/chat/${chat.id}`)}>
						{#if chat.kind === 'channel' && chat.channel}
							<ChannelAvatar channelKey={chat.channel.key} size={48} />
						{:else if chat.peer}
							<Avatar
								name={title(chat)}
								avatarPath={chat.peer.avatarPath}
								userId={chat.peer.id}
							/>
						{/if}
						<div class="meta">
							<div class="row-top">
								<p class="name">
									{#if chat.kind === 'channel'}
										{title(chat)}
									{:else}
										<NameWithBadges
											name={title(chat)}
											badges={chat.peer?.badges ?? []}
											size="sm"
										/>
									{/if}
								</p>
								{#if chat.lastMessage}
									<span class="time"
										>{formatRelativeTime(chat.lastMessage.createdAt, i18n.locale)}</span
									>
								{/if}
							</div>
							<div class="row-bottom">
								<p class="preview">
									{lastMessagePreview(chat, { userId: data.user?.id, t: i18n.t })}
								</p>
							</div>
						</div>
					</button>
					<div class="archive-row-actions">
						<button
							type="button"
							class="icon-btn"
							disabled={prefBusy}
							aria-label={i18n.t('chats.unarchive')}
							title={i18n.t('chats.unarchive')}
							onclick={() => unarchive(chat.id)}
						>
							<ArchiveRestore size={18} />
						</button>
						{#if chat.kind !== 'channel' && !chat.channel}
							<button
								type="button"
								class="icon-btn danger"
								disabled={prefBusy}
								aria-label={i18n.t('chat.delete')}
								title={i18n.t('chat.delete')}
								onclick={() => (deleteTarget = { id: chat.id, title: title(chat) })}
							>
								<Trash2 size={18} />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

{#if deleteTarget}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="menu-backdrop" role="presentation" onclick={() => (deleteTarget = null)}></div>
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
				onclick={() => (deleteTarget = null)}
			>
				{i18n.t('chat.keep')}
			</button>
		</div>
	</div>
{/if}
