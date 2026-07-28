import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { BadgeWithHolders } from '$lib/apiTypes';

export const load: PageLoad = async () => {
	const { badges } = await apiJson<{ badges: BadgeWithHolders[] }>('/api/admin/badges');
	return { badges };
};
