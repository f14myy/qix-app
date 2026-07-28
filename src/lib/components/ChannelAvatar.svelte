<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';

	let {
		channelKey,
		size = 48
	}: {
		channelKey: string;
		size?: number;
	} = $props();

	const sm = $derived(size <= 36);
	const iconSize = $derived(Math.round(size * 0.48));
</script>

<div
	class="channel-avatar"
	class:sm
	data-channel={channelKey}
	style="width:{size}px;height:{size}px"
	aria-hidden="true"
>
	{#if channelKey === 'notifications'}
		<Bell size={iconSize} />
	{:else}
		Q
	{/if}
</div>
