import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { AdminStats } from '$lib/apiTypes';

export const load: PageLoad = async () => {
	const { stats } = await apiJson<{ stats: AdminStats }>('/api/admin/stats');
	return { stats };
};
