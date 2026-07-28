<script lang="ts">
	import type { LinkPreviewDTO } from '$lib/types';

	let { preview }: { preview: LinkPreviewDTO } = $props();
</script>

<a class="link-card" href={preview.url} target="_blank" rel="noopener noreferrer">
	{#if preview.imageUrl}
		<img src={preview.imageUrl} alt="" class="link-card-img" />
	{/if}
	<div class="link-card-body">
		{#if preview.title}
			<strong>{preview.title}</strong>
		{/if}
		{#if preview.description}
			<p>{preview.description}</p>
		{/if}
		<span class="link-card-url">{preview.url.replace(/^https?:\/\//, '').slice(0, 48)}</span>
	</div>
</a>
