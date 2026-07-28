import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { isAdmin } from '$lib/admin';

/**
 * Replaces `admin/+layout.server.ts`. This is a convenience gate only — every
 * `/api/admin/*` endpoint calls `requireAdmin` server-side, so hiding the screens
 * is not what enforces the rule.
 */
export const load: LayoutLoad = async ({ parent }) => {
	const { user } = await parent();
	if (!isAdmin(user)) error(403, 'Forbidden');
	return {};
};
