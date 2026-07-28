<script lang="ts">
	import { untrack } from 'svelte';
	import Camera from '@lucide/svelte/icons/camera';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Eye from '@lucide/svelte/icons/eye';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Avatar from '$lib/components/Avatar.svelte';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { mediaUrl } from '$lib/net/media';
	import { sampleImageColor } from '$lib/imageColor';
	import { goBack } from '$lib/nav';
	import {
		normalizeProfileStyle,
		profileThemeVars,
		resolveProfileTheme,
		PROFILE_STYLES,
		PROFILE_SWATCHES,
		type ProfileStyle
	} from '$lib/profileTheme';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const i18n = useI18n();

	const NAME_MAX = 40;
	const BIO_MAX = 160;

	const MODE_LABELS: Record<ProfileStyle, string> = {
		auto: 'profile.colorAuto',
		solid: 'profile.colorSolid',
		gradient: 'profile.colorGradient'
	};

	const seed = untrack(() => data.profile);
	const autoSeed = untrack(() => data.auto);
	let displayName = $state(seed.displayName ?? '');
	let bio = $state(seed.bio ?? '');
	let avatarPath = $state(seed.avatarPath);
	let bannerPath = $state(seed.bannerPath);
	let baselineName = $state(seed.displayName ?? '');
	let baselineBio = $state(seed.bio ?? '');
	let avatarFile = $state<File | null>(null);
	let bannerFile = $state<File | null>(null);
	let removeAvatar = $state(false);
	let removeBanner = $state(false);
	let previewUrl = $state<string | null>(null);
	let bannerPreviewUrl = $state<string | null>(null);
	let status = $state('');
	let error = $state('');
	let saving = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let bannerInput = $state<HTMLInputElement | null>(null);

	/* ── Page colour ────────────────────────────────────────────────────────── */

	let profileStyle = $state<ProfileStyle>(normalizeProfileStyle(seed.profileStyle));
	let color1 = $state(seed.profileColor ?? '');
	let color2 = $state(seed.profileColor2 ?? '');
	let baselineStyle = $state<ProfileStyle>(normalizeProfileStyle(seed.profileStyle));
	let baselineColor1 = $state(seed.profileColor ?? '');
	let baselineColor2 = $state(seed.profileColor2 ?? '');
	/*
	 * Sampled here, in the uploader's browser, from the local File — a canvas can
	 * read that without tainting, which it cannot do for an image fetched from the
	 * API. The hex rides along with the upload so viewers never pay for it.
	 */
	let autoBanner = $state(autoSeed.banner);
	let autoAvatar = $state(autoSeed.avatar);
	/* Sampling is async; only the newest pick per image may write its result. */
	let bannerSampleId = 0;
	let avatarSampleId = 0;

	/** The banner's colour wins; the photo is the fallback when there is none. */
	const autoColor = $derived(autoBanner ?? autoAvatar);

	/** What the current selection actually resolves to — drives the preview. */
	const theme = $derived(
		resolveProfileTheme({
			profileStyle,
			profileColor: color1,
			profileColor2: color2,
			profileAutoColor: autoColor
		})
	);

	const dirty = $derived(
		displayName.trim() !== baselineName.trim() ||
			bio.trim() !== baselineBio.trim() ||
			!!avatarFile ||
			!!bannerFile ||
			removeAvatar ||
			removeBanner ||
			profileStyle !== baselineStyle ||
			color1 !== baselineColor1 ||
			color2 !== baselineColor2
	);

	const showPhoto = $derived(!!previewUrl || (!removeAvatar && !!avatarPath));
	const showBanner = $derived(!!bannerPreviewUrl || (!removeBanner && !!bannerPath));
	const bannerSrc = $derived(
		bannerPreviewUrl ||
			(showBanner && bannerPath ? mediaUrl(`/api/banners/${data.profile.id}?v=${bannerPath}`) : null)
	);

	async function sampleAvatarColor(file: File) {
		const id = ++avatarSampleId;
		const hex = await sampleImageColor(file);
		if (id === avatarSampleId) autoAvatar = hex;
	}

	async function sampleBannerColor(file: File) {
		const id = ++bannerSampleId;
		const hex = await sampleImageColor(file);
		if (id === bannerSampleId) autoBanner = hex;
	}

	function onAvatar(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		if (!f) return;
		if (f.size > 5 * 1024 * 1024) {
			error = i18n.t('profile.avatarTooLarge');
			return;
		}
		if (!f.type.startsWith('image/')) {
			error = i18n.t('profile.avatarType');
			return;
		}
		error = '';
		status = '';
		avatarFile = f;
		removeAvatar = false;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(f);
		void sampleAvatarColor(f);
	}

	function onBanner(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		if (!f) return;
		if (f.size > 8 * 1024 * 1024) {
			error = i18n.t('profile.bannerTooLarge');
			return;
		}
		if (!f.type.startsWith('image/')) {
			error = i18n.t('profile.bannerType');
			return;
		}
		error = '';
		status = '';
		bannerFile = f;
		removeBanner = false;
		if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
		bannerPreviewUrl = URL.createObjectURL(f);
		void sampleBannerColor(f);
	}

	function clearAvatar() {
		avatarFile = null;
		removeAvatar = !!avatarPath;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		if (fileInput) fileInput.value = '';
		// The sampled colour described an image that is on its way out.
		avatarSampleId++;
		autoAvatar = null;
	}

	function clearBanner() {
		bannerFile = null;
		removeBanner = !!bannerPath;
		if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
		bannerPreviewUrl = null;
		if (bannerInput) bannerInput.value = '';
		bannerSampleId++;
		autoBanner = null;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!dirty || saving) return;
		saving = true;
		status = '';
		error = '';
		try {
			const form = new FormData();
			form.set('displayName', displayName.trim());
			form.set('bio', bio.trim());
			if (avatarFile) form.set('avatar', avatarFile);
			if (removeAvatar) form.set('removeAvatar', '1');
			if (bannerFile) form.set('banner', bannerFile);
			if (removeBanner) form.set('removeBanner', '1');
			form.set('profileStyle', profileStyle);
			form.set('profileColor', color1);
			form.set('profileColor2', color2);
			// Always sent, so an empty value clears a stale sample server-side.
			form.set('autoBannerColor', autoBanner ?? '');
			form.set('autoAvatarColor', autoAvatar ?? '');
			const res = await fetch('/api/me/profile', { method: 'PATCH', body: form });
			const text = await res.text();
			let json: {
				error?: string;
				profile?: {
					displayName: string | null;
					bio: string | null;
					avatarPath: string | null;
					bannerPath: string | null;
					profileStyle?: ProfileStyle;
					profileColor?: string | null;
					profileColor2?: string | null;
				};
				auto?: { banner: string | null; avatar: string | null };
			} = {};
			try {
				json = text ? JSON.parse(text) : {};
			} catch {
				error = text.slice(0, 160) || i18n.t('profile.error');
				return;
			}
			if (!res.ok) {
				error = json.error || i18n.t('profile.error');
				return;
			}
			const p = json.profile;
			if (!p) {
				error = i18n.t('profile.error');
				return;
			}
			displayName = p.displayName ?? '';
			bio = p.bio ?? '';
			avatarPath = p.avatarPath;
			bannerPath = p.bannerPath;
			baselineName = displayName;
			baselineBio = bio;
			profileStyle = normalizeProfileStyle(p.profileStyle);
			color1 = p.profileColor ?? '';
			color2 = p.profileColor2 ?? '';
			baselineStyle = profileStyle;
			baselineColor1 = color1;
			baselineColor2 = color2;
			if (json.auto) {
				autoBanner = json.auto.banner;
				autoAvatar = json.auto.avatar;
			}
			avatarFile = null;
			bannerFile = null;
			removeAvatar = false;
			removeBanner = false;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = null;
			if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
			bannerPreviewUrl = null;
			if (fileInput) fileInput.value = '';
			if (bannerInput) bannerInput.value = '';
			status = i18n.t('profile.saved');
		} finally {
			saving = false;
		}
	}
</script>

<div class="screen profile-page" class:is-tinted={!!theme} style={profileThemeVars(theme)}>
	<header class="topbar">
		<button
			type="button"
			class="icon-btn"
			aria-label={i18n.t('back')}
			onclick={() => goBack('/settings')}
		>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('profile.editTitle')}</h1>
		<a class="icon-btn" href="/u/{data.profile.username}" aria-label={i18n.t('profile.viewPublic')}>
			<Eye size={20} />
		</a>
	</header>

	<form class="settings-body profile-edit" onsubmit={save}>
		<section class="profile-edit-cover" style={profileThemeVars(theme)}>
			<button
				type="button"
				class="profile-banner profile-banner-edit"
				class:is-tinted={!!theme}
				data-banner={data.profile.bannerKey}
				aria-label={i18n.t('profile.changeBanner')}
				onclick={() => bannerInput?.click()}
			>
				{#if bannerSrc}
					<img class="profile-banner-img" src={bannerSrc} alt="" />
				{/if}
				<span class="profile-banner-cam">
					<Camera size={18} />
				</span>
			</button>
			<input bind:this={bannerInput} type="file" accept="image/*" hidden onchange={onBanner} />

			<div class="profile-avatar-edit profile-avatar-edit-overlap">
				{#if previewUrl}
					<img class="avatar profile-avatar-preview" src={previewUrl} alt="" />
				{:else if showPhoto}
					<Avatar
						name={displayName || data.profile.username}
						size={112}
						{avatarPath}
						userId={data.profile.id}
					/>
				{:else}
					<Avatar name={displayName || data.profile.username} size={112} avatarPath={null} />
				{/if}
				<button
					type="button"
					class="profile-avatar-cam"
					aria-label={i18n.t('profile.changeAvatar')}
					onclick={() => fileInput?.click()}
				>
					<Camera size={18} />
				</button>
				<input bind:this={fileInput} type="file" accept="image/*" hidden onchange={onAvatar} />
			</div>

			<div class="profile-avatar-actions">
				{#if showBanner}
					<button type="button" class="btn btn-ghost profile-remove-avatar" onclick={clearBanner}>
						<Trash2 size={16} />
						{i18n.t('profile.removeBanner')}
					</button>
				{/if}
				{#if showPhoto}
					<button type="button" class="btn btn-ghost profile-remove-avatar" onclick={clearAvatar}>
						<Trash2 size={16} />
						{i18n.t('profile.removeAvatar')}
					</button>
				{/if}
			</div>
			<p class="profile-edit-hint">@{data.profile.username}</p>
		</section>

		<section class="settings-section">
			<div class="settings-card soft pad settings-form-stack">
				<div class="field">
					<div class="field-head">
						<label for="displayName">{i18n.t('profile.displayName')}</label>
						<span class="field-count">{displayName.length}/{NAME_MAX}</span>
					</div>
					<input
						id="displayName"
						maxlength={NAME_MAX}
						bind:value={displayName}
						placeholder={data.profile.username}
						autocomplete="nickname"
					/>
					<p class="field-hint">{i18n.t('profile.displayNameHint')}</p>
				</div>
				<div class="field">
					<div class="field-head">
						<label for="bio">{i18n.t('profile.bio')}</label>
						<span class="field-count">{bio.length}/{BIO_MAX}</span>
					</div>
					<textarea
						id="bio"
						class="profile-bio-input"
						maxlength={BIO_MAX}
						rows="4"
						bind:value={bio}
						placeholder={i18n.t('profile.bioPlaceholder')}
					></textarea>
				</div>
			</div>
		</section>

		<section class="settings-section">
			<h2>{i18n.t('profile.pageColor')}</h2>
			<p class="settings-section-hint">{i18n.t('profile.pageColorHint')}</p>
			<div class="settings-card soft pad settings-form-stack" style={profileThemeVars(theme)}>
				<div class="profile-color-preview" class:is-tinted={!!theme} aria-hidden="true">
					{#if !theme}
						<span class="profile-color-preview-empty">
							{profileStyle === 'auto'
								? i18n.t('profile.colorAutoEmpty')
								: i18n.t('profile.colorNone')}
						</span>
					{/if}
				</div>

				<div class="profile-color-modes" role="group" aria-label={i18n.t('profile.pageColor')}>
					{#each PROFILE_STYLES as mode}
						<button
							type="button"
							class="profile-color-mode"
							class:active={profileStyle === mode}
							aria-pressed={profileStyle === mode}
							onclick={() => (profileStyle = mode)}
						>
							{i18n.t(MODE_LABELS[mode])}
						</button>
					{/each}
				</div>

				{#key profileStyle}
					<div class="profile-color-body">
						{#if profileStyle === 'auto'}
							<p class="profile-color-auto">
								<span class="profile-color-auto-dot" aria-hidden="true"></span>
								{autoBanner
									? i18n.t('profile.colorAutoBanner')
									: autoAvatar
										? i18n.t('profile.colorAutoAvatar')
										: i18n.t('profile.colorAutoEmpty')}
							</p>
						{:else if profileStyle === 'solid'}
							{@render swatches(color1, (hex) => (color1 = hex))}
						{:else}
							<div class="profile-color-stops">
								<div class="profile-color-stop">
									<span class="profile-color-stop-label">{i18n.t('profile.colorFrom')}</span>
									{@render swatches(color1, (hex) => (color1 = hex))}
								</div>
								<div class="profile-color-stop">
									<span class="profile-color-stop-label">{i18n.t('profile.colorTo')}</span>
									{@render swatches(color2, (hex) => (color2 = hex))}
								</div>
							</div>
						{/if}
					</div>
				{/key}
			</div>
		</section>

		{#if error}
			<p class="profile-flash profile-flash-error">{error}</p>
		{:else if status}
			<p class="profile-flash">{status}</p>
		{/if}

		<section class="settings-section profile-edit-actions">
			<button class="btn btn-block" type="submit" disabled={saving || !dirty}>
				{saving ? i18n.t('profile.saving') : i18n.t('profile.save')}
			</button>
		</section>
	</form>
</div>

<!--
  One swatch row, reused by the solid mode and by each stop of the gradient. The
  selected ring is drawn with `currentColor`, so the row sets `color` to the
  swatch's own colour alongside its background.
-->
{#snippet swatches(value: string, pick: (hex: string) => void)}
	<div class="profile-swatches">
		{#each PROFILE_SWATCHES as hex}
			<button
				type="button"
				class="profile-swatch"
				class:selected={value === hex}
				style="background:{hex};color:{hex}"
				aria-label={hex}
				aria-pressed={value === hex}
				onclick={() => pick(hex)}
			></button>
		{/each}
		<span class="profile-color-input" title={i18n.t('profile.colorCustom')}>
			<input
				type="color"
				value={value || PROFILE_SWATCHES[0]}
				aria-label={i18n.t('profile.colorCustom')}
				oninput={(e) => pick(e.currentTarget.value)}
			/>
		</span>
	</div>
{/snippet}
