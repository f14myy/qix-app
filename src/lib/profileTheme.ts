/**
 * Profile page colouring.
 *
 * Every profile can carry its own colour, and the page picks it up: the banner
 * behind the avatar, the wash under the content, and the accent on the buttons
 * and links inside it. Three ways to get one:
 *
 *   auto      — sampled from the banner image, or the avatar when there is no
 *               banner. Costs the owner nothing and is the default.
 *   solid     — one colour the owner picked.
 *   gradient  — two colours the owner picked.
 *
 * The sampling itself happens in the browser at upload time (`$lib/imageColor`)
 * and is stored alongside the image, so viewers never download the picture just
 * to work out what colour it is.
 *
 * Everything here is pure and runs on both sides of the wire.
 */

export type ProfileStyle = 'auto' | 'solid' | 'gradient';

export const PROFILE_STYLES: readonly ProfileStyle[] = ['auto', 'solid', 'gradient'];

/**
 * Ready-made colours for the picker. Chosen to stay legible as a page wash in
 * both themes — nothing lighter than a mid tone, nothing fully saturated.
 */
export const PROFILE_SWATCHES: readonly string[] = [
	'#1a7a6d',
	'#2b6cb0',
	'#5a4bd4',
	'#8e44ad',
	'#c2185b',
	'#d94f3d',
	'#c07a1e',
	'#3f8f3f',
	'#2f7d8c',
	'#5d6470'
];

/** The subset of a profile this module needs. */
export type ProfileThemeSource = {
	profileStyle?: ProfileStyle | string | null;
	profileColor?: string | null;
	profileColor2?: string | null;
	profileAutoColor?: string | null;
};

/** A resolved theme: two stops and the accent derived from them. */
export type ProfileTheme = {
	style: ProfileStyle;
	/** Primary stop — also the accent used for buttons and links. */
	from: string;
	/** Secondary stop. Equal to `from` for the single-colour styles. */
	to: string;
};

/**
 * The two sampled colours, unmerged.
 *
 * Viewers only ever see the resolved one, but the owner's own editor needs both:
 * removing the banner has to fall back to the avatar's colour, and it cannot
 * work out which of the two the merged value came from.
 */
export type ProfileAutoColors = {
	banner: string | null;
	avatar: string | null;
};

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeProfileStyle(value: unknown): ProfileStyle {
	return PROFILE_STYLES.includes(value as ProfileStyle) ? (value as ProfileStyle) : 'auto';
}

/**
 * Accepts `#rgb` and `#rrggbb`, with or without the hash, and returns a
 * canonical lowercase `#rrggbb`. Anything else — including the `rgb()`,
 * `color-mix()` and `var()` forms someone could POST by hand — is rejected, so
 * the value is always safe to interpolate straight into a style attribute.
 */
export function normalizeHex(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	let hex = value.trim().toLowerCase();
	if (!hex) return null;
	if (!hex.startsWith('#')) hex = `#${hex}`;
	if (/^#[0-9a-f]{3}$/.test(hex)) {
		hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
	}
	return HEX.test(hex) ? hex : null;
}

/**
 * Resolves what a profile should actually look like, or null when it has no
 * colour of its own and should inherit the viewer's look.
 */
export function resolveProfileTheme(source: ProfileThemeSource | null | undefined): ProfileTheme | null {
	if (!source) return null;
	const style = normalizeProfileStyle(source.profileStyle);

	if (style === 'gradient') {
		const from = normalizeHex(source.profileColor);
		if (!from) return null;
		return { style, from, to: normalizeHex(source.profileColor2) ?? from };
	}

	if (style === 'solid') {
		const from = normalizeHex(source.profileColor);
		return from ? { style, from, to: from } : null;
	}

	const auto = normalizeHex(source.profileAutoColor);
	return auto ? { style: 'auto', from: auto, to: auto } : null;
}

/**
 * The inline `style` attribute for the profile page root.
 *
 * Three custom properties, all consumed by `.profile-page.is-tinted` and
 * `.profile-banner.is-tinted` in profile.css:
 *
 *   --profile-accent    the accent the page overrides its look with
 *   --profile-banner    what fills the banner when there is no banner image
 *   --profile-wash      the fade painted behind the page content
 *
 * The wash is deliberately weak. It sits behind body text in both themes, and a
 * profile whose owner picked a strong colour should still be readable by
 * someone who did not.
 */
export function profileThemeVars(theme: ProfileTheme | null): string {
	if (!theme) return '';
	const { from, to } = theme;
	const banner =
		from === to
			? `linear-gradient(150deg, ${from}, color-mix(in srgb, ${from} 55%, #000))`
			: `linear-gradient(150deg, ${from}, ${to})`;

	const wash =
		from === to
			? `linear-gradient(180deg, color-mix(in srgb, ${from} 65%, #0e0d0b) 0%, color-mix(in srgb, ${from} 45%, #0e0d0b) 45%, color-mix(in srgb, ${from} 30%, #0e0d0b) 100%)`
			: `linear-gradient(165deg, color-mix(in srgb, ${from} 70%, #0e0d0b) 0%, color-mix(in srgb, ${to} 50%, #0e0d0b) 50%, color-mix(in srgb, ${to} 30%, #0e0d0b) 100%)`;

	const cardBg =
		from === to
			? `color-mix(in srgb, ${from} 22%, #1a1815)`
			: `color-mix(in srgb, ${from} 18%, color-mix(in srgb, ${to} 18%, #1a1815))`;

	const cardBorder =
		from === to
			? `color-mix(in srgb, ${from} 45%, transparent)`
			: `color-mix(in srgb, ${from} 40%, color-mix(in srgb, ${to} 40%, transparent))`;

	const inputBg =
		from === to
			? `color-mix(in srgb, ${from} 28%, #141310)`
			: `color-mix(in srgb, ${from} 24%, color-mix(in srgb, ${to} 24%, #141310))`;

	return `--profile-accent:${from};--profile-banner:${banner};--profile-wash:${wash};--profile-card-bg:${cardBg};--profile-card-border:${cardBorder};--profile-input-bg:${inputBg};`;
}

/** Convenience for the common `resolve` + `vars` pair. */
export function profileStyleAttr(source: ProfileThemeSource | null | undefined): string {
	return profileThemeVars(resolveProfileTheme(source));
}
