export const ADMIN_USERNAME = 'f14my';

export function isAdmin(user: { username: string } | null | undefined): boolean {
	return !!user && user.username === ADMIN_USERNAME;
}

export type AdminUserFilter = 'all' | 'online' | 'banned' | 'badge' | 'new';
export type AdminUserSort = 'created' | 'messages' | 'seen';
