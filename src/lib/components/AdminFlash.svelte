<script lang="ts">
	import {
		getAdminConfirm,
		getAdminToasts,
		resolveAdminConfirm,
		dismissAdminToast
	} from '$lib/adminFlash.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import X from '@lucide/svelte/icons/x';

	const i18n = useI18n();
	const toasts = $derived(getAdminToasts());
	const confirmMsg = $derived(getAdminConfirm());
</script>

{#if confirmMsg}
	<div
		class="admin-confirm-backdrop"
		role="presentation"
		onclick={() => resolveAdminConfirm(false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') resolveAdminConfirm(false);
		}}
	>
		<div
			class="admin-confirm-sheet"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="admin-confirm-title"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<p id="admin-confirm-title" class="admin-confirm-text">{confirmMsg}</p>
			<div class="admin-confirm-actions">
				<button class="btn btn-ghost" type="button" onclick={() => resolveAdminConfirm(false)}>
					{i18n.t('admin.cancel')}
				</button>
				<button class="btn btn-danger" type="button" onclick={() => resolveAdminConfirm(true)}>
					{i18n.t('admin.confirm')}
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="admin-toast-stack" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="admin-toast" class:err={t.kind === 'err'} class:ok={t.kind === 'ok'}>
			<span>{t.text}</span>
			<button
				type="button"
				class="admin-toast-x"
				aria-label={i18n.t('admin.dismiss')}
				onclick={() => dismissAdminToast(t.id)}
			>
				<X size={14} />
			</button>
		</div>
	{/each}
</div>
