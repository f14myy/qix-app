import {
	decryptFile,
	decryptText,
	encryptFile,
	encryptText,
	getCachedChatKey,
	isE2eeBody,
	type ExportedPublicKey
} from './crypto';
import { mediaUrl } from '$lib/net/media';
import type { AttachmentDTO, MessageDTO } from '$lib/types';

export async function encryptOutgoing(opts: {
	myUserId: string;
	peerUserId: string;
	peerPublicKeyJson: string;
	body: string;
	files: File[];
}): Promise<{ body: string; files: File[]; e2eeFileMetas: string[] }> {
	const jwk = JSON.parse(opts.peerPublicKeyJson) as ExportedPublicKey;
	const chatKey = await getCachedChatKey(opts.myUserId, opts.peerUserId, jwk);
	const encBody = await encryptText(chatKey, opts.body);
	const outFiles: File[] = [];
	const metas: string[] = [];
	for (const f of opts.files) {
		const { blob, meta, filename } = await encryptFile(chatKey, f);
		outFiles.push(new File([blob], filename, { type: 'application/octet-stream' }));
		metas.push(meta);
	}
	return { body: encBody, files: outFiles, e2eeFileMetas: metas };
}

export async function decryptMessageBody(
	myUserId: string,
	peerUserId: string,
	peerPublicKeyJson: string | null | undefined,
	body: string
): Promise<string> {
	if (!isE2eeBody(body)) return body;
	if (!peerPublicKeyJson) return '🔒';
	try {
		const jwk = JSON.parse(peerPublicKeyJson) as ExportedPublicKey;
		const chatKey = await getCachedChatKey(myUserId, peerUserId, jwk);
		return await decryptText(chatKey, body);
	} catch {
		return '🔒';
	}
}

const blobUrlCache = new Map<string, { url: string; mime: string }>();

export async function decryptAttachmentUrl(
	myUserId: string,
	peerUserId: string,
	peerPublicKeyJson: string | null | undefined,
	att: AttachmentDTO
): Promise<{ url: string; mime: string } | null> {
	if (!att.e2eeMeta) {
		return { url: mediaUrl(`/api/files/${att.id}`), mime: att.mime };
	}
	const cached = blobUrlCache.get(att.id);
	if (cached) return cached;
	if (!peerPublicKeyJson) return null;
	try {
		const jwk = JSON.parse(peerPublicKeyJson) as ExportedPublicKey;
		const chatKey = await getCachedChatKey(myUserId, peerUserId, jwk);
		const res = await fetch(`/api/files/${att.id}`);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		const { blob, mime } = await decryptFile(chatKey, buf, att.e2eeMeta);
		const url = URL.createObjectURL(blob);
		const entry = { url, mime };
		blobUrlCache.set(att.id, entry);
		return entry;
	} catch {
		return null;
	}
}

export async function decryptMessages(
	myUserId: string,
	peerUserId: string,
	peerPublicKeyJson: string | null | undefined,
	messages: MessageDTO[]
): Promise<MessageDTO[]> {
	const out: MessageDTO[] = [];
	for (const m of messages) {
		if (!isE2eeBody(m.body) && !m.attachments.some((a) => a.e2eeMeta) && !m.replyTo) {
			out.push(m);
			continue;
		}
		const body = await decryptMessageBody(myUserId, peerUserId, peerPublicKeyJson, m.body);
		let replyTo = m.replyTo;
		if (replyTo && isE2eeBody(replyTo.body)) {
			replyTo = {
				...replyTo,
				body: await decryptMessageBody(
					myUserId,
					peerUserId,
					peerPublicKeyJson,
					replyTo.body
				)
			};
		}
		out.push({ ...m, body, replyTo });
	}
	return out;
}

export { isE2eeBody };
