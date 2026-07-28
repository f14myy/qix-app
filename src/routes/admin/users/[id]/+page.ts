import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError, apiJson } from '$lib/net/api';
import type { AdminUserDetail } from '$lib/apiTypes';

export const load: PageLoad = async ({ params }) => {
	try {
		// The page calls this `profile`; the endpoint returns it as `user`.
		const { user } = await apiJson<{ user: AdminUserDetail }>(`/api/admin/users/${params.id}`);
		return { profile: user };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Not found');
		throw e;
	}
};
