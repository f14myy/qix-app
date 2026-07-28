/**
 * Replaces `qix-www/src/routes/+layout.server.ts`.
 *
 * The site resolves the signed-in user from the session cookie during SSR. The
 * app has no server, so it hydrates the stored token, asks the API who we are,
 * and applies the same redirect rules.
 */
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { apiJson } from '$lib/net/api';
import { installNetworkShims } from '$lib/net/bootstrap';
import { clearToken, getToken, hydrateSession } from '$lib/net/session';
import type { PublicProfile } from '$lib/types';

/** A static SPA: nothing is rendered or prerendered on a server. */
export const ssr = false;
export const prerender = false;

export type SessionUser = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
	e2eePublicKey?: string | null;
};

/** Cached so switching routes does not re-ask the server who we are. */
let cachedUser: SessionUser | null = null;
let resolved = false;

async function currentUser(): Promise<SessionUser | null> {
	if (resolved) return cachedUser;

	if (!getToken()) {
		resolved = true;
		cachedUser = null;
		return null;
	}

	try {
		const { profile } = await apiJson<{ profile: PublicProfile }>('/api/me/profile');
		cachedUser = {
			id: profile.id,
			username: profile.username,
			displayName: profile.displayName,
			avatarPath: profile.avatarPath
		};
	} catch {
		// Expired or revoked — drop it so the login screen starts clean.
		await clearToken();
		cachedUser = null;
	}

	resolved = true;
	return cachedUser;
}

/** Called after sign-in / sign-out so the next load re-reads the session. */
export function invalidateSessionUser(): void {
	resolved = false;
	cachedUser = null;
}

export const load: LayoutLoad = async ({ url }) => {
	try {
		installNetworkShims();
	} catch (e) {
		console.error('[qix] installNetworkShims failed:', e);
	}

	try {
		await hydrateSession();
	} catch (e) {
		console.error('[qix] hydrateSession failed:', e);
	}

	const path = url.pathname;
	const isAuthPage = path === '/login' || path === '/register' || path === '/recover';
	const isPublicInvite = path.startsWith('/invite/');

	let user: SessionUser | null = null;
	try {
		user = await currentUser();
	} catch (e) {
		console.error('[qix] currentUser failed:', e);
	}

	if (!user && !isAuthPage && !isPublicInvite) {
		redirect(303, '/login');
	}

	if (user && isAuthPage) {
		redirect(303, '/');
	}

	return { user };
};
