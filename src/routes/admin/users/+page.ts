import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { AdminUserFilter, AdminUserSort } from '$lib/admin';
import type { AdminUserListItem, Paged } from '$lib/apiTypes';

type AdminUsersPage = Paged<'users', AdminUserListItem> & {
	filter: AdminUserFilter;
	sort: AdminUserSort;
};

export const load: PageLoad = async ({ url }) => {
	const query = new URLSearchParams({
		q: url.searchParams.get('q') ?? '',
		page: String(Number(url.searchParams.get('page') ?? '1') || 1),
		filter: url.searchParams.get('filter') ?? 'all',
		sort: url.searchParams.get('sort') ?? 'created'
	});
	return apiJson<AdminUsersPage>(`/api/admin/users?${query}`);
};
