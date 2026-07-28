<script lang="ts">
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import type { BadgeDTO } from '$lib/badges';

	let {
		badges = [],
		name = '',
		showLabels = false,
		size = 'md'
	}: {
		badges?: BadgeDTO[];
		name?: string;
		showLabels?: boolean;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const primary = $derived(badges[0] ?? null);
	const iconSize = $derived(size === 'lg' ? 20 : size === 'sm' ? 14 : 17);
</script>

<span class="name-with-badges" class:sm={size === 'sm'} class:lg={size === 'lg'}>
	{#if name}
		<span class="name-with-badges-text">{name}</span>
	{/if}
	{#if showLabels && badges.length}
		{#each badges as badge}
			<span class="badge-label-chip" style="--badge-color:{badge.color}">
				<BadgeCheck size={14} strokeWidth={2.4} />
				<span class="badge-label-title">{badge.label}</span>
			</span>
		{/each}
	{:else if primary}
		<span class="badge-mark" style="color:{primary.color}" title={primary.label}>
			<BadgeCheck size={iconSize} strokeWidth={2.4} />
		</span>
	{/if}
</span>
