<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import Mic from '@lucide/svelte/icons/mic';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import { toast } from '$lib/flash.svelte';
	import { haptic } from '$lib/haptic';
	import { compressMedia } from '$lib/videoCompress';
	import { mediaUrl } from '$lib/net/media';
	import { getCachedSettings } from '$lib/settings';
	import type { MessageDTO } from '$lib/types';

	let {
		chatId = '',
		disabled = false,
		replyTo = null as MessageDTO | null,
		editing = null as MessageDTO | null,
		placeholder = 'Message',
		replyingLabel = 'Replying',
		editingLabel = 'Editing',
		recordingLabel = 'Recording…',
		slideToCancelLabel = 'Slide to cancel',
		releaseToCancelLabel = 'Release to cancel',
		cameraLabel = 'Camera',
		attachLabel = 'Attach',
		sendLabel = 'Send',
		voiceLabel = 'Voice',
		removeLabel = 'Remove',
		micDeniedLabel = 'Microphone permission is required for voice messages',
		ontyping,
		onclearReply,
		onclearEdit,
		onsend
	}: {
		chatId?: string;
		disabled?: boolean;
		replyTo?: MessageDTO | null;
		editing?: MessageDTO | null;
		placeholder?: string;
		replyingLabel?: string;
		editingLabel?: string;
		recordingLabel?: string;
		slideToCancelLabel?: string;
		releaseToCancelLabel?: string;
		cameraLabel?: string;
		attachLabel?: string;
		sendLabel?: string;
		voiceLabel?: string;
		removeLabel?: string;
		micDeniedLabel?: string;
		ontyping?: () => void;
		onclearReply?: () => void;
		onclearEdit?: () => void;
		onsend: (payload: {
			body: string;
			files: File[];
			kind?: 'text' | 'voice' | 'video';
			replyToId?: string | null;
			editId?: string | null;
		}) => void | Promise<void>;
	} = $props();

	let body = $state('');
	let files = $state<File[]>([]);
	let previews = $state<{ file: File; url: string }[]>([]);
	let sending = $state(false);
	let recording = $state(false);
	let sendFlash = $state(false);
	let recordMs = $state(0);
	let cancelHover = $state(false);
	let locked = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let cameraInput: HTMLInputElement | undefined = $state();
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let mediaRecorder: MediaRecorder | null = null;
	let mediaStream: MediaStream | null = null;
	let audioCtx: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let waveBars = $state<number[]>(Array.from({ length: 28 }, () => 18));
	let chunks: Blob[] = [];
	let cancelRecord = false;
	let recordTimer: ReturnType<typeof setInterval> | undefined;
	let waveRaf = 0;
	let holdStartX = 0;
	let holdActive = false;
	let isCoarse = $state(false);
	let recordMime = 'audio/webm';
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	let draftLoaded = false;

	function draftKey() {
		return chatId ? `qix-draft-${chatId}` : '';
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(pointer: coarse)');
		isCoarse = mq.matches;
		const onChange = () => (isCoarse = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		if (!chatId || typeof window === 'undefined') return;
		draftLoaded = false;
		try {
			const saved = localStorage.getItem(draftKey());
			body = saved ?? '';
		} catch {
			body = '';
		}
		draftLoaded = true;
		queueMicrotask(autosize);
	});

	$effect(() => {
		if (!draftLoaded || !chatId || editing) return;
		const value = body;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			try {
				const key = draftKey();
				if (!key) return;
				if (value.trim()) localStorage.setItem(key, value);
				else localStorage.removeItem(key);
			} catch {
				/* ignore */
			}
		}, 250);
		return () => clearTimeout(draftTimer);
	});

	$effect(() => {
		if (editing) {
			body = editing.body;
			queueMicrotask(() => {
				textareaEl?.focus();
				autosize();
			});
		}
	});

	$effect(() => {
		if (replyTo && !editing) {
			queueMicrotask(() => textareaEl?.focus());
		}
	});

	$effect(() => {
		return () => {
			for (const p of previews) URL.revokeObjectURL(p.url);
		};
	});

	const canSend = $derived(
		(body.trim().length > 0 || files.length > 0) && !sending && !disabled && !recording
	);

	function autosize() {
		const el = textareaEl;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
	}

	function setFiles(next: File[]) {
		for (const p of previews) URL.revokeObjectURL(p.url);
		files = next;
		previews = next.map((file) => ({
			file,
			url:
				file.type.startsWith('image/') || file.type.startsWith('video/')
					? URL.createObjectURL(file)
					: ''
		}));
	}

	function replyPreviewText() {
		if (!replyTo) return '…';
		if (replyTo.kind === 'voice') return '🎤';
		if (replyTo.kind === 'video') return '🎬';
		if (replyTo.attachments?.some((a) => a.mime.startsWith('image/'))) return '🖼';
		return replyTo.body?.slice(0, 80) || '…';
	}

	function replyThumb(): string | null {
		if (!replyTo) return null;
		const img = replyTo.attachments?.find((a) => a.mime.startsWith('image/'));
		if (img) return mediaUrl(`/api/files/${img.id}`);
		const vid = replyTo.attachments?.find((a) => a.mime.startsWith('video/'));
		if (vid) return mediaUrl(`/api/files/${vid.id}`);
		if (replyTo.kind === 'voice' && replyTo.attachments?.[0]) return null;
		return null;
	}

	function clearDraft() {
		if (!chatId) return;
		try {
			localStorage.removeItem(draftKey());
		} catch {
			/* ignore */
		}
	}

	async function submit() {
		if (recording) return;
		if (!canSend && !editing) return;
		sending = true;
		haptic(8);
		try {
			const onlyVideo =
				files.length > 0 && files.every((f) => f.type.startsWith('video/')) && !body.trim();
			await onsend({
				body: body.trim(),
				files: [...files],
				kind: onlyVideo ? 'video' : 'text',
				replyToId: replyTo?.id ?? null,
				editId: editing?.id ?? null
			});
			body = '';
			setFiles([]);
			clearDraft();
			sendFlash = true;
			setTimeout(() => (sendFlash = false), 280);
			queueMicrotask(autosize);
		} finally {
			sending = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		if (isCoarse) return;
		if (!getCachedSettings().sendWithEnter) return;
		if (!e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	function onInput() {
		ontyping?.();
		autosize();
	}

	async function onFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const incoming = Array.from(input.files ?? []);
		input.value = '';
		const compressed = await compressMedia(incoming);
		setFiles([...files, ...compressed].slice(0, 5));
	}

	function pickRecorderMime(): { mime: string; ext: string } {
		const candidates = [
			{ mime: 'audio/mp4', ext: '.m4a' },
			{ mime: 'audio/mp4;codecs=mp4a.40.2', ext: '.m4a' },
			{ mime: 'audio/webm;codecs=opus', ext: '.webm' },
			{ mime: 'audio/webm', ext: '.webm' }
		];
		for (const c of candidates) {
			if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) {
				return c;
			}
		}
		return { mime: '', ext: '.webm' };
	}

	function stopTracks() {
		stopWaveform();
		mediaStream?.getTracks().forEach((t) => t.stop());
		mediaStream = null;
	}

	function clearRecordTimer() {
		clearInterval(recordTimer);
		recordTimer = undefined;
	}

	function stopWaveform() {
		cancelAnimationFrame(waveRaf);
		waveRaf = 0;
		analyser = null;
		if (audioCtx) {
			audioCtx.close().catch(() => {});
			audioCtx = null;
		}
		waveBars = Array.from({ length: 28 }, () => 18);
	}

	function startWaveform(stream: MediaStream) {
		try {
			audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(stream);
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 64;
			analyser.smoothingTimeConstant = 0.72;
			source.connect(analyser);
			const data = new Uint8Array(analyser.frequencyBinCount);

			const tick = () => {
				if (!analyser) return;
				analyser.getByteFrequencyData(data);
				const bars = waveBars.length;
				const next: number[] = [];
				for (let i = 0; i < bars; i++) {
					const idx = Math.floor((i / bars) * (data.length * 0.7));
					const v = data[idx] / 255;
					next.push(14 + v * 86);
				}
				waveBars = next;
				waveRaf = requestAnimationFrame(tick);
			};
			waveRaf = requestAnimationFrame(tick);
		} catch {
			/* analyser optional */
		}
	}

	function fmtRec(ms: number) {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function finishRecorder(cancel: boolean) {
		if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
		cancelRecord = cancel;
		mediaRecorder.stop();
	}

	async function startRecording() {
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			chunks = [];
			cancelRecord = false;
			cancelHover = false;
			locked = false;
			recordMs = 0;
			startWaveform(mediaStream);
			const picked = pickRecorderMime();
			recordMime = picked.mime || 'audio/webm';
			mediaRecorder = picked.mime
				? new MediaRecorder(mediaStream, { mimeType: picked.mime })
				: new MediaRecorder(mediaStream);
			mediaRecorder.ondataavailable = (ev) => {
				if (ev.data.size) chunks.push(ev.data);
			};
			mediaRecorder.onstop = async () => {
				recording = false;
				clearRecordTimer();
				stopTracks();
				const shouldCancel = cancelRecord || chunks.length === 0;
				cancelRecord = false;
				if (shouldCancel) {
					chunks = [];
					return;
				}
				const type = chunks[0]?.type || recordMime || 'audio/webm';
				const ext = type.includes('mp4') || type.includes('m4a') ? '.m4a' : '.webm';
				const blob = new Blob(chunks, { type });
				const file = new File([blob], `voice-${Date.now()}${ext}`, { type });
				sending = true;
				haptic(12);
				try {
					await onsend({
						body: '',
						files: [file],
						kind: 'voice',
						replyToId: replyTo?.id ?? null
					});
					sendFlash = true;
					setTimeout(() => (sendFlash = false), 280);
				} finally {
					sending = false;
				}
			};
			mediaRecorder.start();
			recording = true;
			haptic(15);
			recordTimer = setInterval(() => (recordMs += 100), 100);
		} catch {
			recording = false;
			stopTracks();
			clearRecordTimer();
			toast(micDeniedLabel, 'err');
		}
	}

	let holdStartY = 0;

	function onMicDown(e: PointerEvent) {
		if (sending || disabled || !!editing) return;
		if (!isCoarse) return;
		e.preventDefault();
		holdActive = true;
		holdStartX = e.clientX;
		holdStartY = e.clientY;
		cancelHover = false;
		locked = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		startRecording();
	}

	function onMicMove(e: PointerEvent) {
		if (!holdActive || !recording || locked) return;
		const dx = e.clientX - holdStartX;
		const dy = e.clientY - holdStartY;
		const nextCancel = dx < -56;
		if (nextCancel !== cancelHover) {
			cancelHover = nextCancel;
			if (nextCancel) haptic(8);
		}
		if (dy < -64 && !cancelHover) {
			locked = true;
			haptic(12);
		}
	}

	function onMicUp() {
		if (!isCoarse) return;
		if (!holdActive) return;
		holdActive = false;
		if (!recording) return;
		if (locked) return;
		finishRecorder(cancelHover);
		cancelHover = false;
	}

	function onMicClick() {
		if (isCoarse || sending || disabled || !!editing) return;
		if (recording) {
			finishRecorder(false);
			locked = false;
			return;
		}
		locked = true;
		startRecording();
	}

	function cancelLocked() {
		finishRecorder(true);
		locked = false;
		cancelHover = false;
		holdActive = false;
	}

	function sendLocked() {
		finishRecorder(false);
		locked = false;
		cancelHover = false;
		holdActive = false;
	}
</script>

<div class="composer-wrap">
	{#if replyTo}
		<div class="composer-banner">
			<span class="composer-banner-bar"></span>
			{#if replyThumb()}
				<img class="composer-banner-thumb" src={replyThumb()} alt="" />
			{/if}
			<div class="composer-banner-text">
				<strong>{replyingLabel}</strong>
				<span>{replyPreviewText()}</span>
			</div>
			<button type="button" class="icon-btn banner-dismiss" onclick={onclearReply}>
				<X size={16} />
			</button>
		</div>
	{/if}
	{#if editing}
		<div class="composer-banner edit">
			<span class="composer-banner-bar"></span>
			<div class="composer-banner-text">
				<strong>{editingLabel}</strong>
				<span>{editing.body?.slice(0, 80)}</span>
			</div>
			<button type="button" class="icon-btn banner-dismiss" onclick={onclearEdit}>
				<X size={16} />
			</button>
		</div>
	{/if}

	{#if previews.length}
		<div class="pending-files">
			{#each previews as item, i (item.file.name + i)}
				{#if item.url}
					<span class="pending-thumb">
						{#if item.file.type.startsWith('video/')}
							<video src={item.url} muted playsinline></video>
						{:else}
							<img src={item.url} alt="" />
						{/if}
						<button
							type="button"
							class="pending-remove"
							aria-label={removeLabel}
							onclick={() => setFiles(files.filter((_, idx) => idx !== i))}
						>
							<X size={12} />
						</button>
					</span>
				{:else}
					<span class="pending-chip">
						{item.file.name}
						<button
							type="button"
							class="icon-btn banner-dismiss chip-dismiss"
							onclick={() => setFiles(files.filter((_, idx) => idx !== i))}
						>
							<X size={12} />
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	{#if recording}
		<div class="recording-bar" class:cancel={cancelHover} class:locked>
			<span class="rec-dot"></span>
			<span class="rec-time">{fmtRec(recordMs)}</span>
			<div class="rec-wave" aria-hidden="true">
				{#each waveBars as h, i (i)}
					<span style="height:{h}%; --i:{i}"></span>
				{/each}
			</div>
			{#if cancelHover || locked}
				<span class="rec-hint">
					{cancelHover ? releaseToCancelLabel : recordingLabel}
				</span>
			{:else}
				<span class="rec-hint">{slideToCancelLabel}</span>
			{/if}
			{#if locked}
				<button type="button" class="rec-cancel" onclick={cancelLocked}>✕</button>
				<button type="button" class="rec-send" onclick={sendLocked} aria-label={sendLabel}>
					<Send size={16} />
				</button>
			{/if}
		</div>
	{/if}

	<div class="composer">
		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept="image/*,audio/*,video/*,.pdf,.zip,.txt"
			hidden
			onchange={onFiles}
		/>
		<input
			bind:this={cameraInput}
			type="file"
			accept="image/*"
			capture="environment"
			hidden
			onchange={onFiles}
		/>
		<button
			type="button"
			class="icon-btn composer-attach"
			aria-label={attachLabel}
			onclick={() => fileInput?.click()}
			disabled={sending || recording || !!editing}
		>
			<Paperclip size={20} />
		</button>
		{#if isCoarse}
			<button
				type="button"
				class="icon-btn composer-attach composer-camera"
				aria-label={cameraLabel}
				onclick={() => cameraInput?.click()}
				disabled={sending || recording || !!editing}
			>
				<Camera size={20} />
			</button>
		{/if}
		<textarea
			bind:this={textareaEl}
			rows="1"
			{placeholder}
			bind:value={body}
			onkeydown={onKeydown}
			oninput={onInput}
			disabled={sending || recording}
		></textarea>
		{#if body.trim() || files.length || editing}
			<button
				type="button"
				class="send"
				class:flash={sendFlash}
				aria-label={sendLabel}
				disabled={!canSend && !editing}
				onclick={submit}
			>
				<Send size={18} />
			</button>
		{:else}
			<button
				type="button"
				class="send"
				class:recording
				class:flash={sendFlash}
				class:cancel-armed={cancelHover}
				aria-label={voiceLabel}
				disabled={sending}
				onpointerdown={onMicDown}
				onpointermove={onMicMove}
				onpointerup={onMicUp}
				onpointercancel={onMicUp}
				onclick={onMicClick}
			>
				<Mic size={18} />
			</button>
		{/if}
	</div>
</div>
