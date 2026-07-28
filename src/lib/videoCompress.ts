const MAX_EDGE = 1280;
const TARGET_BITRATE = 1_200_000;

/** Compress video via MediaRecorder redraw when possible; otherwise pass through. */
export async function compressVideo(file: File): Promise<File> {
	if (!file.type.startsWith('video/')) return file;
	if (file.size < 1.5 * 1024 * 1024) return file;
	if (typeof document === 'undefined') return file;

	try {
		const url = URL.createObjectURL(file);
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.src = url;

		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error('video load'));
		});

		const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth || 1, video.videoHeight || 1));
		const w = Math.max(2, Math.round(((video.videoWidth || 640) * scale) / 2) * 2);
		const h = Math.max(2, Math.round(((video.videoHeight || 360) * scale) / 2) * 2);

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			URL.revokeObjectURL(url);
			return file;
		}

		const stream = canvas.captureStream(24);
		const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
		const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
		if (!mime) {
			URL.revokeObjectURL(url);
			return file;
		}

		const recorder = new MediaRecorder(stream, {
			mimeType: mime,
			videoBitsPerSecond: TARGET_BITRATE
		});
		const chunks: Blob[] = [];
		recorder.ondataavailable = (e) => {
			if (e.data.size) chunks.push(e.data);
		};

		const done = new Promise<Blob>((resolve) => {
			recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
		});

		recorder.start(200);
		await video.play();

		let raf = 0;
		const draw = () => {
			if (video.ended || video.paused) return;
			ctx.drawImage(video, 0, 0, w, h);
			raf = requestAnimationFrame(draw);
		};
		draw();

		await new Promise<void>((resolve) => {
			video.onended = () => resolve();
			setTimeout(resolve, Math.min(120_000, (video.duration || 30) * 1000 + 500));
		});

		cancelAnimationFrame(raf);
		recorder.stop();
		stream.getTracks().forEach((t) => t.stop());
		URL.revokeObjectURL(url);

		const blob = await done;
		if (!blob.size || blob.size >= file.size * 0.95) return file;
		const name = file.name.replace(/\.\w+$/, '') + '.webm';
		return new File([blob], name, { type: blob.type || 'video/webm' });
	} catch {
		return file;
	}
}

export async function compressMedia(files: File[]): Promise<File[]> {
	const { compressImage } = await import('./imageCompress');
	const out: File[] = [];
	for (const f of files) {
		if (f.type.startsWith('video/')) out.push(await compressVideo(f));
		else out.push(await compressImage(f));
	}
	return out;
}
