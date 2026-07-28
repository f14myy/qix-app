import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { AdminBlockItem, Paged } from '$lib/apiTypes';

export const load: PageLoad = async ({ url }) => {
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	return apiJson<Paged<'blocks', AdminBlockItem>>(`/api/admin/blocks?page=${page}`);
};
