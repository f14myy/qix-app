<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import { mediaUrl } from '$lib/net/media';

	let {
		title,
		chatId,
		avatarPath = null as string | null,
		size = 48
	}: {
		title: string;
		chatId: string;
		avatarPath?: string | null;
		size?: number;
	} = $props();

	const letter = $derived((title?.trim()[0] || '#').toUpperCase());
	// Same 7-tone palette as user avatars, keyed off the title so a group keeps its
	// colour as members come and go.
	const tone = $derived(((title?.charCodeAt(0) || 0) % 7) + 1);
	const src = $derived(
		avatarPath ? mediaUrl(`/api/chats/${chatId}/avatar?v=${encodeURIComponent(avatarPath)}`) : null
	);
</script>

<span class="avatar-wrap group-avatar-wrap" style="width:{size}px;height:{size}px">
	{#if src}
		<img
			class="avatar"
			src={src}
			alt={title}
			width={size}
			height={size}
			style="width:{size}px;height:{size}px;object-fit:cover"
		/>
	{:else if letter === '#'}
		<div class="avatar avatar-letter group-avatar-icon" data-tone={tone} style="width:{size}px;height:{size}px">
			<Users size={Math.round(size * 0.46)} />
		</div>
	{:else}
		<div
			class="avatar avatar-letter"
			data-tone={tone}
			style="width:{size}px;height:{size}px;font-size:{size * 0.38}px"
		>
			{letter}
		</div>
	{/if}
</span>
