import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { ChatListItem } from '$lib/types';

export const load: PageLoad = async () => {
	const { chats } = await apiJson<{ chats: ChatListItem[] }>('/api/chats?archived=1');
	return { chats };
};
