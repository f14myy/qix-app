import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { MessageRequestItem } from '$lib/apiTypes';

export const load: PageLoad = async () => {
	const { requests } = await apiJson<{ requests: MessageRequestItem[] }>('/api/requests');
	return { requests };
};
