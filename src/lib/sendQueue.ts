const DB_NAME = 'qix-send-queue';const STORE = 'pending';
const DB_VERSION = 1;

export type QueuedSend = {
	tmpId: string;
	chatId: string;
	body: string;
	kind: 'text' | 'voice' | 'video';
	replyToId: string | null;
	files: { name: string; type: string; buffer: ArrayBuffer }[];
	createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'tmpId' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function enqueueSend(item: QueuedSend): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(item);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function removeQueued(tmpId: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(tmpId);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function listQueued(chatId?: string): Promise<QueuedSend[]> {
	const db = await openDb();
	const all = await new Promise<QueuedSend[]>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).getAll();
		req.onsuccess = () => resolve((req.result as QueuedSend[]) || []);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return chatId ? all.filter((q) => q.chatId === chatId) : all;
}

export async function filesFromQueued(
	files: QueuedSend['files']
): Promise<File[]> {
	return files.map((f) => new File([f.buffer], f.name, { type: f.type }));
}

export async function serializeFiles(files: File[]): Promise<QueuedSend['files']> {
	const out: QueuedSend['files'] = [];
	for (const file of files) {
		out.push({
			name: file.name,
			type: file.type,
			buffer: await file.arrayBuffer()
		});
	}
	return out;
}
