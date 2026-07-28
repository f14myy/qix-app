/** Shared last-message preview for chat lists (home, archive, etc.). */
export function lastMessagePreview(
	chat: {
		lastMessage?: {
			body: string;
			kind: string;
			hasAttachment: boolean;
			deleted: boolean;
			senderId: string;
		} | null;
	},
	opts: {
		userId?: string | null;
		t: (key: string, vars?: Record<string, string | number>) => string;
		draft?: string;
		failed?: boolean;
		decryptedBody?: string;
	}
): string {
	const { t, userId } = opts;
	if (opts.draft) return `${t('chats.draft')}: ${opts.draft}`;
	if (opts.failed) return t('chats.sendFailed');
	const last = chat.lastMessage;
	if (!last) return t('chats.noMessages');
	if (last.deleted) return '';
	if (last.body?.startsWith('e2ee:1:')) {
		const prefix = last.senderId === userId ? t('chat.youPrefix') : '';
		if (opts.decryptedBody) return `${prefix}${opts.decryptedBody}`;
		return `${prefix}${t('e2ee.preview')}`;
	}
	const prefix = last.senderId === userId ? t('chat.youPrefix') : '';
	if (last.kind === 'voice') return `${prefix}${t('chats.voice')}`;
	if (last.kind === 'video') return `${prefix}${t('chat.video')}`;
	if (last.hasAttachment && !last.body) return `${prefix}${t('chat.photo')}`;
	if (last.hasAttachment) return `${prefix}${last.body}`;
	return `${prefix}${last.body}`;
}
