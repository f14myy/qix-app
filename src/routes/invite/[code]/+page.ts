import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError, apiJson } from '$lib/net/api';

type InviteUser = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
};

/**
 * The only screen reachable while signed out, so it uses the public
 * `/api/invite?code=` lookup rather than the authenticated profile endpoint.
 */
export const load: PageLoad = async ({ params }) => {
	try {
		const { user } = await apiJson<{ user: InviteUser }>(
			`/api/invite?code=${encodeURIComponent(params.code)}`
		);
		return { profile: user, code: params.code };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Invalid invite');
		throw e;
	}
};
