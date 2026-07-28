<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';

	const i18n = useI18n();
	let inviteUrl = $state('');
	let qrUrl = $state('');
	let copied = $state(false);

	onMount(async () => {
		const res = await fetch('/api/invite');
		const json = await res.json();
		if (!res.ok) return;
		const origin = window.location.origin;
		inviteUrl = `${origin}${json.path}`;
		qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}`;
	});

	async function copy() {
		if (!inviteUrl) return;
		await navigator.clipboard.writeText(inviteUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('invite.myLink')}</h1>
	</header>

	<div class="settings-body invite-body">
		<p class="invite-lead">{i18n.t('invite.myLead')}</p>
		{#if qrUrl}
			<img class="invite-qr" src={qrUrl} alt="QR" width="220" height="220" />
		{:else}
			<span class="invite-qr-placeholder" aria-hidden="true"><QrCode size={40} /></span>
		{/if}
		{#if inviteUrl}
			<code class="invite-url">{inviteUrl}</code>
			<button class="btn invite-copy-btn" type="button" onclick={copy}>
				<Copy size={16} />
				{copied ? i18n.t('invite.copied') : i18n.t('invite.copy')}
			</button>
		{/if}
	</div>
</div>
