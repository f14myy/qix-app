import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { ChatListItem } from '$lib/types';

/** Replaces `+page.server.ts`, which called `listChatsForUser` directly. */
export const load: PageLoad = async () => {
	const { chats } = await apiJson<{ chats: ChatListItem[] }>('/api/chats');
	return { chats };
};
