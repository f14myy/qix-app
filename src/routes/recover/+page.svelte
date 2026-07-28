<script lang="ts">
	import { goto } from '$app/navigation';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { persistLogin } from '$lib/net/auth';
	import { invalidateSessionUser } from '../+layout';

	const i18n = useI18n();
	let username = $state('');
	let code = $state('');
	let password = $state('');
	let password2 = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let shake = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		shake = false;
		if (password !== password2) {
			error = i18n.t('security.passwordMismatch');
			shake = true;
			return;
		}
		loading = true;
		try {
			const res = await fetch('/api/auth/recover', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username, code, newPassword: password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || i18n.t('auth.recoverFailed');
				shake = true;
				return;
			}
			// Recovery revokes every old session, so the new id has to replace ours.
			await persistLogin(data);
			invalidateSessionUser();
			await goto('/', { invalidateAll: true });
		} finally {
			loading = false;
		}
	}
</script>

<div class="screen auth-screen">
	<div class="auth-top-bar">
		<div class="auth-lang-toggle" aria-label="Language">
			<button
				type="button"
				class="auth-lang-btn"
				class:active={i18n.locale === 'en'}
				onclick={() => i18n.setLocale('en')}
			>
				EN
			</button>
			<button
				type="button"
				class="auth-lang-btn"
				class:active={i18n.locale === 'ru'}
				onclick={() => i18n.setLocale('ru')}
			>
				RU
			</button>
		</div>
	</div>

	<div class="auth-card" class:auth-shake={shake}>
		<h1 class="brand-title">Qix</h1>
		<p class="subtitle">{i18n.t('auth.recoverSubtitle')}</p>

		<form class="auth-form" onsubmit={submit}>
			<div class="field">
				<label for="username">{i18n.t('auth.username')}</label>
				<input
					id="username"
					autocomplete="username"
					maxlength="9"
					bind:value={username}
					required
				/>
			</div>

			<div class="field">
				<label for="code">{i18n.t('auth.recoveryCode')}</label>
				<input
					id="code"
					autocomplete="one-time-code"
					placeholder="XXXX-XXXX-XXXX"
					bind:value={code}
					required
				/>
			</div>

			<div class="field">
				<label for="password">{i18n.t('security.newPassword')}</label>
				<div class="field-input-wrap">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="new-password"
						minlength="8"
						bind:value={password}
						required
					/>
					<button
						type="button"
						class="eye-btn"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<EyeOff size={18} />
						{:else}
							<Eye size={18} />
						{/if}
					</button>
				</div>
			</div>

			<div class="field">
				<label for="password2">{i18n.t('security.confirmPassword')}</label>
				<input
					id="password2"
					type={showPassword ? 'text' : 'password'}
					autocomplete="new-password"
					minlength="8"
					bind:value={password2}
					required
				/>
			</div>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button class="btn btn-block" type="submit" disabled={loading}>
				{loading ? i18n.t('auth.recovering') : i18n.t('auth.recover')}
			</button>
		</form>

		<div class="auth-links">
			<p class="auth-footer">
				<a href="/login">{i18n.t('auth.signInLink')}</a>
			</p>
		</div>
	</div>
</div>
