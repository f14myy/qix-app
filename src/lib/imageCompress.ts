const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Resize and compress images for mobile upload. Non-images pass through. */
export async function compressImage(file: File): Promise<File> {
	if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
		const w = Math.round(bitmap.width * scale);
		const h = Math.round(bitmap.height * scale);

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			bitmap.close();
			return file;
		}
		ctx.drawImage(bitmap, 0, 0, w, h);
		bitmap.close();

		const blob: Blob | null = await new Promise((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
		);
		if (!blob || blob.size >= file.size) return file;

		const name = file.name.replace(/\.\w+$/, '') + '.jpg';
		return new File([blob], name, { type: 'image/jpeg' });
	} catch {
		return file;
	}
}

export async function compressImages(files: File[]): Promise<File[]> {
	const out: File[] = [];
	for (const f of files) out.push(await compressImage(f));
	return out;
}
