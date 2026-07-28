<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { toast } from '$lib/flash.svelte';
	import { shouldForceOnboarding } from '$lib/onboarding';

	const i18n = useI18n();
	let codes = $state<string[] | null>(null);
	let copied = $state(false);

	onMount(() => {
		try {
			const raw = sessionStorage.getItem('qix-recovery-codes');
			if (!raw) return;
			const parsed = JSON.parse(raw) as string[];
			if (Array.isArray(parsed) && parsed.length) codes = parsed;
		} catch {
			/* ignore */
		}
	});

	async function copyCodes() {
		if (!codes) return;
		try {
			await navigator.clipboard.writeText(codes.join('\n'));
			copied = true;
			toast(i18n.t('invite.copied'));
			setTimeout(() => (copied = false), 1600);
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}

	function downloadCodes() {
		if (!codes) return;
		const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'qix-recovery-codes.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function ack() {
		try {
			sessionStorage.removeItem('qix-recovery-codes');
		} catch {
			/* ignore */
		}
		codes = null;
		await goto(shouldForceOnboarding() ? '/onboarding' : '/');
	}
</script>

{#if codes}
	<div class="app-confirm-backdrop recovery-gate" role="presentation">
		<div
			class="app-confirm-sheet recovery-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby="recovery-gate-title"
		>
			<h2 id="recovery-gate-title">{i18n.t('security.recoveryCodes')}</h2>
			<p class="field-hint">{i18n.t('security.recoveryCodesHint')}</p>
			<ul class="recovery-code-list">
				{#each codes as code}
					<li><code>{code}</code></li>
				{/each}
			</ul>
			<div class="recovery-actions">
				<button type="button" class="btn btn-ghost" onclick={copyCodes}>
					{copied ? i18n.t('invite.copied') : i18n.t('security.copyCodes')}
				</button>
				<button type="button" class="btn btn-ghost" onclick={downloadCodes}>
					{i18n.t('security.downloadCodes')}
				</button>
			</div>
			<button type="button" class="btn btn-block" onclick={ack}>
				{i18n.t('security.codesSaved')}
			</button>
		</div>
	</div>
{/if}
