import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError, apiJson } from '$lib/net/api';
import type { PublicProfile } from '$lib/types';

export type ProfileScreenData = {
	profile: PublicProfile;
	isSelf: boolean;
	blockedByMe: boolean;
	blocked: boolean;
	profileLimited: boolean;
	existingChatId: string | null;
};

export const load: PageLoad = async ({ params }) => {
	try {
		return await apiJson<ProfileScreenData>(
			`/api/users/${encodeURIComponent(params.username)}`
		);
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Not found');
		throw e;
	}
};
