<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Archive from '@lucide/svelte/icons/archive';
	import Clock from '@lucide/svelte/icons/clock';
	import Flag from '@lucide/svelte/icons/flag';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Copy from '@lucide/svelte/icons/copy';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Forward from '@lucide/svelte/icons/forward';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Phone from '@lucide/svelte/icons/phone';
	import Pin from '@lucide/svelte/icons/pin';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Video from '@lucide/svelte/icons/video';
	import Pointer from '@lucide/svelte/icons/pointer';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '$lib/components/Avatar.svelte';
	import ChannelAvatar from '$lib/components/ChannelAvatar.svelte';
	import ChatBubble from '$lib/components/ChatBubble.svelte';
	import CoachTip from '$lib/components/CoachTip.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import GroupAvatar from '$lib/components/GroupAvatar.svelte';
	import ImageLightbox from '$lib/components/ImageLightbox.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { mapCallStartError, startOutgoingCall } from '$lib/calls/store.svelte';
	import { dismissCoach, markCoachShown, shouldShowCoach } from '$lib/coach';
	import { ENABLE_E2EE } from '$lib/e2ee/config';
	import {
		decryptMessages,
		encryptOutgoing
	} from '$lib/e2ee/messages';
	import { toast, promptDialog } from '$lib/flash.svelte';
	import { haptic, hapticFail, hapticSuccess } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack as navigateBack } from '$lib/nav';
	import {
		enqueueSend,
		filesFromQueued,
		listQueued,
		removeQueued,
		serializeFiles
	} from '$lib/sendQueue';
	import { formatSystemLine, SYSTEM_EVENT_KEYS } from '$lib/systemMessage';
	import { dayKey, formatDayLabel, isOnlineIso, formatLastSeen } from '$lib/time';
	import { startViewTransition } from '$lib/viewTransition';
	import type {
		ChatListItem,
		GroupInfoDTO,
		GroupMemberDTO,
		MediaItemDTO,
		MessageDTO
	} from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();

	let messages = $state<MessageDTO[]>([]);
	let peerLastReadAt = $state<string | null>(null);
	let myLastReadAt = $state<string | null>(null);
	let listEl: HTMLDivElement | undefined = $state();
	let error = $state('');
	let typing = $state(false);
	let typingTimer: ReturnType<typeof setTimeout> | undefined;
	let replyTo = $state<MessageDTO | null>(null);
	let editing = $state<MessageDTO | null>(null);
	let peerSeen = $state<string | null>(null);
	let lastTypingSent = 0;
	let highlightId = $state<string | null>(null);
	let atBottom = $state(true);
	let showJump = $state(false);
	let stickyLabel = $state('');
	let lightbox = $state<{ urls: string[]; index: number } | null>(null);
	let viewportH = $state<number | null>(null);
	let viewportOffset = $state(0);
	let keyboardOpen = $state(false);
	let hasMore = $state(true);
	let loadingOlder = $state(false);
	let pendingNewCount = $state(0);
	let firstUnreadId = $state<string | null>(null);
	let e2eeOn = $state(false);
	let peerE2eeKey = $state<string | null>(null);
	let pinnedMessage = $state<MessageDTO | null>(null);
	let disappearAfterSec = $state(0);
	let selectMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let showMenu = $state(false);
	let showDeleteModal = $state(false);
	let showSearch = $state(false);
	let showGallery = $state(false);
	let showForward = $state(false);
	let forwardIds = $state<string[]>([]);
	let searchQ = $state('');
	let searchHits = $state<MessageDTO[]>([]);
	let gallery = $state<MediaItemDTO[]>([]);
	let forwardChats = $state<ChatListItem[]>([]);
	let searchingInChat = $state(false);
	let messagesReady = $state(false);
	let showGestureCoach = $state(false);
	let showFormatCoach = $state(false);
	let groupOverride = $state<{ group: GroupInfoDTO; members: GroupMemberDTO[] } | null>(null);
	let typingUserId = $state<string | null>(null);
	let showLeaveModal = $state(false);
	let showDeleteGroupModal = $state(false);

	type TimelineItem =
		| { kind: 'sep'; key: string; label: string }
		| { kind: 'unread'; key: string }
		| { kind: 'sys'; key: string; text: string }
		| {
				kind: 'msg';
				key: string;
				message: MessageDTO;
				grouped: boolean;
				tail: boolean;
		  };

	const GROUP_MS = 2 * 60 * 1000;

	const timeline = $derived.by(() => {
		const items: TimelineItem[] = [];
		let lastDay = '';
		const visible = messages.filter((m) => !m.deletedAt);
		for (let i = 0; i < visible.length; i++) {
			const message = visible[i]!;
			const key = dayKey(message.createdAt);
			if (key !== lastDay) {
				items.push({
					kind: 'sep',
					key: `d-${key}`,
					label: formatDayLabel(message.createdAt, i18n.locale)
				});
				lastDay = key;
			}

			if (message.kind === 'system' && message.system) {
				const template = i18n.t(SYSTEM_EVENT_KEYS[message.system.event]);
				items.push({
					kind: 'sys',
					key: message.id,
					text: formatSystemLine(template, message.system)
				});
				continue;
			}

			const prev = visible[i - 1];
			const next = visible[i + 1];
			const samePrev =
				!!prev &&
				prev.kind !== 'system' &&
				prev.senderId === message.senderId &&
				dayKey(prev.createdAt) === key &&
				Math.abs(new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()) <
					GROUP_MS;
			const sameNext =
				!!next &&
				next.kind !== 'system' &&
				next.senderId === message.senderId &&
				dayKey(next.createdAt) === key &&
				Math.abs(new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime()) <
					GROUP_MS;
			const startsUnread = !!prev && message.id === firstUnreadId;
			if (startsUnread) items.push({ kind: 'unread', key: `u-${message.id}` });
			items.push({
				kind: 'msg',
				key: message.id,
				message,
				grouped: samePrev && !startsUnread,
				tail: !sameNext
			});
		}
		return items;
	});

	const isChannel = $derived(data.kind === 'channel' && !!data.channel);
	const group = $derived(groupOverride?.group ?? data.group);
	const members = $derived(groupOverride?.members ?? data.members);
	const isGroup = $derived(data.kind === 'group' && !!group);
	const peerTitle = $derived(
		isChannel
			? i18n.t(`channel.${data.channel!.key}.title`)
			: isGroup
				? group!.title
				: data.peer
					? data.peer.displayName?.trim() || data.peer.username
					: ''
	);
	const groupTitle = $derived(group?.title || i18n.t('group.titleDefault'));

	const statusText = $derived.by(() => {
		if (isGroup) {
			const count = group?.memberCount ?? members?.length ?? 0;
			return count === 1 ? i18n.t('group.membersOne') : i18n.t('group.members', { n: count });
		}
		if (isChannel) return i18n.t('channel.title');
		if (!peerSeen) return '';
		return isOnlineIso(peerSeen) ? i18n.t('chat.online') : formatLastSeen(peerSeen, i18n.locale);
	});
	const online = $derived(!isChannel && !isGroup && isOnlineIso(peerSeen));
	const selectedCount = $derived(selectedIds.size);
	const showJumpUnread = $derived(
		!atBottom &&
			!!firstUnreadId &&
			messages.some((m) => m.id === firstUnreadId) &&
			(!listEl || listEl.scrollTop > 300)
	);

	const canPost = $derived.by(() => {
		if (isChannel) return !!data.channel?.canPost;
		if (isGroup) return !!group?.canPost;
		return true;
	});

	const e2eePeerKey = $derived(data.peer?.e2eePublicKey ?? peerE2eeKey);
	const canE2ee = $derived(
		!isChannel &&
			!isGroup &&
			ENABLE_E2EE &&
			!!data.user?.e2eePublicKey &&
			!!e2eePeerKey &&
			e2eeOn
	);

	const pinnedPreview = $derived.by(() => {
		if (!pinnedMessage) return '';
		if (pinnedMessage.deletedAt) return i18n.t('chats.deleted');
		if (pinnedMessage.body) return pinnedMessage.body;
		if (pinnedMessage.kind === 'voice') return i18n.t('chats.voice');
		if (pinnedMessage.attachments.length) return i18n.t('chats.attachment');
		return i18n.t('chats.pinned');
	});

	onMount(() => {
		messagesReady = false;
		peerLastReadAt = data.peerLastReadAt;
		myLastReadAt = data.myLastReadAt;
		disappearAfterSec = data.disappearAfterSec ?? 0;
		peerSeen = data.peer?.lastSeenAt ?? null;
		pinnedMessage = data.pinnedMessage ?? null;

		void (async () => {
			let loadedMsgs = data.messages ?? [];
			if (ENABLE_E2EE && data.user && data.peer && e2eePeerKey) {
				loadedMsgs = await decryptMessages(
					data.user.id,
					data.peer.id,
					e2eePeerKey,
					loadedMsgs
				);
			}
			messages = loadedMsgs;
			computeUnreadDivider();
			messagesReady = true;

			queueMicrotask(() => {
				if (firstUnreadId) {
					const el = document.getElementById(`msg-${firstUnreadId}`);
					if (el) {
						el.scrollIntoView({ block: 'center' });
						return;
					}
				}
				scrollToBottom(false);
			});
		})();

		if (shouldShowCoach('qix-hint-msg-gestures')) showGestureCoach = true;
		else if (shouldShowCoach('qix-hint-format')) showFormatCoach = true;

		let es: EventSource | null = null;
		let closedByUs = false;

		function connectSSE() {
			es = new EventSource('/api/events');

			es.onmessage = (event) => {
				try {
					const ev = JSON.parse(event.data);
					if (ev.type === 'chat_update' && ev.chatId === data.chatId) {
						if (ev.deletedForUser) {
							void goto('/', { replaceState: true });
							return;
						}
						if (ev.message) {
							void handleNewMessage(ev.message);
						}
						if (ev.readAt) {
							if (ev.userId === data.user?.id) myLastReadAt = ev.readAt;
							else peerLastReadAt = ev.readAt;
						}
					} else if (ev.type === 'message_deleted' && ev.chatId === data.chatId) {
						messages = messages.filter((m) => m.id !== ev.messageId);
						if (pinnedMessage?.id === ev.messageId) pinnedMessage = null;
					} else if (ev.type === 'message_edited' && ev.chatId === data.chatId) {
						messages = messages.map((m) =>
							m.id === ev.messageId
								? { ...m, body: ev.body, editedAt: ev.editedAt ?? new Date().toISOString() }
								: m
						);
					} else if (ev.type === 'pinned_changed' && ev.chatId === data.chatId) {
						pinnedMessage = ev.message ?? null;
					} else if (ev.type === 'reaction_update' && ev.chatId === data.chatId) {
						messages = messages.map((m) =>
							m.id === ev.messageId ? { ...m, reactions: ev.reactions } : m
						);
					} else if (ev.type === 'typing' && ev.chatId === data.chatId && ev.userId !== data.user?.id) {
						showTypingIndicator(ev.userId);
					} else if (ev.type === 'last_seen' && ev.userId === data.peer?.id) {
						peerSeen = ev.at;
					} else if (ev.type === 'group_update' && ev.chatId === data.chatId) {
						void fetchGroupData();
					}
				} catch {
					// Ignore malformed SSE payload
				}
			};

			es.onerror = () => {
				if (closedByUs) return;
				es?.close();
				setTimeout(connectSSE, 3000);
			};
		}

		connectSSE();

		const queueInterval = setInterval(() => void flushQueue(), 3000);
		void flushQueue();

		const vv = window.visualViewport;
		const syncKeyboard = () => {
			const kh = window.innerHeight - (vv?.height ?? window.innerHeight);
			if (kh > 100) {
				keyboardOpen = true;
				viewportH = vv!.height;
				viewportOffset = vv!.offsetTop;
			} else {
				keyboardOpen = false;
				viewportH = null;
				viewportOffset = 0;
			}
			if (atBottom) scrollToBottom(false);
		};
		vv?.addEventListener('resize', syncKeyboard);
		vv?.addEventListener('scroll', syncKeyboard);

		return () => {
			closedByUs = true;
			es?.close();
			clearInterval(queueInterval);
			clearTimeout(typingTimer);
			vv?.removeEventListener('resize', syncKeyboard);
			vv?.removeEventListener('scroll', syncKeyboard);
		};
	});

	async function fetchGroupData() {
		try {
			const res = await fetch(`/api/chats/${data.chatId}/group`);
			if (res.status === 404) {
				void goto('/', { replaceState: true });
				return;
			}
			const json = await res.json();
			if (res.ok && json.group) {
				groupOverride = { group: json.group, members: json.members ?? [] };
			}
		} catch {
			// ignore transient refresh failure
		}
	}

	function computeUnreadDivider() {
		if (!myLastReadAt) {
			const firstOther = messages.find((m) => m.senderId !== data.user?.id);
			firstUnreadId = firstOther?.id ?? null;
			return;
		}
		const readTime = new Date(myLastReadAt).getTime();
		const unread = messages.find(
			(m) => m.senderId !== data.user?.id && new Date(m.createdAt).getTime() > readTime
		);
		firstUnreadId = unread?.id ?? null;
	}

	async function handleNewMessage(rawMsg: MessageDTO) {
		let msg = rawMsg;
		if (ENABLE_E2EE && data.user && data.peer && e2eePeerKey) {
			const decrypted = await decryptMessages(data.user.id, data.peer.id, e2eePeerKey, [rawMsg]);
			if (decrypted[0]) msg = decrypted[0];
		}

		const exists = messages.some((m) => m.id === msg.id);
		if (exists) return;

		const isMine = msg.senderId === data.user?.id;
		if (!isMine && atBottom) {
			markRead();
		}

		if (!atBottom && !isMine) {
			pendingNewCount++;
		}

		messages = [...messages, msg];

		if (isMine || atBottom) {
			queueMicrotask(() => scrollToBottom(true));
		}
	}

	function showTypingIndicator(userId?: string) {
		typingUserId = userId ?? null;
		typing = true;
		clearTimeout(typingTimer);
		typingTimer = setTimeout(() => {
			typing = false;
			typingUserId = null;
		}, 3000);
	}

	function scrollToBottom(smooth = false) {
		if (!listEl) return;
		listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
		atBottom = true;
		pendingNewCount = 0;
	}

	function onListScroll() {
		if (!listEl) return;
		const { scrollTop, scrollHeight, clientHeight } = listEl;
		atBottom = scrollHeight - scrollTop - clientHeight < 60;
		showJump = !atBottom;
		if (atBottom) pendingNewCount = 0;

		if (scrollTop < 40 && hasMore && !loadingOlder) {
			void loadOlderMessages();
		}
	}

	async function loadOlderMessages() {
		if (loadingOlder || !messages.length || !hasMore) return;
		loadingOlder = true;
		const oldest = messages[0];

		try {
			const res = await fetch(`/api/chats/${data.chatId}/messages?before=${oldest.id}`);
			const json = await res.json();
			if (!res.ok) return;
			let fetched: MessageDTO[] = json.messages ?? [];

			if (fetched.length < 50) hasMore = false;
			if (!fetched.length) return;

			if (ENABLE_E2EE && data.user && data.peer && e2eePeerKey) {
				fetched = await decryptMessages(data.user.id, data.peer.id, e2eePeerKey, fetched);
			}

			const prevHeight = listEl?.scrollHeight ?? 0;
			messages = [...fetched, ...messages];

			queueMicrotask(() => {
				if (listEl) {
					const newHeight = listEl.scrollHeight;
					listEl.scrollTop = newHeight - prevHeight;
				}
			});
		} catch {
			// ignore fetch error
		} finally {
			loadingOlder = false;
		}
	}

	function markRead() {
		if (!messages.length) return;
		const latest = messages[messages.length - 1];
		void fetch(`/api/chats/${data.chatId}/read`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ messageId: latest.id })
		});
	}

	function emitTyping() {
		const now = Date.now();
		if (now - lastTypingSent < 2000) return;
		lastTypingSent = now;
		void fetch(`/api/chats/${data.chatId}/typing`, { method: 'POST' });
	}

	async function send(payload: {
		body: string;
		files: File[];
		kind?: 'text' | 'voice' | 'video';
		replyToId?: string | null;
		editId?: string | null;
	}) {
		let body = payload.body.trim();
		let files = payload.files;
		if (!body && !files.length) return;

		let e2eeMeta: string | null = null;
		if (canE2ee && data.user && data.peer && e2eePeerKey) {
			const enc = await encryptOutgoing({
				myUserId: data.user.id,
				peerUserId: data.peer.id,
				peerPublicKeyJson: e2eePeerKey,
				body,
				files: []
			});
			if (enc) body = enc.body;
		}

		const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const optimisticMsg: MessageDTO = {
			id: tempId,
			chatId: data.chatId,
			senderId: data.user?.id ?? '',
			body,
			kind: 'text',
			createdAt: new Date().toISOString(),
			editedAt: null,
			deletedAt: null,
			expiresAt: null,
			forwardedFromId: null,
			replyTo: replyTo
				? {
						id: replyTo.id,
						senderId: replyTo.senderId,
						body: replyTo.body,
						deleted: false,
						kind: replyTo.kind,
						thumbUrl: null
					}
				: null,
			attachments: files.map((f, idx) => ({
				id: `tmp-file-${idx}`,
				filename: f.name,
				mime: f.type,
				size: f.size,
				e2eeMeta: null
			})),
			linkPreview: null,
			reactions: [],
			sender: isGroup && data.user ? {
				id: data.user.id,
				username: data.user.username,
				displayName: data.user.displayName,
				avatarPath: data.user.avatarPath
			} : null,
			sendStatus: 'pending'
		};

		messages = [...messages, optimisticMsg];
		replyTo = null;
		scrollToBottom(true);

		const serializedFiles = await serializeFiles(files);
		enqueueSend({
			tmpId: tempId,
			chatId: data.chatId,
			body,
			kind: 'text',
			replyToId: optimisticMsg.replyTo?.id ?? null,
			files: serializedFiles,
			createdAt: Date.now()
		});

		void flushQueue();
	}

	async function flushQueue() {
		const items = await listQueued(data.chatId);
		for (const item of items) {
			try {
				const form = new FormData();
				form.append('body', item.body);
				if (item.replyToId) form.append('replyToId', item.replyToId);
				const realFiles = await filesFromQueued(item.files);
				for (const f of realFiles) form.append('files', f);

				const res = await fetch(`/api/chats/${data.chatId}/messages`, {
					method: 'POST',
					body: form
				});
				const json = await res.json();
				if (res.ok && json.message) {
					removeQueued(item.tmpId);
					messages = messages.map((m) => (m.id === item.tmpId ? json.message : m));
				} else {
					messages = messages.map((m) =>
						m.id === item.tmpId ? { ...m, sendStatus: 'failed' } : m
					);
				}
			} catch {
				messages = messages.map((m) => (m.id === item.tmpId ? { ...m, sendStatus: 'failed' } : m));
			}
		}
	}

	function retrySend(msg: MessageDTO) {
		messages = messages.map((m) => (m.id === msg.id ? { ...m, sendStatus: 'pending' } : m));
		void flushQueue();
	}

	async function remove(msg: MessageDTO) {
		haptic(10);
		try {
			const res = await fetch(`/api/chats/${data.chatId}/messages/${msg.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				messages = messages.filter((m) => m.id !== msg.id);
				hapticSuccess();
			} else {
				hapticFail();
			}
		} catch {
			hapticFail();
		}
	}

	async function react(msg: MessageDTO, emoji: string) {
		haptic(8);
		try {
			const res = await fetch(`/api/chats/${data.chatId}/messages/${msg.id}/reactions`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ emoji })
			});
			const json = await res.json();
			if (res.ok && json.reactions) {
				messages = messages.map((m) => (m.id === msg.id ? { ...m, reactions: json.reactions } : m));
			}
		} catch {
			// ignore reaction error
		}
	}

	async function pinMessage(msg: MessageDTO | null) {
		try {
			const res = await fetch(`/api/chats/${data.chatId}/pin`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messageId: msg ? msg.id : null })
			});
			if (res.ok) {
				pinnedMessage = msg;
				toast(msg ? i18n.t('chats.pinned') : i18n.t('actions.unpin'));
			}
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}

	function jumpTo(id: string) {
		const el = document.getElementById(`msg-${id}`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			highlightId = id;
			setTimeout(() => {
				highlightId = null;
			}, 2000);
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	async function runInChatSearch() {
		const q = searchQ.trim();
		if (q.length < 2) {
			searchHits = [];
			return;
		}
		searchingInChat = true;
		try {
			const res = await fetch(`/api/chats/${data.chatId}/media?q=${encodeURIComponent(q)}`);
			const json = await res.json();
			if (res.ok) searchHits = json.messages ?? [];
		} finally {
			searchingInChat = false;
		}
	}

	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(runInChatSearch, 220);
	}

	function toggleSelect(msg: MessageDTO) {
		const next = new Set(selectedIds);
		if (next.has(msg.id)) next.delete(msg.id);
		else next.add(msg.id);
		selectedIds = next;
		if (selectedIds.size === 0) selectMode = false;
	}

	function enterSelect(msg: MessageDTO) {
		selectMode = true;
		selectedIds = new Set([msg.id]);
		showMenu = false;
	}

	function exitSelect() {
		selectMode = false;
		selectedIds = new Set();
	}

	/**
	 * Back doubles as "leave select mode" — the same as the site. Without this the
	 * only way out of a selection on Android is the hardware back button, which
	 * leaves the chat entirely.
	 */
	function goBack() {
		if (selectMode) {
			exitSelect();
			return;
		}
		startViewTransition(() => {
			navigateBack('/');
		});
	}

	function bulkCopy() {
		const selMsgs = messages.filter((m) => selectedIds.has(m.id));
		const text = selMsgs.map((m) => m.body).filter(Boolean).join('\n\n');
		if (text) {
			void navigator.clipboard.writeText(text);
			toast(i18n.t('chat.copied'));
		}
		selectMode = false;
		selectedIds = new Set();
	}

	async function bulkDelete() {
		const ids = [...selectedIds];
		for (const id of ids) {
			const m = messages.find((item) => item.id === id);
			if (m) await remove(m);
		}
		selectMode = false;
		selectedIds = new Set();
	}

	async function startCall(video: boolean) {
		try {
			await startOutgoingCall(data.chatId, video);
		} catch (err) {
			const raw = err instanceof Error ? err.message : '';
			const kind = mapCallStartError(raw);
			toast(i18n.t(kind === 'busy' ? 'call.busy' : 'call.failed'), 'err');
		}
	}

	function openForward(ids: string[]) {
		forwardIds = ids;
		showForward = true;
		void (async () => {
			try {
				const res = await fetch('/api/chats');
				const json = await res.json();
				if (res.ok) forwardChats = json.chats ?? [];
			} catch {
				forwardChats = [];
			}
		})();
	}

	async function forwardTo(targetChatId: string) {
		showForward = false;
		for (const mid of forwardIds) {
			try {
				const m = messages.find((item) => item.id === mid);
				if (!m) continue;
				const form = new FormData();
				form.append('body', m.body);
				form.append('forwardedFromId', m.senderId);
				await fetch(`/api/chats/${targetChatId}/messages`, {
					method: 'POST',
					body: form
				});
			} catch {
				// ignore forward error
			}
		}
		toast(i18n.t('chat.forwardedDone'));
		selectMode = false;
		selectedIds = new Set();
	}

	async function deleteChatConfirm(mode: 'self' | 'everyone') {
		showDeleteModal = false;
		showMenu = false;
		try {
			const res = await fetch(`/api/chats/${data.chatId}`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			if (res.ok) {
				toast(i18n.t('chat.deletedDone'));
				await goto('/', { replaceState: true });
			} else {
				const json = await res.json();
				toast(json.error || i18n.t('common.error'), 'err');
			}
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}

	async function leaveGroupConfirm() {
		showLeaveModal = false;
		showMenu = false;
		try {
			const res = await fetch(`/api/chats/${data.chatId}/leave`, { method: 'POST' });
			const json = await res.json();
			if (res.ok) {
				toast(i18n.t('group.leaveDone'));
				await goto('/', { replaceState: true });
			} else {
				toast(json.error || i18n.t('common.error'), 'err');
			}
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}

	async function deleteGroupConfirm() {
		showDeleteGroupModal = false;
		showMenu = false;
		try {
			const res = await fetch(`/api/chats/${data.chatId}/group`, { method: 'DELETE' });
			const json = await res.json();
			if (res.ok) {
				toast(i18n.t('group.deleteDone'));
				await goto('/', { replaceState: true });
			} else {
				toast(json.error || i18n.t('common.error'), 'err');
			}
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}
</script>

<div
	class="screen chat-view"
	class:kb-open={keyboardOpen}
	style={viewportH
		? `padding-bottom:0;height:${viewportH}px;max-height:${viewportH}px;transform:translateY(${viewportOffset}px)`
		: 'padding-bottom:0'}
>
	<header class="topbar chat-topbar">
		<button type="button" class="icon-btn back-btn" aria-label={i18n.t('back')} onclick={goBack}>
			<ArrowLeft size={22} />
		</button>

		{#if selectMode}
			<div class="peer-meta select-meta">
				<h1 class="peer-title">{i18n.t('chat.selected', { n: selectedCount })}</h1>
			</div>
			<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={exitSelect}>
				<X size={20} />
			</button>
		{:else if isChannel}
			<div class="peer-link channel-head">
				<ChannelAvatar channelKey={data.channel!.key} size={36} />
				<div class="peer-meta">
					<h1 class="peer-title">{peerTitle}</h1>
					{#if statusText}
						<span class="peer-status">{statusText}</span>
					{/if}
				</div>
			</div>
			<div class="topbar-actions">
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('chats.searchMessages')}
					onclick={() => (showSearch = true)}
				>
					<Search size={20} />
				</button>
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('chat.more')}
					onclick={() => (showMenu = true)}
				>
					<Ellipsis size={20} />
				</button>
			</div>
		{:else if isGroup}
			<a class="peer-link" href="/chat/{data.chatId}/group">
				<GroupAvatar title={groupTitle} chatId={data.chatId} avatarPath={group?.avatarPath} size={36} />
				<div class="peer-meta">
					<h1 class="peer-title">{groupTitle}</h1>
					{#if statusText}
						<span class="peer-status">
							{#if typing}
								<span class="typing-label">{i18n.t('chat.typing')}</span>
								<span class="typing-dots" aria-hidden="true"
									><i></i><i></i><i></i></span
								>
							{:else}
								{statusText}
							{/if}
						</span>
					{/if}
				</div>
			</a>
			<div class="topbar-actions">
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('chats.searchMessages')}
					onclick={() => (showSearch = true)}
				>
					<Search size={20} />
				</button>
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('chat.more')}
					onclick={() => (showMenu = true)}
				>
					<Ellipsis size={20} />
				</button>
			</div>
		{:else}
			<a class="peer-link" href="/u/{data.peer!.username}">
				<Avatar
					name={peerTitle}
					size={36}
					avatarPath={data.peer!.avatarPath}
					userId={data.peer!.id}
				/>
				<div class="peer-meta">
					<h1 class="peer-title">
						<NameWithBadges name={peerTitle} badges={data.peer!.badges} size="sm" />
					</h1>
					{#if statusText}
						<span class="peer-status" class:online>
							{#if canE2ee}
								<span class="e2ee-status" title={i18n.t('e2ee.active')}
									><Lock size={11} /></span
								>
							{/if}
							{#if typing}
								<span class="typing-label">{i18n.t('chat.typing')}</span>
								<span class="typing-dots" aria-hidden="true"
									><i></i><i></i><i></i></span
								>
							{:else}
								{statusText}
							{/if}
						</span>
					{:else if canE2ee}
						<span class="peer-status e2ee-only">
							<span class="e2ee-status" title={i18n.t('e2ee.active')}><Lock size={11} /></span>
							{i18n.t('e2ee.active')}
						</span>
					{/if}
				</div>
			</a>
			<div class="topbar-actions">
				{#if !isChannel}
					<button
						type="button"
						class="icon-btn call-head-btn"
						aria-label={i18n.t('call.voice')}
						title={i18n.t('call.voice')}
						onclick={() => startCall(false)}
					>
						<Phone size={19} />
					</button>
					<button
						type="button"
						class="icon-btn call-head-btn"
						aria-label={i18n.t('call.video')}
						title={i18n.t('call.video')}
						onclick={() => startCall(true)}
					>
						<Video size={19} />
					</button>
				{/if}
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('chat.more')}
					onclick={() => (showMenu = true)}
				>
					<Ellipsis size={20} />
				</button>
			</div>
		{/if}
	</header>

	{#if showGestureCoach}
		<CoachTip
			actionLabel={i18n.t('chat.coachDismiss')}
			ondismiss={() => {
				showGestureCoach = false;
				dismissCoach('qix-hint-msg-gestures');
			}}
		>
			{#snippet icon()}
				<Pointer size={20} />
			{/snippet}
			<p>{i18n.t('chat.coachGestures')}</p>
		</CoachTip>
	{:else if showFormatCoach}
		<CoachTip
			tone="soft"
			actionLabel={i18n.t('coach.gotIt')}
			ondismiss={() => {
				showFormatCoach = false;
				dismissCoach('qix-hint-format');
			}}
		>
			{#snippet icon()}
				<Sparkles size={20} />
			{/snippet}
			<p>{i18n.t('coach.format')}</p>
		</CoachTip>
	{/if}

	{#if pinnedMessage && !selectMode}
		<button type="button" class="pin-banner" onclick={() => jumpTo(pinnedMessage!.id)}>
			<span class="pin-banner-ico"><Pin size={14} /></span>
			<span class="pin-banner-text">{pinnedPreview}</span>
			<span
				class="pin-banner-clear"
				role="button"
				tabindex="0"
				onclick={(e) => {
					e.stopPropagation();
					pinMessage(null);
				}}
				onkeydown={(e) => e.key === 'Enter' && pinMessage(null)}
			>
				<X size={14} />
			</span>
		</button>
	{/if}

	<div class="messages-wrap">
		{#if stickyLabel}
			<div class="sticky-date" aria-hidden="true"><span>{stickyLabel}</span></div>
		{/if}

		{#if loadingOlder}
			<div class="load-older" aria-hidden="true"><span></span></div>
		{/if}

		<div class="messages" bind:this={listEl} onscroll={onListScroll}>
			{#if !messagesReady}
				<div class="chat-skeleton" aria-hidden="true">
					<span class="sk sk-them"></span>
					<span class="sk sk-me"></span>
					<span class="sk sk-them short"></span>
				</div>
			{:else if messages.length === 0}
				<div class="empty empty-animate chat-empty">
					<span class="empty-icon"><MessageCircle size={28} /></span>
					<strong>{i18n.t('chat.emptyTitle')}</strong>
					<p>{isChannel ? i18n.t('chat.emptyChannel') : isGroup ? i18n.t('group.empty') : i18n.t('chat.empty')}</p>
				</div>
			{/if}
			{#each timeline as item (item.key)}
				{#if item.kind === 'sep'}
					<div data-day-label={item.label}>
						<DateSeparator label={item.label} />
					</div>
				{:else if item.kind === 'unread'}
					<div class="unread-divider"><span>{i18n.t('chat.unreadSince')}</span></div>
				{:else if item.kind === 'sys'}
					<div class="sys-line"><span>{item.text}</span></div>
				{:else}
					<ChatBubble
						message={item.message}
						mine={item.message.senderId === data.user?.id}
						{peerLastReadAt}
						locale={i18n.locale}
						t={i18n.t}
						highlight={highlightId === item.message.id}
						grouped={item.grouped}
						tail={item.tail}
						{selectMode}
						showSender={isGroup}
						canModerate={isGroup && !!group?.canManage}
						selected={selectedIds.has(item.message.id)}
						e2ee={canE2ee && data.user && data.peer && e2eePeerKey
							? {
									myUserId: data.user.id,
									peerUserId: data.peer.id,
									peerPublicKey: e2eePeerKey
								}
							: null}
						onreply={(m: MessageDTO) => {
							replyTo = m;
							editing = null;
						}}
						onedit={(m: MessageDTO) => {
							editing = m;
							replyTo = null;
						}}
						ondelete={remove}
						onreact={react}
						onjump={jumpTo}
						onretry={retrySend}
						onopenImage={(urls: string[], index: number) => (lightbox = { urls, index })}
						onforward={(m: MessageDTO) => openForward([m.id])}
						onpin={pinMessage}
						ontoggleSelect={toggleSelect}
						onenterSelect={enterSelect}
						onopenSender={(m: MessageDTO) => {
							if (m.sender) void goto(`/u/${m.sender.username}`);
						}}
					/>
				{/if}
			{/each}
		</div>

		{#if showJumpUnread && firstUnreadId}
			<button
				type="button"
				class="jump-unread"
				onclick={() => jumpTo(firstUnreadId!)}
			>
				{i18n.t('chat.jumpUnread')}
			</button>
		{:else if showJump}
			<button
				type="button"
				class="jump-latest"
				aria-label={i18n.t('chat.jumpLatest')}
				onclick={() => scrollToBottom(true)}
			>
				<ChevronDown size={20} />
				{#if pendingNewCount > 0}
					<span class="jump-badge">{pendingNewCount > 99 ? '99+' : pendingNewCount}</span>
				{/if}
			</button>
		{/if}
	</div>

	{#if error}
		<p class="error" style="padding:4px 12px;background:var(--bg-elevated)">{error}</p>
	{/if}

	{#if selectMode}
		<div class="select-bar">
			<button type="button" class="icon-btn" onclick={bulkCopy} aria-label={i18n.t('chat.copy')}>
				<Copy size={20} />
			</button>
			<button
				type="button"
				class="icon-btn"
				onclick={() => openForward([...selectedIds])}
				aria-label={i18n.t('chat.forward')}
			>
				<Forward size={20} />
			</button>
			<button type="button" class="icon-btn danger" onclick={bulkDelete} aria-label={i18n.t('chat.delete')}>
				<Trash2 size={20} />
			</button>
		</div>
	{:else if canPost}
		<Composer
			chatId={data.chatId}
			{replyTo}
			{editing}
			placeholder={isChannel ? i18n.t('channel.postPlaceholder') : i18n.t('chat.message')}
			replyingLabel={i18n.t('chat.replying')}
			editingLabel={i18n.t('chat.editing')}
			recordingLabel={i18n.t('chat.recording')}
			slideToCancelLabel={i18n.t('chat.slideToCancel')}
			releaseToCancelLabel={i18n.t('chat.releaseToCancel')}
			cameraLabel={i18n.t('chat.camera')}
			attachLabel={i18n.t('chat.attach')}
			sendLabel={i18n.t('common.send')}
			voiceLabel={i18n.t('common.voice')}
			removeLabel={i18n.t('common.remove')}
			micDeniedLabel={i18n.t('chat.micDenied')}
			ontyping={isChannel ? undefined : emitTyping}
			onclearReply={() => (replyTo = null)}
			onclearEdit={() => (editing = null)}
			onsend={send}
		/>
		{#if isChannel}
			<p class="channel-format-hint">{i18n.t('channel.formatHint')}</p>
		{/if}
	{:else}
		<p class="channel-readonly">
			{isGroup ? i18n.t('group.readonly') : i18n.t('channel.readonly')}
		</p>
	{/if}
</div>

{#if showMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showMenu = false)}></div>
	<div class="msg-sheet">
		<div class="msg-menu">
			{#if isGroup}
				<button
					type="button"
					onclick={() => {
						showMenu = false;
						void goto(`/chat/${data.chatId}/group`);
					}}
				>
					<span class="sheet-row-ico"><Info size={18} /></span>
					{i18n.t('group.info')}
				</button>
				{#if group?.canInvite}
					<button
						type="button"
						onclick={() => {
							showMenu = false;
							void goto(`/chat/${data.chatId}/group?add=1`);
						}}
					>
						<span class="sheet-row-ico"><UserPlus size={18} /></span>
						{i18n.t('group.addMembers')}
					</button>
				{/if}
				<button
					type="button"
					class="danger"
					onclick={() => {
						showMenu = false;
						showLeaveModal = true;
					}}
				>
					<span class="sheet-row-ico"><LogOut size={18} /></span>
					{i18n.t('group.leave')}
				</button>
				{#if group?.myRole === 'owner'}
					<button
						type="button"
						class="danger"
						onclick={() => {
							showMenu = false;
							showDeleteGroupModal = true;
						}}
					>
						<span class="sheet-row-ico"><Trash2 size={18} /></span>
						{i18n.t('group.delete')}
					</button>
				{/if}
			{:else}
				<button
					type="button"
					onclick={() => {
						showMenu = false;
						if (data.peer) void goto(`/u/${data.peer.username}`);
					}}
				>
					<span class="sheet-row-ico"><Info size={18} /></span>
					{i18n.t('chat.viewProfile')}
				</button>
				<button
					type="button"
					class="danger"
					onclick={() => {
						showMenu = false;
						showDeleteModal = true;
					}}
				>
					<span class="sheet-row-ico"><Trash2 size={18} /></span>
					{i18n.t('chat.deleteChat')}
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if showDeleteModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showDeleteModal = false)}></div>
	<div class="msg-sheet delete-dialog-sheet">
		<div class="msg-menu pad-sheet">
			<h3 class="sheet-title">{i18n.t('chat.deleteChatTitle')}</h3>
			<p class="sheet-desc">{peerTitle}</p>
			<button
				type="button"
				class="btn btn-block"
				onclick={() => deleteChatConfirm('self')}
			>
				{i18n.t('chat.deleteForMe')}
			</button>
			<button
				type="button"
				class="btn btn-block btn-danger-outline"
				onclick={() => deleteChatConfirm('everyone')}
			>
				{i18n.t('chat.deleteForEveryone')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-block"
				onclick={() => (showDeleteModal = false)}
			>
				{i18n.t('chat.keep')}
			</button>
		</div>
	</div>
{/if}

{#if showLeaveModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showLeaveModal = false)}></div>
	<div class="msg-sheet delete-dialog-sheet">
		<div class="msg-menu pad-sheet">
			<h3 class="sheet-title">{i18n.t('group.leave')}</h3>
			<p class="sheet-desc">{groupTitle}</p>
			<button
				type="button"
				class="btn btn-block btn-danger-outline"
				onclick={leaveGroupConfirm}
			>
				{i18n.t('group.leave')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-block"
				onclick={() => (showLeaveModal = false)}
			>
				{i18n.t('chat.keep')}
			</button>
		</div>
	</div>
{/if}

{#if showDeleteGroupModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showDeleteGroupModal = false)}></div>
	<div class="msg-sheet delete-dialog-sheet">
		<div class="msg-menu pad-sheet">
			<h3 class="sheet-title">{i18n.t('group.delete')}</h3>
			<p class="sheet-desc">{groupTitle}</p>
			<button
				type="button"
				class="btn btn-block btn-danger-outline"
				onclick={deleteGroupConfirm}
			>
				{i18n.t('group.delete')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-block"
				onclick={() => (showDeleteGroupModal = false)}
			>
				{i18n.t('chat.keep')}
			</button>
		</div>
	</div>
{/if}

{#if showSearch}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showSearch = false)}></div>
	<div class="chat-overlay-sheet">
		<div class="overlay-head">
			<input
				type="search"
				placeholder={i18n.t('chat.searchIn')}
				bind:value={searchQ}
				oninput={onSearchInput}
			/>
			<button type="button" class="icon-btn" onclick={() => (showSearch = false)}
				><X size={18} /></button
			>
		</div>
		<div class="overlay-body">
			{#if searchingInChat}
				<p class="overlay-empty">{i18n.t('chats.searching')}</p>
			{:else if searchQ.trim().length >= 2 && !searchHits.length}
				<p class="overlay-empty">{i18n.t('chats.emptyFilter', { q: searchQ })}</p>
			{:else}
				{#each searchHits as hit (hit.id)}
					<button
						type="button"
						class="overlay-hit"
						onclick={() => {
							showSearch = false;
							jumpTo(hit.id);
						}}
					>
						<span>{hit.body.slice(0, 120)}</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}

{#if lightbox}
	<ImageLightbox
		urls={lightbox.urls}
		index={lightbox.index}
		onclose={() => (lightbox = null)}
	/>
{/if}
