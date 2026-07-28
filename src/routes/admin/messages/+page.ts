import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { AdminMessageItem, Paged } from '$lib/apiTypes';

export const load: PageLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const username = url.searchParams.get('username') ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;

	const query = new URLSearchParams({ q, username, page: String(page) });
	return apiJson<Paged<'messages', AdminMessageItem>>(`/api/admin/messages?${query}`);
};
