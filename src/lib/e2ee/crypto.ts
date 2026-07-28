/** Minimal DM E2EE: ECDH P-256 + AES-GCM. Prefix marks ciphertext on the server. */

export const E2EE_PREFIX = 'e2ee:1:';
const DB_NAME = 'qix-e2ee';
const STORE = 'keys';
const HKDF_SALT = new TextEncoder().encode('qix-e2ee-v1-salt');

export type ExportedPublicKey = JsonWebKey;

export type E2eeEnvelope = {
	v: 1;
	iv: string;
	ct: string;
};

export type E2eeFileMeta = {
	v: 1;
	iv: string;
	ct: string; // wraps { key, iv, mime, name }
};

function b64encode(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = '';
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
	return btoa(s);
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export function isE2eeBody(body: string | null | undefined): boolean {
	return !!body && body.startsWith(E2EE_PREFIX);
}

export function openKeyDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGet<T>(key: string): Promise<T | null> {
	const db = await openKeyDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve((req.result as T) ?? null);
		req.onerror = () => reject(req.error);
		tx.oncomplete = () => db.close();
	});
}

async function idbSet(key: string, value: unknown): Promise<void> {
	const db = await openKeyDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => reject(tx.error);
	});
}

export async function generateIdentity(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits',
		'deriveKey'
	]);
}

export async function exportPublicJwk(key: CryptoKey): Promise<ExportedPublicKey> {
	return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicJwk(jwk: ExportedPublicKey): Promise<CryptoKey> {
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

export async function exportPrivateJwk(key: CryptoKey): Promise<JsonWebKey> {
	return crypto.subtle.exportKey('jwk', key);
}

export async function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits',
		'deriveKey'
	]);
}

/** Load or create identity for this browser/user. */
export async function ensureIdentity(userId: string): Promise<{
	publicJwk: ExportedPublicKey;
	privateKey: CryptoKey;
	publicKey: CryptoKey;
}> {
	const stored = await idbGet<{ publicJwk: ExportedPublicKey; privateJwk: JsonWebKey }>(
		`id:${userId}`
	);
	if (stored?.publicJwk && stored?.privateJwk) {
		const publicKey = await importPublicJwk(stored.publicJwk);
		const privateKey = await importPrivateJwk(stored.privateJwk);
		return { publicJwk: stored.publicJwk, privateKey, publicKey };
	}
	const pair = await generateIdentity();
	const publicJwk = await exportPublicJwk(pair.publicKey);
	const privateJwk = await exportPrivateJwk(pair.privateKey);
	await idbSet(`id:${userId}`, { publicJwk, privateJwk });
	return { publicJwk, privateKey: pair.privateKey, publicKey: pair.publicKey };
}

export async function deriveChatKey(
	myPrivate: CryptoKey,
	peerPublic: CryptoKey,
	userIdA: string,
	userIdB: string
): Promise<CryptoKey> {
	const bits = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: peerPublic },
		myPrivate,
		256
	);
	const baseKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
	const sorted = [userIdA, userIdB].sort().join(':');
	const info = new TextEncoder().encode(`qix-dm:${sorted}`);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

export async function encryptText(chatKey: CryptoKey, plaintext: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		chatKey,
		new TextEncoder().encode(plaintext)
	);
	const env: E2eeEnvelope = { v: 1, iv: b64encode(iv), ct: b64encode(ct) };
	return E2EE_PREFIX + btoa(JSON.stringify(env));
}

export async function decryptText(chatKey: CryptoKey, body: string): Promise<string> {
	if (!isE2eeBody(body)) return body;
	const raw = body.slice(E2EE_PREFIX.length);
	const env = JSON.parse(atob(raw)) as E2eeEnvelope;
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: b64decode(env.iv) },
		chatKey,
		b64decode(env.ct)
	);
	return new TextDecoder().decode(pt);
}

export async function encryptFile(
	chatKey: CryptoKey,
	file: File
): Promise<{ blob: Blob; meta: string; filename: string }> {
	const fileKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
	const fileIv = crypto.getRandomValues(new Uint8Array(12));
	const data = await file.arrayBuffer();
	const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: fileIv }, fileKey, data);
	const rawKey = await crypto.subtle.exportKey('raw', fileKey);
	const wrapIv = crypto.getRandomValues(new Uint8Array(12));
	const wrapPayload = new TextEncoder().encode(
		JSON.stringify({
			key: b64encode(rawKey),
			iv: b64encode(fileIv),
			mime: file.type || 'application/octet-stream',
			name: file.name
		})
	);
	const wrapped = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: wrapIv },
		chatKey,
		wrapPayload
	);
	const meta: E2eeFileMeta = { v: 1, iv: b64encode(wrapIv), ct: b64encode(wrapped) };
	return {
		blob: new Blob([enc], { type: 'application/octet-stream' }),
		meta: btoa(JSON.stringify(meta)),
		filename: file.name.replace(/\.\w+$/, '') + '.qix'
	};
}

export async function decryptFile(
	chatKey: CryptoKey,
	encryptedBytes: ArrayBuffer,
	metaB64: string
): Promise<{ blob: Blob; mime: string; name: string }> {
	const meta = JSON.parse(atob(metaB64)) as E2eeFileMeta;
	const wrapPt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: b64decode(meta.iv) },
		chatKey,
		b64decode(meta.ct)
	);
	const wrap = JSON.parse(new TextDecoder().decode(wrapPt)) as {
		key: string;
		iv: string;
		mime: string;
		name: string;
	};
	const fileKey = await crypto.subtle.importKey(
		'raw',
		b64decode(wrap.key),
		{ name: 'AES-GCM', length: 256 },
		false,
		['decrypt']
	);
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: b64decode(wrap.iv) },
		fileKey,
		encryptedBytes
	);
	return {
		blob: new Blob([pt], { type: wrap.mime }),
		mime: wrap.mime,
		name: wrap.name
	};
}

const chatKeyCache = new Map<string, CryptoKey>();

export async function getCachedChatKey(
	myUserId: string,
	peerUserId: string,
	peerPublicJwk: ExportedPublicKey
): Promise<CryptoKey> {
	const cacheKey = [myUserId, peerUserId].sort().join(':');
	const hit = chatKeyCache.get(cacheKey);
	if (hit) return hit;
	const { privateKey } = await ensureIdentity(myUserId);
	const peerPub = await importPublicJwk(peerPublicJwk);
	const key = await deriveChatKey(privateKey, peerPub, myUserId, peerUserId);
	chatKeyCache.set(cacheKey, key);
	return key;
}

export function clearChatKeyCache() {
	chatKeyCache.clear();
}
