<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'accent',
		class: className = '',
		ondismiss,
		icon,
		children,
		actionLabel
	}: {
		tone?: 'accent' | 'soft';
		class?: string;
		ondismiss: () => void;
		icon?: Snippet;
		children: Snippet;
		actionLabel: string;
	} = $props();

	let leaving = $state(false);

	/** Matches the .coach-tip.leaving animation (--motion) in app.css. */
	const LEAVE_MS = 180;

	function dismiss() {
		if (leaving) return;
		leaving = true;
		setTimeout(() => ondismiss(), LEAVE_MS);
	}
</script>

<div
	class="coach-tip {className}"
	class:soft={tone === 'soft'}
	class:leaving
	role="status"
>
	{#if icon}
		<span class="coach-tip-ico" aria-hidden="true">{@render icon()}</span>
	{/if}
	<div class="coach-tip-copy">
		{@render children()}
	</div>
	<button type="button" class="coach-tip-action" onclick={dismiss}>
		{actionLabel}
	</button>
</div>
