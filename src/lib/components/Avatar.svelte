<script lang="ts">
	import { mediaUrl } from '$lib/net/media';

	let {
		name,
		size = 48,
		avatarPath = null as string | null,
		userId = null as string | null,
		online = false
	}: {
		name: string;
		size?: number;
		avatarPath?: string | null;
		userId?: string | null;
		online?: boolean;
	} = $props();

	const letter = $derived((name?.[0] || '?').toUpperCase());
	const tone = $derived(((name?.charCodeAt(0) || 0) % 7) + 1);
	const src = $derived(
		userId && avatarPath
			? mediaUrl(`/api/avatars/${userId}?v=${encodeURIComponent(avatarPath)}`)
			: null
	);
</script>

<span class="avatar-wrap" style="width:{size}px;height:{size}px">
	{#if src}
		<img
			class="avatar"
			src={src}
			alt={name}
			width={size}
			height={size}
			style="width:{size}px;height:{size}px;object-fit:cover"
		/>
	{:else}
		<div
			class="avatar avatar-letter"
			data-tone={tone}
			style="width:{size}px;height:{size}px;font-size:{size * 0.38}px"
		>
			{letter}
		</div>
	{/if}
	{#if online}
		<span class="avatar-online" aria-hidden="true"></span>
	{/if}
</span>
