import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { PublicProfile } from '$lib/types';

export const load: PageLoad = async () => {
	const { profile } = await apiJson<{ profile: PublicProfile }>('/api/me/profile');
	return { profile };
};
