/**
 * Response shapes for endpoints whose types live in `qix-www/src/lib/server/*`.
 *
 * Those modules import SQLite and Drizzle, so they cannot be shared with the app.
 * Only the wire types are mirrored here — they must stay in step with
 * `server/admin.ts`, `server/badges.ts` and `server/features.ts`.
 */
import type { BadgeDTO, BannerKey } from './badges';

export type AdminStats = {
	usersTotal: number;
	usersOnline: number;
	usersBanned: number;
	usersNew24h: number;
	usersNew7d: number;
	chats: number;
	messagesTotal: number;
	messages24h: number;
	attachments: number;
	reactions: number;
	sessions: number;
	blocks: number;
	messagesByDay: Array<{ day: string; count: number }>;
};

export type AdminUserListItem = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
	createdAt: string;
	lastSeenAt: string | null;
	bannedAt: string | null;
	bannedReason: string | null;
	online: boolean;
	messageCount: number;
};

export type AdminUserDetail = AdminUserListItem & {
	bio: string | null;
	sessionCount: number;
	chatCount: number;
	blockedByCount: number;
	blockingCount: number;
	bannerKey: BannerKey;
	bannerPath: string | null;
	badges: BadgeDTO[];
};

export type AdminMessageItem = {
	id: string;
	chatId: string;
	body: string;
	kind: string;
	createdAt: string;
	deletedAt: string | null;
	sender: {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
	};
};

export type AdminBlockItem = {
	blockerId: string;
	blockerUsername: string;
	blockerDisplayName: string | null;
	blockedId: string;
	blockedUsername: string;
	blockedDisplayName: string | null;
	createdAt: string;
};

export type BadgeHolder = {
	id: string;
	username: string;
	displayName: string | null;
};

export type BadgeWithHolders = BadgeDTO & { holders: BadgeHolder[] };

export type ReportItem = {
	id: string;
	reason: string;
	createdAt: string;
	reporter: { id: string; username: string };
	reported: { id: string; username: string };
};

export type MessageRequestItem = {
	id: string;
	note: string | null;
	createdAt: string;
	from: {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
	} | null;
};

export type Paged<K extends string, T> = {
	[P in K]: T[];
} & {
	total: number;
	page: number;
	pages: number;
};
