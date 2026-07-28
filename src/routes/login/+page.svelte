<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { goto } from '$app/navigation';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { persistLogin } from '$lib/net/auth';
	import { invalidateSessionUser } from '../+layout';

	const i18n = useI18n();
	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let shake = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		shake = false;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				error =
					typeof data.error === 'string' && data.error
						? data.error
						: i18n.t('auth.loginFailed');
				shake = true;
				loading = false;
				return;
			}
			// The app authenticates with the returned session id, not a cookie.
			if (!(await persistLogin(data))) {
				error = i18n.t('auth.loginFailed');
				shake = true;
				loading = false;
				return;
			}
			invalidateSessionUser();
			await goto('/', { invalidateAll: true });
		} catch {
			error = i18n.t('auth.loginFailed');
			shake = true;
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
		<p class="subtitle">{i18n.t('brand.subtitle')}</p>

		<form class="auth-form" onsubmit={submit}>
			<div class="field">
				<label for="username">{i18n.t('auth.username')}</label>
				<input
					id="username"
					autocomplete="username"
					placeholder={i18n.t('auth.usernameHint')}
					maxlength="9"
					bind:value={username}
					required
				/>
			</div>

			<div class="field">
				<label for="password">{i18n.t('auth.password')}</label>
				<div class="field-input-wrap">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="current-password"
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

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button class="btn btn-block" type="submit" disabled={loading}>
				{loading ? i18n.t('auth.signingIn') : i18n.t('auth.signIn')}
			</button>
		</form>

		<div class="auth-links">
			<p class="auth-footer">
				<a href="/recover">{i18n.t('auth.forgotPassword')}</a>
			</p>
			<p class="auth-footer">
				{i18n.t('auth.noAccount')} <a href="/register">{i18n.t('auth.createOne')}</a>
			</p>
		</div>
	</div>
</div>
