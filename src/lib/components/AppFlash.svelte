<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import {
		dismissToast,
		getConfirm,
		getPrompt,
		getToasts,
		resolveConfirm,
		resolvePrompt
	} from '$lib/flash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';

	const i18n = useI18n();
	const toasts = $derived(getToasts());
	const confirmMsg = $derived(getConfirm());
	const prompt = $derived(getPrompt());
	let promptValue = $state('');
	let promptInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (prompt) {
			promptValue = '';
			queueMicrotask(() => promptInput?.focus());
		}
	});
</script>

{#if confirmMsg}
	<div
		class="app-confirm-backdrop"
		role="presentation"
		onclick={() => resolveConfirm(false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') resolveConfirm(false);
		}}
	>
		<div
			class="app-confirm-sheet"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="app-confirm-title"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<p id="app-confirm-title" class="app-confirm-text">{confirmMsg}</p>
			<div class="app-confirm-actions">
				<button class="btn btn-ghost" type="button" onclick={() => resolveConfirm(false)}>
					{i18n.t('dialog.cancel')}
				</button>
				<button class="btn btn-danger" type="button" onclick={() => resolveConfirm(true)}>
					{i18n.t('dialog.confirm')}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if prompt}
	<div
		class="app-confirm-backdrop"
		role="presentation"
		onclick={() => resolvePrompt(null)}
		onkeydown={(e) => {
			if (e.key === 'Escape') resolvePrompt(null);
		}}
	>
		<div
			class="app-confirm-sheet"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="app-prompt-title"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<p id="app-prompt-title" class="app-confirm-text">{prompt.message}</p>
			<input
				bind:this={promptInput}
				class="app-prompt-input"
				type="text"
				placeholder={prompt.placeholder}
				bind:value={promptValue}
			/>
			<div class="app-confirm-actions">
				<button class="btn btn-ghost" type="button" onclick={() => resolvePrompt(null)}>
					{i18n.t('dialog.cancel')}
				</button>
				<button class="btn" type="button" onclick={() => resolvePrompt(promptValue.trim())}>
					{i18n.t('dialog.ok')}
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="app-toast-stack" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="app-toast" class:err={t.kind === 'err'} class:ok={t.kind === 'ok'}>
			<span>{t.text}</span>
			<button
				type="button"
				class="app-toast-x"
				aria-label={i18n.t('dialog.dismiss')}
				onclick={() => dismissToast(t.id)}
			>
				<X size={14} />
			</button>
		</div>
	{/each}
</div>
