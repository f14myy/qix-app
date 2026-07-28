<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { useI18n } from '$lib/i18n/useI18n.svelte';

	let {
		urls,
		index = 0,
		onclose
	}: {
		urls: string[];
		index?: number;
		onclose: () => void;
	} = $props();

	const i18n = useI18n();

	let current = $state(0);
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let dx = $state(0);

	type Ptr = { id: number; x: number; y: number };
	const pointers = new Map<number, Ptr>();
	let mode = $state<'none' | 'pan' | 'pinch' | 'swipe'>('none');
	let startDist = 1;
	let startScale = 1;
	let startTx = 0;
	let startTy = 0;
	let startMid = { x: 0, y: 0 };
	let startX = 0;
	let startY = 0;
	let lastTap = 0;

	$effect(() => {
		current = index;
		resetTransform();
	});

	function resetTransform() {
		scale = 1;
		tx = 0;
		ty = 0;
		dx = 0;
		mode = 'none';
		pointers.clear();
	}

	function prev() {
		if (urls.length < 2) return;
		current = (current - 1 + urls.length) % urls.length;
		resetTransform();
	}

	function next() {
		if (urls.length < 2) return;
		current = (current + 1) % urls.length;
		resetTransform();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}

	function dist(a: Ptr, b: Ptr) {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function mid(a: Ptr, b: Ptr) {
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function clampPan() {
		const max = ((scale - 1) * 200) / Math.max(scale, 1);
		tx = Math.max(-max, Math.min(max, tx));
		ty = Math.max(-max, Math.min(max, ty));
	}

	function onDown(e: PointerEvent) {
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			mode = 'pinch';
			startDist = dist(a, b) || 1;
			startScale = scale;
			startTx = tx;
			startTy = ty;
			startMid = mid(a, b);
			dx = 0;
			return;
		}

		startX = e.clientX;
		startY = e.clientY;
		startTx = tx;
		startTy = ty;
		dx = 0;
		mode = scale > 1.05 ? 'pan' : 'swipe';

		const now = Date.now();
		if (now - lastTap < 280) {
			if (scale > 1.05) resetTransform();
			else {
				scale = 2.4;
				tx = 0;
				ty = 0;
			}
			lastTap = 0;
			mode = 'none';
			pointers.clear();
			return;
		}
		lastTap = now;
	}

	function onMove(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

		if (mode === 'pinch' && pointers.size >= 2) {
			const [a, b] = [...pointers.values()];
			const d = dist(a, b) || 1;
			const m = mid(a, b);
			scale = Math.min(4, Math.max(1, startScale * (d / startDist)));
			tx = startTx + (m.x - startMid.x);
			ty = startTy + (m.y - startMid.y);
			if (scale <= 1.02) {
				scale = 1;
				tx = 0;
				ty = 0;
			} else {
				clampPan();
			}
			return;
		}

		if (pointers.size !== 1) return;
		const p = [...pointers.values()][0];
		if (mode === 'pan') {
			tx = startTx + (p.x - startX);
			ty = startTy + (p.y - startY);
			clampPan();
		} else if (mode === 'swipe') {
			dx = p.x - startX;
		}
	}

	function onUp(e: PointerEvent) {
		pointers.delete(e.pointerId);

		if (mode === 'pinch' && pointers.size < 2) {
			mode = scale > 1.05 ? 'pan' : 'swipe';
			if (pointers.size === 1) {
				const p = [...pointers.values()][0];
				startX = p.x;
				startY = p.y;
				startTx = tx;
				startTy = ty;
			}
			return;
		}

		if (pointers.size === 0) {
			if (mode === 'swipe') {
				if (dx > 64) prev();
				else if (dx < -64) next();
			}
			dx = 0;
			mode = 'none';
			if (scale < 1.05) {
				scale = 1;
				tx = 0;
				ty = 0;
			}
		}
	}

	const transform = $derived(
		`translate(${tx + (mode === 'swipe' ? dx : 0)}px, ${ty}px) scale(${scale})`
	);
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="lightbox" onclick={onclose} role="dialog" aria-modal="true" tabindex="-1">
	<button type="button" class="lightbox-close icon-btn" aria-label={i18n.t('common.close')} onclick={onclose}>
		<X size={22} />
	</button>

	{#if urls.length > 1 && scale <= 1.05}
		<button
			type="button"
			class="lightbox-nav prev icon-btn"
			aria-label={i18n.t('common.prev')}
			onclick={(e) => {
				e.stopPropagation();
				prev();
			}}
		>
			<ChevronLeft size={28} />
		</button>
		<button
			type="button"
			class="lightbox-nav next icon-btn"
			aria-label={i18n.t('common.next')}
			onclick={(e) => {
				e.stopPropagation();
				next();
			}}
		>
			<ChevronRight size={28} />
		</button>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<img
		class="lightbox-img"
		class:zoomed={scale > 1.05}
		src={urls[current]}
		alt=""
		style="transform:{transform}"
		onclick={(e) => e.stopPropagation()}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
		draggable="false"
	/>

	{#if urls.length > 1}
		<span class="lightbox-count">{current + 1} / {urls.length}</span>
	{/if}
</div>
