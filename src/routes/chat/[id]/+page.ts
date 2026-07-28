import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError, apiJson } from '$lib/net/api';
import type { GroupInfoDTO, GroupMemberDTO, MessageDTO, PublicProfile } from '$lib/types';

export type ChatScreenData = {
	chatId: string;
	kind: 'dm' | 'group' | 'channel';
	peer: PublicProfile | null;
	channel: {
		key: string;
		title: string;
		posting: 'admin' | 'none' | 'members';
		canPost: boolean;
	} | null;
	group: GroupInfoDTO | null;
	members: GroupMemberDTO[];
	peerLastReadAt: string | null;
	myLastReadAt: string | null;
	messages: MessageDTO[];
	pinnedMessageId: string | null;
	disappearAfterSec: number;
	pinnedMessage: MessageDTO | null;
	isAdmin: boolean;
};

/**
 * Replaces `+page.server.ts`. `GET /api/chats/[id]` was added to the server to
 * return exactly what that load returned, so this stays a single request.
 */
export const load: PageLoad = async ({ params }) => {
	try {
		return await apiJson<ChatScreenData>(`/api/chats/${params.id}`);
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Chat not found');
		throw e;
	}
};
