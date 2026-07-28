<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import Hand from '@lucide/svelte/icons/hand';
	import Languages from '@lucide/svelte/icons/languages';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Palette from '@lucide/svelte/icons/palette';
	import Pointer from '@lucide/svelte/icons/pointer';
	import Search from '@lucide/svelte/icons/search';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Avatar from '$lib/components/Avatar.svelte';
	import { haptic } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import type { Locale } from '$lib/i18n';
	import { ensureNotificationPermission, subscribeWebPush } from '$lib/notify';
	import { markOnboardingDone, markOnboardingPending } from '$lib/onboarding';
	import { patchSettings } from '$lib/settings';
	import {
		LOOKS,
		getStoredLook,
		getStoredTheme,
		setLookPreference,
		setThemePreference,
		type LookId,
		type ThemePreference
	} from '$lib/theme';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();

	const STEPS = ['language', 'welcome', 'profile', 'look', 'notifications', 'tips', 'done'] as const;
	type Step = (typeof STEPS)[number];

	const seed = untrack(() => data.profile);
	let stepIndex = $state(0);
	let dir = $state<1 | -1>(1);
	let animKey = $state(0);
	let displayName = $state(seed.displayName ?? '');
	let avatarPath = $state(seed.avatarPath);
	let avatarFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let look = $state<LookId>('qix');
	let theme = $state<ThemePreference>('system');
	let permission = $state<NotificationPermission | 'unsupported'>('default');
	let saving = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let tipIndex = $state(0);

	const step = $derived(STEPS[stepIndex]);
	const progress = $derived((stepIndex + 1) / STEPS.length);
	const featuredLooks = $derived(LOOKS.slice(0, 10));

	const tips = $derived([
		{ icon: 'search', title: i18n.t('onboard.tipSearchTitle'), body: i18n.t('onboard.tipSearchBody') },
		{ icon: 'hand', title: i18n.t('onboard.tipSwipeTitle'), body: i18n.t('onboard.tipSwipeBody') },
		{ icon: 'pointer', title: i18n.t('onboard.tipMsgTitle'), body: i18n.t('onboard.tipMsgBody') },
		{ icon: 'bell', title: i18n.t('onboard.tipChannelsTitle'), body: i18n.t('onboard.tipChannelsBody') }
	]);

	onMount(() => {
		markOnboardingPending();
		look = getStoredLook();
		theme = getStoredTheme();
		if (typeof window !== 'undefined' && 'Notification' in window) {
			permission = Notification.permission;
		} else {
			permission = 'unsupported';
		}
	});

	function go(delta: number) {
		const next = stepIndex + delta;
		if (next < 0 || next >= STEPS.length) return;
		dir = delta > 0 ? 1 : -1;
		stepIndex = next;
		animKey += 1;
		haptic(8);
	}

	function onAvatar(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		if (!f || !f.type.startsWith('image/')) return;
		if (f.size > 5 * 1024 * 1024) return;
		avatarFile = f;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(f);
		haptic(6);
	}

	async function saveProfile() {
		const form = new FormData();
		form.set('displayName', displayName.trim());
		if (avatarFile) form.set('avatar', avatarFile);
		const res = await fetch('/api/me/profile', { method: 'PATCH', body: form });
		const json = await res.json();
		if (res.ok && json.profile) {
			avatarPath = json.profile.avatarPath;
			avatarFile = null;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	function pickLook(id: LookId) {
		look = id;
		setLookPreference(id);
		haptic(8);
	}

	function pickTheme(next: ThemePreference) {
		theme = next;
		setThemePreference(next);
		haptic(8);
	}

	function pickLocale(next: Locale) {
		i18n.setLocale(next);
		haptic(8);
	}

	async function enableNotifications() {
		permission = await ensureNotificationPermission();
		if (permission === 'granted') {
			await subscribeWebPush();
			await patchSettings({ notifyMessages: true, notifySound: true }).catch(() => null);
		}
		haptic(10);
	}

	async function next() {
		if (saving) return;
		saving = true;
		try {
			if (step === 'profile') await saveProfile();
			if (stepIndex === STEPS.length - 1) {
				await finish();
				return;
			}
			go(1);
		} finally {
			saving = false;
		}
	}

	async function finish() {
		markOnboardingDone();
		haptic(14);
		await goto('/');
	}

	function skip() {
		markOnboardingDone();
		void goto('/');
	}
</script>

<div class="screen onboard-screen">
	<div class="onboard-aurora" aria-hidden="true"></div>
	<div class="onboard-orb orb-a" aria-hidden="true"></div>
	<div class="onboard-orb orb-b" aria-hidden="true"></div>

	<header class="onboard-top">
		<div class="onboard-progress" aria-hidden="true">
			<span style="transform:scaleX({progress})"></span>
		</div>
		{#if step !== 'done'}
			<button type="button" class="onboard-skip" onclick={skip}>{i18n.t('onboard.skip')}</button>
		{:else}
			<span class="onboard-skip" style="visibility:hidden">{i18n.t('onboard.skip')}</span>
		{/if}
	</header>

	{#key animKey}
		<div class="onboard-stage" class:from-right={dir === 1} class:from-left={dir === -1}>
			{#if step === 'welcome'}
				<section class="onboard-panel welcome">
					<div class="onboard-logo-wrap">
						<div class="onboard-logo">Q</div>
						<span class="onboard-logo-ring"></span>
						<span class="onboard-logo-spark"><Sparkles size={18} /></span>
					</div>
					<h1 class="onboard-title">{i18n.t('onboard.welcomeTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.welcomeLead')}</p>
					<ul class="onboard-bullets">
						<li style="--i:0"><Palette size={16} /> {i18n.t('onboard.welcomeBullet1')}</li>
						<li style="--i:1"><UserRound size={16} /> {i18n.t('onboard.welcomeBullet2')}</li>
						<li style="--i:2"><Bell size={16} /> {i18n.t('onboard.welcomeBullet3')}</li>
					</ul>
				</section>
			{:else if step === 'profile'}
				<section class="onboard-panel">
					<div class="onboard-step-ico"><UserRound size={22} /></div>
					<h1 class="onboard-title">{i18n.t('onboard.profileTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.profileLead')}</p>
					<button type="button" class="onboard-avatar" onclick={() => fileInput?.click()}>
						<span class="onboard-avatar-ring">
							{#if previewUrl}
								<img class="onboard-avatar-img" src={previewUrl} alt="" />
							{:else if avatarPath}
								<Avatar
									name={displayName || data.profile.username}
									size={112}
									{avatarPath}
									userId={data.profile.id}
								/>
							{:else}
								<span class="onboard-avatar-ph"
									>{(displayName || data.profile.username).slice(0, 1).toUpperCase()}</span
								>
							{/if}
						</span>
						<span class="onboard-avatar-badge">{i18n.t('onboard.addPhoto')}</span>
					</button>
					<input bind:this={fileInput} type="file" accept="image/*" hidden onchange={onAvatar} />
					<label class="onboard-field">
						<span>{i18n.t('profile.displayName')}</span>
						<input
							maxlength={40}
							bind:value={displayName}
							placeholder={data.profile.username}
							autocomplete="nickname"
						/>
					</label>
					<p class="onboard-hint">@{data.profile.username}</p>
				</section>
			{:else if step === 'look'}
				<section class="onboard-panel">
					<div class="onboard-step-ico"><Palette size={22} /></div>
					<h1 class="onboard-title">{i18n.t('onboard.lookTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.lookLead')}</p>
					<div class="onboard-theme-row">
						{#each (['system', 'light', 'dark'] as ThemePreference[]) as t}
							<button
								type="button"
								class="onboard-chip"
								class:active={theme === t}
								onclick={() => pickTheme(t)}
							>
								{#if theme === t}<Check size={14} />{/if}
								{i18n.t(`settings.${t}`)}
							</button>
						{/each}
					</div>
					<div class="onboard-look-rail">
						{#each featuredLooks as item, i}
							<button
								type="button"
								class="onboard-look"
								class:active={look === item.id}
								style="--swatch:{item.swatch};--i:{i}"
								onclick={() => pickLook(item.id)}
							>
								<span class="onboard-look-swatch"></span>
								<span>{i18n.t(item.labelKey)}</span>
							</button>
						{/each}
					</div>
					<div class="onboard-preview chat-wallpaper" aria-hidden="true">
						<span class="ob-bubble them">{i18n.t('onboard.previewThem')}</span>
						<span class="ob-bubble me">{i18n.t('onboard.previewMe')}</span>
					</div>
				</section>
			{:else if step === 'language'}
				<section class="onboard-panel">
					<div class="onboard-step-ico"><Languages size={22} /></div>
					<h1 class="onboard-title">{i18n.t('onboard.langTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.langLead')}</p>
					<div class="onboard-lang-grid">
						<button
							type="button"
							class="onboard-lang"
							class:active={i18n.locale === 'ru'}
							onclick={() => pickLocale('ru')}
						>
							<span class="onboard-lang-flag">RU</span>
							<strong>Русский</strong>
							<span>{i18n.t('onboard.langRuHint')}</span>
						</button>
						<button
							type="button"
							class="onboard-lang"
							class:active={i18n.locale === 'en'}
							onclick={() => pickLocale('en')}
						>
							<span class="onboard-lang-flag">EN</span>
							<strong>English</strong>
							<span>{i18n.t('onboard.langEnHint')}</span>
						</button>
					</div>
				</section>
			{:else if step === 'notifications'}
				<section class="onboard-panel">
					<div class="onboard-step-ico pulse"><Bell size={22} /></div>
					<h1 class="onboard-title">{i18n.t('onboard.notifyTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.notifyLead')}</p>
					{#if permission === 'unsupported'}
						<p class="onboard-hint">{i18n.t('onboard.notifyUnsupported')}</p>
					{:else if permission === 'granted'}
						<p class="onboard-ok"><Check size={16} /> {i18n.t('settings.notifyPermissionGranted')}</p>
					{:else if permission === 'denied'}
						<p class="onboard-hint">{i18n.t('settings.notifyPermissionDenied')}</p>
					{:else}
						<button type="button" class="btn btn-block onboard-notify-btn" onclick={enableNotifications}>
							{i18n.t('onboard.notifyEnable')}
						</button>
					{/if}
					<p class="onboard-hint">{i18n.t('onboard.notifyLater')}</p>
				</section>
			{:else if step === 'tips'}
				<section class="onboard-panel">
					<div class="onboard-step-ico"><Sparkles size={22} /></div>
					<h1 class="onboard-title">{i18n.t('onboard.tipsTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.tipsLead')}</p>
					<div class="onboard-tip-card">
						{#key tipIndex}
							<div class="onboard-tip-body">
								<span class="onboard-tip-ico" aria-hidden="true">
									{#if tips[tipIndex].icon === 'search'}
										<Search size={28} />
									{:else if tips[tipIndex].icon === 'hand'}
										<Hand size={28} />
									{:else if tips[tipIndex].icon === 'pointer'}
										<Pointer size={28} />
									{:else}
										<Bell size={28} />
									{/if}
								</span>
								<strong>{tips[tipIndex].title}</strong>
								<p>{tips[tipIndex].body}</p>
							</div>
						{/key}
						<div class="onboard-tip-dots">
							{#each tips as _, i}
								<button
									type="button"
									class:active={tipIndex === i}
									aria-label={String(i + 1)}
									onclick={() => {
										tipIndex = i;
										haptic(4);
									}}
								></button>
							{/each}
						</div>
						<div class="onboard-tip-nav">
							<button
								type="button"
								class="btn btn-ghost"
								disabled={tipIndex === 0}
								onclick={() => (tipIndex = Math.max(0, tipIndex - 1))}
							>
								{i18n.t('onboard.prev')}
							</button>
							<button
								type="button"
								class="btn btn-ghost"
								disabled={tipIndex === tips.length - 1}
								onclick={() => (tipIndex = Math.min(tips.length - 1, tipIndex + 1))}
							>
								{i18n.t('onboard.nextTip')}
							</button>
						</div>
					</div>
				</section>
			{:else}
				<section class="onboard-panel welcome">
					<div class="onboard-logo-wrap done">
						<div class="onboard-logo"><Check size={36} strokeWidth={2.5} /></div>
						<span class="onboard-logo-ring"></span>
					</div>
					<h1 class="onboard-title">{i18n.t('onboard.doneTitle')}</h1>
					<p class="onboard-lead">{i18n.t('onboard.doneLead')}</p>
					<div class="onboard-done-row">
						<span><MessageCircle size={16} /> {i18n.t('onboard.doneChat')}</span>
						<span><Search size={16} /> {i18n.t('onboard.doneSearch')}</span>
					</div>
				</section>
			{/if}
		</div>
	{/key}

	<footer class="onboard-footer">
		{#if stepIndex > 0 && step !== 'done'}
			<button type="button" class="btn btn-ghost" onclick={() => go(-1)} disabled={saving}>
				{i18n.t('onboard.back')}
			</button>
		{:else}
			<span></span>
		{/if}
		<button type="button" class="btn" onclick={next} disabled={saving}>
			{#if step === 'done'}
				{i18n.t('onboard.start')}
			{:else if step === 'welcome'}
				{i18n.t('onboard.letsGo')}
			{:else}
				{i18n.t('onboard.continue')}
			{/if}
		</button>
	</footer>
</div>
