<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import {
		BUBBLES,
		LOOKS,
		WALLPAPERS,
		getStoredBubble,
		getStoredIntensity,
		getStoredLook,
		getStoredReduceMotion,
		getStoredTheme,
		getStoredWallpaper,
		setBubblePreference,
		setIntensityPreference,
		setLookPreference,
		setReduceMotionPreference,
		setThemePreference,
		setWallpaperPreference,
		type BubbleStyle,
		type LookId,
		type ThemePreference,
		type WallpaperId,
		type WallpaperIntensity
	} from '$lib/theme';
	import { fetchSettings, patchSettings, type ClientSettings } from '$lib/settings';
	import { haptic } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';
	import type { Locale } from '$lib/i18n';

	const i18n = useI18n();
	let theme = $state<ThemePreference>('system');
	let look = $state<LookId>('qix');
	let wallpaper = $state<WallpaperId>('dots');
	let intensity = $state<WallpaperIntensity>('normal');
	let bubble = $state<BubbleStyle>('default');
	let reduceMotion = $state(false);
	let settings = $state<ClientSettings | null>(null);
	let tab = $state<'look' | 'wallpaper' | 'more'>('look');
	let flash = $state(false);

	onMount(async () => {
		theme = getStoredTheme();
		look = getStoredLook();
		wallpaper = getStoredWallpaper();
		intensity = getStoredIntensity();
		bubble = getStoredBubble();
		reduceMotion = getStoredReduceMotion();
		settings = await fetchSettings();
	});

	function bump() {
		flash = true;
		haptic(8);
		setTimeout(() => (flash = false), 280);
	}

	function setTheme(next: ThemePreference) {
		theme = next;
		setThemePreference(next);
		bump();
	}

	function setLook(next: LookId) {
		look = next;
		setLookPreference(next);
		bump();
	}

	function setWallpaper(next: WallpaperId) {
		wallpaper = next;
		setWallpaperPreference(next);
		bump();
	}

	function setIntensity(next: WallpaperIntensity) {
		intensity = next;
		setIntensityPreference(next);
		bump();
	}

	function setBubble(next: BubbleStyle) {
		bubble = next;
		setBubblePreference(next);
		bump();
	}

	function toggleReduceMotion() {
		reduceMotion = !reduceMotion;
		setReduceMotionPreference(reduceMotion);
		bump();
	}

	async function toggleHaptics() {
		if (!settings) return;
		settings = await patchSettings({ haptics: !settings.haptics });
		if (settings.haptics) haptic(10);
	}

	const lookLabel = $derived(LOOKS.find((l) => l.id === look)?.labelKey ?? 'look.qix');
	const wallLabel = $derived(
		WALLPAPERS.find((w) => w.id === wallpaper)?.labelKey ?? 'wallpaper.dots'
	);
</script>

<div class="screen appearance-screen">
	<header class="topbar">
		<button type="button" class="icon-btn" aria-label={i18n.t('back')} onclick={() => goBack('/settings')}>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('settings.appearance')}</h1>
	</header>

	<div class="settings-body appearance-body">
		<section class="settings-section appearance-preview-section">
			<div
				class="appearance-live"
				class:flash
				data-look-preview={look}
				data-wallpaper-preview={wallpaper}
				data-wp-intensity={intensity}
				data-bubble-preview={bubble}
			>
				<div class="appearance-live-bar">
					<span class="appearance-live-dot"></span>
					<span class="appearance-live-title">{i18n.t(lookLabel)}</span>
				</div>
				<div class="appearance-live-chat">
					<span class="appearance-live-bubble them">{i18n.t('appearance.previewThem')}</span>
					<span class="appearance-live-bubble me">{i18n.t('appearance.previewMe')}</span>
					<span class="appearance-live-bubble them short">{i18n.t('appearance.previewShort')}</span>
				</div>
				<div class="appearance-live-meta">
					<span>{i18n.t(wallLabel)}</span>
					<span>·</span>
					<span>{i18n.t(`intensity.${intensity}`)}</span>
					<span>·</span>
					<span>{i18n.t(`bubble.${bubble}`)}</span>
				</div>
			</div>
		</section>

		<section class="settings-section appearance-tabs-wrap">
			<div class="appearance-tabs" role="tablist">
				<button
					type="button"
					role="tab"
					class="appearance-tab"
					class:active={tab === 'look'}
					aria-selected={tab === 'look'}
					onclick={() => (tab = 'look')}>{i18n.t('settings.look')}</button
				>
				<button
					type="button"
					role="tab"
					class="appearance-tab"
					class:active={tab === 'wallpaper'}
					aria-selected={tab === 'wallpaper'}
					onclick={() => (tab = 'wallpaper')}>{i18n.t('settings.wallpaper')}</button
				>
				<button
					type="button"
					role="tab"
					class="appearance-tab"
					class:active={tab === 'more'}
					aria-selected={tab === 'more'}
					onclick={() => (tab = 'more')}>{i18n.t('appearance.more')}</button
				>
			</div>
		</section>

		{#if tab === 'look'}
			<section class="settings-section">
				<p class="settings-section-hint">{i18n.t('settings.lookHint')}</p>
				<div class="look-rail" role="list">
					{#each LOOKS as item}
						<button
							type="button"
							class="look-card look-card-rail"
							class:active={look === item.id}
							data-look-preview={item.id}
							data-wallpaper-preview={wallpaper}
							onclick={() => setLook(item.id)}
						>
							<span class="look-card-preview" aria-hidden="true">
								<span class="look-card-topbar"></span>
								<span class="look-card-chat">
									<span class="look-bubble them"></span>
									<span class="look-bubble me"></span>
								</span>
								{#if look === item.id}
									<span class="look-check"><Check size={14} /></span>
								{/if}
							</span>
							<span class="look-card-label">{i18n.t(item.labelKey)}</span>
							<span class="look-swatch" style="background:{item.swatch}"></span>
						</button>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<h2>{i18n.t('settings.mode')}</h2>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={theme === 'system'}
								onclick={() => setTheme('system')}>{i18n.t('settings.system')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={theme === 'light'}
								onclick={() => setTheme('light')}>{i18n.t('settings.light')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={theme === 'dark'}
								onclick={() => setTheme('dark')}>{i18n.t('settings.dark')}</button
							>
						</div>
					</div>
				</div>
			</section>
		{:else if tab === 'wallpaper'}
			<section class="settings-section">
				<p class="settings-section-hint">{i18n.t('settings.wallpaperHint')}</p>
				<div class="wallpaper-rail" role="list">
					{#each WALLPAPERS as item}
						<button
							type="button"
							class="wallpaper-card wallpaper-card-rail"
							class:active={wallpaper === item.id}
							data-look-preview={look}
							data-wallpaper-preview={item.id}
							data-wp-intensity={intensity}
							onclick={() => setWallpaper(item.id)}
						>
							<span class="wallpaper-sample" aria-hidden="true">
								{#if wallpaper === item.id}
									<span class="look-check"><Check size={14} /></span>
								{/if}
							</span>
							<span class="wallpaper-label">{i18n.t(item.labelKey)}</span>
						</button>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<h2>{i18n.t('appearance.intensity')}</h2>
				<p class="settings-section-hint">{i18n.t('appearance.intensityHint')}</p>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={intensity === 'soft'}
								onclick={() => setIntensity('soft')}>{i18n.t('intensity.soft')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={intensity === 'normal'}
								onclick={() => setIntensity('normal')}>{i18n.t('intensity.normal')}</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={intensity === 'bold'}
								onclick={() => setIntensity('bold')}>{i18n.t('intensity.bold')}</button
							>
						</div>
					</div>
				</div>
			</section>
		{:else}
			<section class="settings-section">
				<h2>{i18n.t('appearance.bubbles')}</h2>
				<p class="settings-section-hint">{i18n.t('appearance.bubblesHint')}</p>
				<div class="bubble-rail" role="list">
					{#each BUBBLES as item}
						<button
							type="button"
							class="bubble-style-card"
							class:active={bubble === item.id}
							data-bubble-preview={item.id}
							data-look-preview={look}
							onclick={() => setBubble(item.id)}
						>
							<span class="bubble-style-preview" aria-hidden="true">
								<span class="bubble-style-them"></span>
								<span class="bubble-style-me"></span>
							</span>
							<span class="bubble-style-label">{i18n.t(item.labelKey)}</span>
							{#if bubble === item.id}
								<span class="look-check"><Check size={14} /></span>
							{/if}
						</button>
					{/each}
				</div>
			</section>

			<section class="settings-section">
				<h2>{i18n.t('settings.language')}</h2>
				<div class="settings-card soft">
					<div class="settings-row stack">
						<div class="theme-pills">
							<button
								type="button"
								class="theme-pill"
								class:active={i18n.locale === 'en'}
								onclick={() => i18n.setLocale('en' as Locale)}>English</button
							>
							<button
								type="button"
								class="theme-pill"
								class:active={i18n.locale === 'ru'}
								onclick={() => i18n.setLocale('ru' as Locale)}>Русский</button
							>
						</div>
					</div>
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-card soft">
					{#if settings}
						<label class="settings-row toggle-row">
							<span class="toggle-copy">
								<span class="label">{i18n.t('settings.haptics')}</span>
								<span class="hint">{i18n.t('settings.hapticsHint')}</span>
							</span>
							<input
								type="checkbox"
								class="switch"
								checked={settings.haptics}
								onchange={toggleHaptics}
							/>
						</label>
					{/if}
					<label class="settings-row toggle-row">
						<span class="toggle-copy">
							<span class="label">{i18n.t('appearance.reduceMotion')}</span>
							<span class="hint">{i18n.t('appearance.reduceMotionHint')}</span>
						</span>
						<input
							type="checkbox"
							class="switch"
							checked={reduceMotion}
							onchange={toggleReduceMotion}
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>
</div>
