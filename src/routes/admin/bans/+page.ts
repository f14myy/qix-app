import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { AdminUserListItem } from '$lib/apiTypes';

export const load: PageLoad = async () => {
	const { bans } = await apiJson<{ bans: AdminUserListItem[] }>('/api/admin/bans');
	return { bans };
};
