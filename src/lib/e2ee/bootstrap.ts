import {
	ensureIdentity,
	type ExportedPublicKey
} from './crypto';

/** Ensure local identity exists and publish public key to the server. */
export async function bootstrapE2ee(userId: string): Promise<ExportedPublicKey> {
	const { publicJwk } = await ensureIdentity(userId);
	await fetch('/api/me/e2ee', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ publicKey: publicJwk })
	});
	return publicJwk;
}

export async function fetchPeerPublicKey(userId: string): Promise<ExportedPublicKey | null> {
	const res = await fetch(`/api/users/${userId}/e2ee`);
	if (!res.ok) return null;
	const json = await res.json();
	return (json.publicKey as ExportedPublicKey) ?? null;
}
