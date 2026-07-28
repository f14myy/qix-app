import type { PageLoad } from './$types';
import { apiJson } from '$lib/net/api';
import type { ProfileAutoColors } from '$lib/profileTheme';
import type { PublicProfile } from '$lib/types';

export const load: PageLoad = async () => {
	const { profile, auto } = await apiJson<{ profile: PublicProfile; auto: ProfileAutoColors }>(
		'/api/me/profile'
	);
	return { profile, auto };
};
