<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import FileIcon from '@lucide/svelte/icons/file';
	import Lock from '@lucide/svelte/icons/lock';
	import Reply from '@lucide/svelte/icons/reply';
	import Smile from '@lucide/svelte/icons/smile';
	import Avatar from './Avatar.svelte';
	import LinkCard from './LinkCard.svelte';
	import VoicePlayer from './VoicePlayer.svelte';
	import { decryptAttachmentUrl } from '$lib/e2ee/messages';
	import { haptic, hapticBurst } from '$lib/haptic';
	import { mediaUrl } from '$lib/net/media';
	import { getCachedSettings } from '$lib/settings';
	import { formatMessageTime } from '$lib/time';
	import { formatMessageHtml } from '$lib/formatMessage';
	import { REACTION_EMOJIS, type AttachmentDTO, type MessageDTO } from '$lib/types';
	import type { Locale } from '$lib/i18n';

	let {
		message,
		mine,
		peerLastReadAt = null as string | null,
		locale = 'en' as Locale,
		t,
		highlight = false,
		grouped = false,
		tail = true,
		selected = false,
		selectMode = false,
		showSender = false,
		canModerate = false,
		e2ee = null as null | { myUserId: string; peerUserId: string; peerPublicKey: string },
		onreply,
		onedit,
		ondelete,
		onreact,
		onjump,
		onretry,
		onopenImage,
		onforward,
		onpin,
		ontoggleSelect,
		onenterSelect,
		onopenSender
	}: {
		message: MessageDTO;
		mine: boolean;
		peerLastReadAt?: string | null;
		locale?: Locale;
		t: (key: string, vars?: Record<string, string | number>) => string;
		highlight?: boolean;
		grouped?: boolean;
		tail?: boolean;
		selected?: boolean;
		selectMode?: boolean;
		/** Groups only: draw the author's avatar and name on incoming bubbles. */
		showSender?: boolean;
		/** Groups only: the viewer is an admin, so they may delete anyone's message. */
		canModerate?: boolean;
		e2ee?: null | { myUserId: string; peerUserId: string; peerPublicKey: string };
		onreply: (m: MessageDTO) => void;
		onedit: (m: MessageDTO) => void;
		ondelete: (m: MessageDTO) => void;
		onreact: (m: MessageDTO, emoji: string) => void;
		onjump?: (id: string) => void;
		onretry?: (m: MessageDTO) => void;
		onopenImage?: (urls: string[], index: number) => void;
		onforward?: (m: MessageDTO) => void;
		onpin?: (m: MessageDTO) => void;
		ontoggleSelect?: (m: MessageDTO) => void;
		onenterSelect?: (m: MessageDTO) => void;
		onopenSender?: (m: MessageDTO) => void;
	} = $props();

	let menuOpen = $state(false);
	/** 'react' shows only the emoji tray — used by the swipe-right shortcut. */
	let menuMode = $state<'full' | 'react'>('full');
	let confirmDelete = $state(false);
	let swipeX = $state(0);
	let swiping = $state(false);
	let startX = 0;
	let startY = 0;
	let pressMoved = false;
	let longPressed = false;
	let lastTapAt = 0;
	let canShare = $state(false);
	let moveGuard = 0;
	let burstEmoji = $state<string | null>(null);
	let attUrls = $state<Record<string, { url: string; mime: string }>>({});

	const deleted = $derived(!!message.deletedAt);
	const failed = $derived(message.sendStatus === 'failed');
	const encrypted = $derived(message.attachments.some((a) => !!a.e2eeMeta));
	/*
	 * Group authorship. The name comes with the message rather than from the member
	 * list, so a bubble written by someone who has since left still says who wrote
	 * it. The tone is keyed off the id so one person keeps one colour for the whole
	 * conversation, the way the avatar palette already works.
	 */
	const senderName = $derived(
		message.sender ? message.sender.displayName || message.sender.username : ''
	);
	const senderTone = $derived(((message.senderId.charCodeAt(0) || 0) % 7) + 1);
	const withSender = $derived(showSender && !mine && !!message.sender);
	/** Author's own delete, or a moderator removing someone else's. */
	const mayDelete = $derived((mine || canModerate) && !message.id.startsWith('tmp-'));
	const read = $derived(
		mine &&
			!!peerLastReadAt &&
			new Date(peerLastReadAt).getTime() >= new Date(message.createdAt).getTime()
	);
	const imageUrls = $derived(
		message.attachments
			.map((a) => {
				const resolved = attUrls[a.id];
				const mime = resolved?.mime || a.mime;
				if (!mime.startsWith('image/')) return null;
				return resolved?.url || (!a.e2eeMeta ? mediaUrl(`/api/files/${a.id}`) : null);
			})
			.filter((u): u is string => !!u)
	);

	$effect(() => {
		canShare = typeof navigator !== 'undefined' && 'share' in navigator;
	});

	$effect(() => {
		if (!e2ee || !message.attachments.some((a) => !!a.e2eeMeta)) return;
		let cancelled = false;
		void (async () => {
			const next: Record<string, { url: string; mime: string }> = {};
			for (const att of message.attachments) {
				if (!att.e2eeMeta) continue;
				try {
					const res = await decryptAttachmentUrl(
						e2ee.myUserId,
						e2ee.peerUserId,
						e2ee.peerPublicKey,
						att
					);
					if (res) next[att.id] = res;
				} catch {
					// Ignore invalid E2EE attachment
				}
			}
			if (!cancelled) attUrls = next;
		})();
		return () => {
			cancelled = true;
			for (const item of Object.values(attUrls)) {
				if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
			}
		};
	});

	function attSrc(att: AttachmentDTO): string {
		const res = attUrls[att.id];
		if (res?.url) return res.url;
		if (att.e2eeMeta) return '';
		return mediaUrl(`/api/files/${att.id}`);
	}

	function attMime(att: AttachmentDTO): string {
		return attUrls[att.id]?.mime || att.mime;
	}

	function isImage(mime: string) {
		return mime.startsWith('image/');
	}

	function isVideo(mime: string) {
		return mime.startsWith('video/');
	}

	function isAudio(mime: string) {
		return mime.startsWith('audio/');
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function replyLabel() {
		const r = message.replyTo;
		if (!r) return '';
		if (r.deleted) return t('chats.deleted');
		if (r.body) return r.body;
		if (r.kind === 'voice') return t('chats.voice');
		return t('chats.attachment');
	}

	function shareText() {
		return message.body || '';
	}

	async function copyMessage() {
		closeMenu();
		const txt = shareText();
		if (!txt) return;
		try {
			await navigator.clipboard.writeText(txt);
		} catch {
			// ignore
		}
	}

	async function shareMessage() {
		closeMenu();
		const txt = shareText();
		if (!txt || !navigator.share) return;
		try {
			await navigator.share({ text: txt });
		} catch {
			// user cancelled
		}
	}

	function closeMenu() {
		menuOpen = false;
		menuMode = 'full';
		confirmDelete = false;
	}

	function openMenu(mode: 'full' | 'react' = 'full') {
		if (selectMode || failed) return;
		haptic(15);
		menuMode = mode;
		menuOpen = true;
	}

	function onPressStart(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		startX = e.clientX;
		startY = e.clientY;
		pressMoved = false;
		longPressed = false;
		moveGuard = 0;
	}

	function onPressEnd(e: PointerEvent) {
		if (longPressed) return;
		if (selectMode) return;
		if (pressMoved) return;

		const now = Date.now();
		if (now - lastTapAt < 280) {
			lastTapAt = 0;
			burstEmoji = '❤️';
			hapticBurst();
			setTimeout(() => {
				burstEmoji = null;
			}, 800);
			onreact(message, '❤️');
		} else {
			lastTapAt = now;
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (selectMode) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		swiping = true;
		startX = e.clientX;
		startY = e.clientY;
	}

	function onPointerMove(e: PointerEvent) {
		if (!swiping || selectMode) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
			pressMoved = true;
			moveGuard += Math.abs(dx) + Math.abs(dy);
		}
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
			swipeX = Math.max(-80, Math.min(80, dx));
		}
	}

	function onPointerUp() {
		if (!swiping) return;
		swiping = false;
		if (swipeX < -45) {
			haptic(10);
			onreply(message);
		} else if (swipeX > 45) {
			openMenu('react');
		}
		swipeX = 0;
	}

	function openImage(urls: string[], index: number) {
		if (moveGuard > 8) return;
		onopenImage?.(urls, index);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="bubble-row"
	class:me={mine}
	class:swiping
	class:highlight
	class:grouped
	class:tail
	class:failed
	class:selected
	class:select-mode={selectMode}
	class:with-sender={withSender}
	id="msg-{message.id}"
	role="group"
	oncontextmenu={(e) => e.preventDefault()}
	onselectstart={(e) => e.preventDefault()}
	ondragstart={(e) => e.preventDefault()}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onclick={() => {
		if (selectMode) ontoggleSelect?.(message);
	}}
>
	{#if burstEmoji}
		<span class="reaction-burst-particle" aria-hidden="true">{burstEmoji}</span>
	{/if}
	<span
		class="swipe-reply-hint"
		class:visible={swipeX < -8}
		style="opacity:{Math.min(1, Math.abs(swipeX) / 56)}; transform:translateY(-50%) scale({0.7 + Math.min(0.3, (Math.abs(swipeX) / 56) * 0.3)})"
	>
		<Reply size={18} />
	</span>
	<span
		class="swipe-react-hint"
		class:visible={swipeX > 8}
		style="opacity:{Math.min(1, swipeX / 56)}; transform:translateY(-50%) scale({0.7 + Math.min(0.3, (swipeX / 56) * 0.3)})"
	>
		<Smile size={18} />
	</span>

	{#if selectMode}
		<span class="select-check" class:on={selected} aria-hidden="true">
			{#if selected}<Check size={14} />{/if}
		</span>
	{/if}

	{#if withSender}
		<!-- Kept in the layout on grouped rows so a run of bubbles stays aligned. -->
		<span class="bubble-gutter">
			{#if tail}
				<button
					type="button"
					class="bubble-gutter-btn"
					aria-label={senderName}
					onclick={(e) => {
						e.stopPropagation();
						if (moveGuard > 8 || selectMode) return;
						onopenSender?.(message);
					}}
				>
					<Avatar
						name={senderName}
						size={28}
						avatarPath={message.sender?.avatarPath ?? null}
						userId={message.senderId}
					/>
				</button>
			{/if}
		</span>
	{/if}

	<div
		class="bubble"
		class:me={mine}
		class:them={!mine}
		class:deleted
		class:grouped
		class:tail
		class:failed
		class:selecting={menuOpen}
		style="transform:translateX({swipeX}px)"
		onpointerdown={onPressStart}
		onpointerup={onPressEnd}
		onpointerleave={onPressEnd}
		oncontextmenu={(e) => e.preventDefault()}
		role="group"
	>
		{#if withSender && !grouped}
			<button
				type="button"
				class="bubble-sender"
				data-tone={senderTone}
				onclick={(e) => {
					e.stopPropagation();
					if (moveGuard > 8 || selectMode) return;
					onopenSender?.(message);
				}}
			>
				{senderName}
			</button>
		{/if}
		{#if message.forwardedFromId}
			<p class="fwd-label">{t('chat.forwarded')}</p>
		{/if}
		{#if message.replyTo}
			<button
				type="button"
				class="reply-quote"
				onclick={() => {
					if (moveGuard > 8 || selectMode) return;
					onjump?.(message.replyTo!.id);
				}}
			>
				<span class="reply-bar"></span>
				{#if message.replyTo.thumbUrl && message.replyTo.kind !== 'voice'}
					{#if message.replyTo.kind === 'video' || message.replyTo.thumbUrl.includes('video')}
						<video class="reply-thumb" src={message.replyTo.thumbUrl} muted playsinline></video>
					{:else}
						<img class="reply-thumb" src={message.replyTo.thumbUrl} alt="" />
					{/if}
				{/if}
				<span>{replyLabel()}</span>
			</button>
		{/if}

		{#if message.kind === 'voice' && message.attachments[0]}
			<VoicePlayer id={message.id} src={attSrc(message.attachments[0]) || mediaUrl(`/api/files/${message.attachments[0].id}`)} />
		{:else if message.kind === 'voice' && message.id.startsWith('tmp-')}
			<p class="body">{t('chats.voice')}</p>
		{:else if message.attachments.length}
			<div class="att-list">
				{#each message.attachments as att, ai (att.id)}
					{#if isImage(attMime(att))}
						<button
							type="button"
							class="att-image-btn"
							onclick={() => {
								const src = attSrc(att);
								const idx = imageUrls.indexOf(src);
								openImage(imageUrls, idx >= 0 ? idx : 0);
							}}
						>
							<img class="att-image" src={attSrc(att)} alt={att.filename} loading="lazy" />
						</button>
					{:else if isVideo(attMime(att))}
						<video class="att-video" src={attSrc(att)} controls preload="metadata"></video>
					{:else if isAudio(attMime(att))}
						<audio class="att-audio" src={attSrc(att)} controls></audio>
					{:else}
						<a class="att-file" href={attSrc(att)} download={att.filename} target="_blank">
							<FileIcon size={24} />
							<span class="att-file-meta">
								<span class="att-file-name">{att.filename}</span>
								<span class="att-file-size">{formatBytes(att.size)}</span>
							</span>
						</a>
					{/if}
				{/each}
			</div>
		{/if}

		{#if deleted}
			<p class="body deleted">{t('chats.deleted')}</p>
		{:else if message.body}
			<p class="body">
				{#if encrypted}
					<span class="e2ee-tag" title={t('e2ee.active')}><Lock size={12} /></span>
				{/if}
				{@html formatMessageHtml(message.body)}
			</p>
		{/if}

		{#if message.linkPreview && getCachedSettings().linkPreviews}
			<LinkCard preview={message.linkPreview} />
		{/if}

		{#if message.reactions.length}
			<div class="reaction-chips">
				{#each message.reactions as r (r.emoji)}
					<button
						type="button"
						class="reaction-chip"
						class:me={r.me}
						onclick={() => onreact(message, r.emoji)}
					>
						{r.emoji} {r.count}
					</button>
				{/each}
			</div>
		{/if}

		{#if failed}
			<button type="button" class="retry-chip" onclick={() => onretry?.(message)}>
				{t('chat.retrySend')}
			</button>
		{/if}

		<!-- Only the last message of a group carries the time, so runs stay quiet -->
		{#if tail || message.editedAt || failed}
			<span class="time">
				{#if message.editedAt}
					<span class="edited">{t('chat.edited')}</span>
				{/if}
				{formatMessageTime(message.createdAt, locale)}
				{#if mine}
					<span
						class="receipt"
						class:read
						class:pending={message.id.startsWith('tmp-') && !failed}
						class:failed
					>
						{#if failed}
							!
						{:else if message.id.startsWith('tmp-')}
							<Check size={14} />
						{:else if read}
							<CheckCheck size={14} />
						{:else}
							<Check size={14} />
						{/if}
					</span>
				{/if}
			</span>
		{/if}
	</div>
</div>

{#if menuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={closeMenu}></div>
	<div class="msg-sheet">
		{#if !deleted && !confirmDelete}
			<div class="react-bar">
				{#each REACTION_EMOJIS as emoji}
					<button
						type="button"
						onclick={() => {
							burstEmoji = emoji;
							hapticBurst();
							setTimeout(() => {
								burstEmoji = null;
							}, 800);
							closeMenu();
							onreact(message, emoji);
						}}>{emoji}</button
					>
				{/each}
			</div>
		{/if}
		{#if menuMode === 'full'}
		<div class="msg-menu">
			{#if confirmDelete}
				<p class="msg-confirm-text">{t('chat.deleteConfirm')}</p>
				<button
					type="button"
					class="danger"
					onclick={() => {
						closeMenu();
						ondelete(message);
					}}>{t('chat.deleteConfirmAction')}</button
				>
				<button type="button" onclick={() => (confirmDelete = false)}>{t('chat.keep')}</button>
			{:else}
				<button
					type="button"
					onclick={() => {
						closeMenu();
						onreply(message);
					}}>{t('chat.reply')}</button
				>
				{#if onforward}
					<button
						type="button"
						onclick={() => {
							closeMenu();
							onforward(message);
						}}>{t('chat.forward')}</button
					>
				{/if}
				{#if onpin && !message.id.startsWith('tmp-')}
					<button
						type="button"
						onclick={() => {
							closeMenu();
							onpin(message);
						}}>{t('chat.pin')}</button
					>
				{/if}
				{#if onenterSelect}
					<button
						type="button"
						onclick={() => {
							closeMenu();
							onenterSelect(message);
						}}>{t('chat.select')}</button
					>
				{/if}
				{#if shareText()}
					<button type="button" onclick={copyMessage}>{t('chat.copy')}</button>
					{#if canShare}
						<button type="button" onclick={shareMessage}>{t('chat.share')}</button>
					{/if}
				{/if}
				{#if mine && message.kind !== 'voice' && !message.id.startsWith('tmp-')}
					<button
						type="button"
						onclick={() => {
							closeMenu();
							onedit(message);
						}}>{t('chat.edit')}</button
					>
				{/if}
				{#if mayDelete}
					<button
						type="button"
						class="danger"
						onclick={() => {
							if (getCachedSettings().confirmMessageDelete) {
								confirmDelete = true;
							} else {
								closeMenu();
								ondelete(message);
							}
						}}>{t('chat.delete')}</button
					>
				{/if}
			{/if}
		</div>
		{/if}
	</div>
{/if}
