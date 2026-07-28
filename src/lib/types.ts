export type AttachmentDTO = {
	id: string;
	filename: string;
	mime: string;
	size: number;
	e2eeMeta: string | null;
};

export type LinkPreviewDTO = {
	url: string;
	title: string | null;
	description: string | null;
	imageUrl: string | null;
};

export type ReactionDTO = {
	emoji: string;
	count: number;
	me: boolean;
};

export type ReplyPreviewDTO = {
	id: string;
	senderId: string;
	body: string;
	deleted: boolean;
	kind: string;
	thumbUrl: string | null;
};

export type MessageDTO = {
	id: string;
	chatId: string;
	senderId: string;
	body: string;
	kind: string;
	createdAt: string;
	editedAt: string | null;
	deletedAt: string | null;
	expiresAt: string | null;
	forwardedFromId: string | null;
	replyTo: ReplyPreviewDTO | null;
	attachments: AttachmentDTO[];
	linkPreview: LinkPreviewDTO | null;
	reactions: ReactionDTO[];
	/**
	 * Present only when `kind === 'system'`. Names are resolved server-side so a
	 * client can render "Alice added Bob" without holding a directory of everyone
	 * who has ever been in the group.
	 */
	system?: import('$lib/systemMessage').SystemMessageMeta | null;
	/**
	 * Who wrote it, attached only in group chats — a DM bubble needs no name and a
	 * channel post speaks for the channel. Sent with the message rather than looked
	 * up client-side against the member list, so a bubble from someone who has since
	 * left still shows their name.
	 */
	sender?: MessageSenderDTO | null;
	/** Client-only: optimistic send state */
	sendStatus?: 'pending' | 'failed';
};

export type MessageSenderDTO = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
};

export type GroupRole = 'owner' | 'admin' | 'member';

export type GroupMemberDTO = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
	lastSeenAt: string | null;
	role: GroupRole;
	joinedAt: string | null;
	badges: import('$lib/badges').BadgeDTO[];
};

/** The group half of a chat — its identity and what the viewer may do in it. */
export type GroupInfoDTO = {
	id: string;
	title: string;
	description: string | null;
	avatarPath: string | null;
	ownerId: string;
	memberCount: number;
	/** Who may send messages: everyone, or owner + admins only. */
	posting: 'members' | 'admins';
	/** Who may add members: everyone, or owner + admins only. */
	inviting: 'members' | 'admins';
	/** The viewer's own role, and the permissions that follow from it. */
	myRole: GroupRole;
	canPost: boolean;
	canInvite: boolean;
	canManage: boolean;
	/** Only handed to members who may invite — it is a working join link. */
	inviteCode: string | null;
	createdAt: string;
};

export type ChatListItem = {
	id: string;
	kind: 'dm' | 'group' | 'channel';
	peer: {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
		lastSeenAt: string | null;
		badges: import('$lib/badges').BadgeDTO[];
		e2eePublicKey: string | null;
	} | null;
	channel: {
		key: string;
		title: string;
		posting: 'admin' | 'none' | 'members';
	} | null;
	/** Set for `kind === 'group'` — just enough to draw the row. */
	group: {
		title: string;
		avatarPath: string | null;
		memberCount: number;
	} | null;
	unreadCount: number;
	pinned: boolean;
	muted: boolean;
	archived: boolean;
	lastMessage: {
		id: string;
		body: string;
		createdAt: string;
		senderId: string;
		hasAttachment: boolean;
		kind: string;
		deleted: boolean;
		/** Groups only, and only for other people's messages: who wrote it. */
		senderName: string | null;
	} | null;
};

export type PublicProfile = {
	id: string;
	username: string;
	displayName: string | null;
	bio: string | null;
	avatarPath: string | null;
	bannerPath: string | null;
	lastSeenAt: string | null;
	createdAt: string;
	bannerKey: string;
	/** How the owner wants their profile page coloured — see $lib/profileTheme. */
	profileStyle: import('$lib/profileTheme').ProfileStyle;
	profileColor: string | null;
	profileColor2: string | null;
	/** Sampled from the banner, or the avatar when there is no banner. */
	profileAutoColor: string | null;
	badges: import('$lib/badges').BadgeDTO[];
	inviteCode: string | null;
	e2eePublicKey: string | null;
};

export type MediaItemDTO = {
	attachmentId: string;
	messageId: string;
	mime: string;
	filename: string;
	createdAt: string;
	kind: 'image' | 'video' | 'file';
};

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;
