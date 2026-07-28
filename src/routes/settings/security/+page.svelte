<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';
	import { forgetLogin } from '$lib/net/auth';
	import { invalidateSessionUser } from '../../+layout';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();

	type SessionRow = {
		id: string;
		label: string;
		createdAt: string | null;
		lastSeenAt: string | null;
		current: boolean;
	};

	let sessions = $state<SessionRow[]>([]);
	let remainingCodes = $state(0);
	let shownCodes = $state<string[] | null>(null);
	let codesAcked = $state(false);

	let currentPw = $state('');
	let nextPw = $state('');
	let nextPw2 = $state('');
	let pwStatus = $state('');
	let pwError = $state('');
	let pwSaving = $state(false);

	let regenPw = $state('');
	let regenError = $state('');
	let regenLoading = $state(false);

	let deletePw = $state('');
	let deleteConfirm = $state('');
	let deleteError = $state('');
	let deleteLoading = $state(false);

	onMount(async () => {
		await refreshSessions();
		await refreshCodesCount();

		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			if (params.get('codes') === '1') {
				try {
					const raw = sessionStorage.getItem('qix-recovery-codes');
					if (raw) {
						shownCodes = JSON.parse(raw) as string[];
						sessionStorage.removeItem('qix-recovery-codes');
					}
				} catch {
					/* ignore */
				}
				history.replaceState({}, '', '/settings/security');
			}
		}
	});

	async function refreshSessions() {
		const res = await fetch('/api/me/sessions');
		const json = await res.json();
		if (res.ok) sessions = json.sessions ?? [];
	}

	async function refreshCodesCount() {
		const res = await fetch('/api/me/recovery-codes');
		const json = await res.json();
		if (res.ok) remainingCodes = json.remaining ?? 0;
	}

	async function changePassword(e: Event) {
		e.preventDefault();
		pwError = '';
		pwStatus = '';
		if (nextPw !== nextPw2) {
			pwError = i18n.t('security.passwordMismatch');
			return;
		}
		pwSaving = true;
		try {
			const res = await fetch('/api/auth/password', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ current: currentPw, next: nextPw })
			});
			const json = await res.json();
			if (!res.ok) {
				pwError = json.error || i18n.t('security.passwordFailed');
				return;
			}
			currentPw = '';
			nextPw = '';
			nextPw2 = '';
			pwStatus = i18n.t('security.passwordChanged');
			await refreshSessions();
		} finally {
			pwSaving = false;
		}
	}

	/**
	 * Revoking our own session or deleting the account leaves the stored token
	 * pointing at nothing, so it has to be dropped before leaving the screen.
	 */
	async function endSession() {
		await forgetLogin();
		invalidateSessionUser();
		await goto('/login', { invalidateAll: true });
	}

	async function revokeSession(id: string, current: boolean) {
		const res = await fetch('/api/me/sessions', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id })
		});
		const json = await res.json();
		if (json.loggedOut || current) {
			await endSession();
			return;
		}
		await refreshSessions();
	}

	async function revokeOthers() {
		await fetch('/api/me/sessions', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ all: true })
		});
		await refreshSessions();
	}

	async function regenerateCodes(e: Event) {
		e.preventDefault();
		regenError = '';
		regenLoading = true;
		try {
			const res = await fetch('/api/me/recovery-codes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password: regenPw })
			});
			const json = await res.json();
			if (!res.ok) {
				regenError = json.error || i18n.t('security.regenFailed');
				return;
			}
			regenPw = '';
			shownCodes = json.codes as string[];
			codesAcked = false;
			await refreshCodesCount();
		} finally {
			regenLoading = false;
		}
	}

	async function copyCodes() {
		if (!shownCodes) return;
		try {
			await navigator.clipboard.writeText(shownCodes.join('\n'));
		} catch {
			/* ignore */
		}
	}

	async function deleteAccount(e: Event) {
		e.preventDefault();
		deleteError = '';
		if (deleteConfirm.trim().toLowerCase() !== data.user?.username) {
			deleteError = i18n.t('security.deleteConfirmMismatch');
			return;
		}
		deleteLoading = true;
		try {
			const res = await fetch('/api/me/account', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password: deletePw })
			});
			const json = await res.json();
			if (!res.ok) {
				deleteError = json.error || i18n.t('security.deleteFailed');
				return;
			}
			await endSession();
		} finally {
			deleteLoading = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.security')}</h1>
	</header>

	<div class="settings-body">
		{#if shownCodes && !codesAcked}
			<section class="settings-section">
				<h2>{i18n.t('security.recoveryCodes')}</h2>
				<div class="settings-card soft pad">
					<p class="field-hint" style="margin-bottom:12px">{i18n.t('security.recoveryCodesHint')}</p>
					<ul class="recovery-code-list">
						{#each shownCodes as code}
							<li><code>{code}</code></li>
						{/each}
					</ul>
					<div class="settings-form-actions">
						<button type="button" class="btn btn-ghost" onclick={copyCodes}
							>{i18n.t('security.copyCodes')}</button
						>
						<button type="button" class="btn" onclick={() => (codesAcked = true)}
							>{i18n.t('security.codesSaved')}</button
						>
					</div>
				</div>
			</section>
		{/if}

		<section class="settings-section">
			<h2>{i18n.t('security.changePassword')}</h2>
			<form class="settings-card soft pad settings-form-stack" onsubmit={changePassword}>
				<div class="field">
					<label for="cur-pw">{i18n.t('security.currentPassword')}</label>
					<input id="cur-pw" type="password" autocomplete="current-password" bind:value={currentPw} required />
				</div>
				<div class="field">
					<label for="new-pw">{i18n.t('security.newPassword')}</label>
					<input
						id="new-pw"
						type="password"
						autocomplete="new-password"
						minlength="8"
						bind:value={nextPw}
						required
					/>
				</div>
				<div class="field">
					<label for="new-pw2">{i18n.t('security.confirmPassword')}</label>
					<input
						id="new-pw2"
						type="password"
						autocomplete="new-password"
						minlength="8"
						bind:value={nextPw2}
						required
					/>
				</div>
				{#if pwError}<p class="error">{pwError}</p>{/if}
				{#if pwStatus}<p class="profile-flash" style="padding:0">{pwStatus}</p>{/if}
				<button class="btn btn-block" type="submit" disabled={pwSaving}>
					{pwSaving ? i18n.t('security.saving') : i18n.t('security.updatePassword')}
				</button>
			</form>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('security.sessions')}</h2>
			<div class="settings-card soft">
				{#each sessions as s (s.id)}
					<div class="settings-row session-row">
						<span class="settings-nav-icon"><Smartphone size={18} /></span>
						<span class="toggle-copy">
							<span class="label"
								>{s.label}{#if s.current}
									· {i18n.t('security.thisDevice')}{/if}</span
							>
							{#if s.lastSeenAt}
								<span class="hint">{new Date(s.lastSeenAt).toLocaleString()}</span>
							{/if}
						</span>
						{#if !s.current}
							<button type="button" class="btn btn-ghost" onclick={() => revokeSession(s.id, false)}
								>{i18n.t('security.revoke')}</button
							>
						{/if}
					</div>
				{/each}
				{#if sessions.length > 1}
					<button type="button" class="settings-row link-row session-logout-others" onclick={revokeOthers}>
						<span class="label">{i18n.t('security.logoutOthers')}</span>
					</button>
				{/if}
			</div>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('security.recovery')}</h2>
			<form class="settings-card soft pad settings-form-stack" onsubmit={regenerateCodes}>
				<p class="field-hint" style="margin:0">
					{i18n.t('security.remainingCodes', { n: remainingCodes })}
				</p>
				<div class="field">
					<label for="regen-pw">{i18n.t('security.currentPassword')}</label>
					<input
						id="regen-pw"
						type="password"
						autocomplete="current-password"
						bind:value={regenPw}
						required
					/>
				</div>
				{#if regenError}<p class="error">{regenError}</p>{/if}
				<button class="btn btn-block" type="submit" disabled={regenLoading}>
					<KeyRound size={16} />
					{regenLoading ? i18n.t('security.saving') : i18n.t('security.regenCodes')}
				</button>
			</form>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('security.dangerZone')}</h2>
			<form class="settings-card soft pad danger-card settings-form-stack" onsubmit={deleteAccount}>
				<p class="field-hint" style="margin:0">{i18n.t('security.deleteHint')}</p>
				<div class="field">
					<label for="del-user">{i18n.t('security.typeUsername', { user: data.user?.username ?? '' })}</label>
					<input id="del-user" autocomplete="off" bind:value={deleteConfirm} required />
				</div>
				<div class="field">
					<label for="del-pw">{i18n.t('security.currentPassword')}</label>
					<input id="del-pw" type="password" autocomplete="current-password" bind:value={deletePw} required />
				</div>
				{#if deleteError}<p class="error">{deleteError}</p>{/if}
				<button class="btn btn-block btn-danger-outline" type="submit" disabled={deleteLoading}>
					<Trash2 size={16} />
					{deleteLoading ? i18n.t('security.deleting') : i18n.t('security.deleteAccount')}
				</button>
			</form>
		</section>
	</div>
</div>
