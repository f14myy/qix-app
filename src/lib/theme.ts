import { patchSettings } from '$lib/settings';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Full visual look — colors, bubbles, chat base tone. */
export type LookId =
	| 'qix'
	| 'lagoon'
	| 'meadow'
	| 'ember'
	| 'graphite'
	| 'ink'
	| 'dusk'
	| 'coral'
	| 'frost'
	| 'sand'
	| 'noir'
	| 'rose'
	| 'citrus'
	| 'arctic'
	| 'plum'
	| 'volt'
	| 'clay'
	| 'midnight'
	| 'matcha'
	| 'berry';

/** Chat wallpaper pattern layered on top of look’s --bg-chat. */
export type WallpaperId =
	| 'dots'
	| 'crosses'
	| 'diagonals'
	| 'diamonds'
	| 'ripples'
	| 'grid'
	| 'bloom'
	| 'chevrons'
	| 'stars'
	| 'weave'
	| 'mist'
	| 'hex'
	| 'waves'
	| 'confetti'
	| 'scanlines'
	| 'tiles'
	| 'orbit'
	| 'topo'
	| 'noise'
	| 'petals'
	| 'stripes'
	| 'none';

export type WallpaperIntensity = 'soft' | 'normal' | 'bold';

/** Bubble corner style personalization. */
export type BubbleStyle = 'default' | 'soft' | 'pill' | 'sharp';

const MODE_KEY = 'qix-theme';
const LOOK_KEY = 'qix-look';
const WALLPAPER_KEY = 'qix-wallpaper';
const INTENSITY_KEY = 'qix-wallpaper-intensity';
const BUBBLE_KEY = 'qix-bubble';
const REDUCE_MOTION_KEY = 'qix-reduce-motion';
const LEGACY_ACCENT_KEY = 'qix-accent';

const LOOK_IDS: LookId[] = [
	'qix',
	'lagoon',
	'meadow',
	'ember',
	'graphite',
	'ink',
	'dusk',
	'coral',
	'frost',
	'sand',
	'noir',
	'rose',
	'citrus',
	'arctic',
	'plum',
	'volt',
	'clay',
	'midnight',
	'matcha',
	'berry'
];

const WALLPAPER_IDS: WallpaperId[] = [
	'dots',
	'crosses',
	'diagonals',
	'diamonds',
	'ripples',
	'grid',
	'bloom',
	'chevrons',
	'stars',
	'weave',
	'mist',
	'hex',
	'waves',
	'confetti',
	'scanlines',
	'tiles',
	'orbit',
	'topo',
	'noise',
	'petals',
	'stripes',
	'none'
];

const INTENSITY_IDS: WallpaperIntensity[] = ['soft', 'normal', 'bold'];
const BUBBLE_IDS: BubbleStyle[] = ['default', 'soft', 'pill', 'sharp'];

/** Map old accent ids → new looks. */
const LEGACY_ACCENT_MAP: Record<string, LookId> = {
	teal: 'qix',
	ocean: 'lagoon',
	forest: 'meadow',
	slate: 'graphite',
	amber: 'ember'
};

export const LOOKS: { id: LookId; labelKey: string; swatch: string }[] = [
	{ id: 'qix', labelKey: 'look.qix', swatch: '#1a7a6d' },
	{ id: 'lagoon', labelKey: 'look.lagoon', swatch: '#1a6f9a' },
	{ id: 'meadow', labelKey: 'look.meadow', swatch: '#3d6b3a' },
	{ id: 'ember', labelKey: 'look.ember', swatch: '#b86a1a' },
	{ id: 'coral', labelKey: 'look.coral', swatch: '#c45c4a' },
	{ id: 'frost', labelKey: 'look.frost', swatch: '#5a8aa8' },
	{ id: 'sand', labelKey: 'look.sand', swatch: '#9a7b56' },
	{ id: 'graphite', labelKey: 'look.graphite', swatch: '#4a5d6e' },
	{ id: 'ink', labelKey: 'look.ink', swatch: '#1c1c22' },
	{ id: 'dusk', labelKey: 'look.dusk', swatch: '#5b4a7a' },
	{ id: 'noir', labelKey: 'look.noir', swatch: '#111111' },
	{ id: 'rose', labelKey: 'look.rose', swatch: '#b85a72' },
	{ id: 'citrus', labelKey: 'look.citrus', swatch: '#8a9a2a' },
	{ id: 'arctic', labelKey: 'look.arctic', swatch: '#4a8a9a' },
	{ id: 'plum', labelKey: 'look.plum', swatch: '#7a3a5a' },
	{ id: 'volt', labelKey: 'look.volt', swatch: '#2a9a6a' },
	{ id: 'clay', labelKey: 'look.clay', swatch: '#a86a4a' },
	{ id: 'midnight', labelKey: 'look.midnight', swatch: '#2a3a6a' },
	{ id: 'matcha', labelKey: 'look.matcha', swatch: '#5a8a4a' },
	{ id: 'berry', labelKey: 'look.berry', swatch: '#a83a5a' }
];

export const WALLPAPERS: { id: WallpaperId; labelKey: string }[] = [
	{ id: 'dots', labelKey: 'wallpaper.dots' },
	{ id: 'crosses', labelKey: 'wallpaper.crosses' },
	{ id: 'diagonals', labelKey: 'wallpaper.diagonals' },
	{ id: 'diamonds', labelKey: 'wallpaper.diamonds' },
	{ id: 'ripples', labelKey: 'wallpaper.ripples' },
	{ id: 'grid', labelKey: 'wallpaper.grid' },
	{ id: 'bloom', labelKey: 'wallpaper.bloom' },
	{ id: 'chevrons', labelKey: 'wallpaper.chevrons' },
	{ id: 'stars', labelKey: 'wallpaper.stars' },
	{ id: 'weave', labelKey: 'wallpaper.weave' },
	{ id: 'mist', labelKey: 'wallpaper.mist' },
	{ id: 'hex', labelKey: 'wallpaper.hex' },
	{ id: 'waves', labelKey: 'wallpaper.waves' },
	{ id: 'confetti', labelKey: 'wallpaper.confetti' },
	{ id: 'scanlines', labelKey: 'wallpaper.scanlines' },
	{ id: 'tiles', labelKey: 'wallpaper.tiles' },
	{ id: 'orbit', labelKey: 'wallpaper.orbit' },
	{ id: 'topo', labelKey: 'wallpaper.topo' },
	{ id: 'noise', labelKey: 'wallpaper.noise' },
	{ id: 'petals', labelKey: 'wallpaper.petals' },
	{ id: 'stripes', labelKey: 'wallpaper.stripes' },
	{ id: 'none', labelKey: 'wallpaper.none' }
];

export const BUBBLES: { id: BubbleStyle; labelKey: string }[] = [
	{ id: 'default', labelKey: 'bubble.default' },
	{ id: 'soft', labelKey: 'bubble.soft' },
	{ id: 'pill', labelKey: 'bubble.pill' },
	{ id: 'sharp', labelKey: 'bubble.sharp' }
];

/** Matches `--bg-elevated` per look so iOS PWA safe-area matches the app shell. */
const STATUS_BAR: Record<LookId, { light: string; dark: string }> = {
	qix: { light: '#ffffff', dark: '#121a22' },
	lagoon: { light: '#f7fafc', dark: '#101820' },
	meadow: { light: '#f7faf5', dark: '#121a12' },
	ember: { light: '#fffaf5', dark: '#1a1410' },
	coral: { light: '#fffaf8', dark: '#1c1212' },
	frost: { light: '#f5f9fc', dark: '#101820' },
	sand: { light: '#faf7f2', dark: '#1a1610' },
	graphite: { light: '#f6f8fa', dark: '#141a20' },
	ink: { light: '#f4f4f8', dark: '#121216' },
	dusk: { light: '#faf8fc', dark: '#18141f' },
	noir: { light: '#161616', dark: '#101010' },
	rose: { light: '#fbf4f6', dark: '#1c1016' },
	citrus: { light: '#f7f9ec', dark: '#181c0e' },
	arctic: { light: '#f4fafc', dark: '#101a20' },
	plum: { light: '#faf4f8', dark: '#1a1018' },
	volt: { light: '#f2faf6', dark: '#0c1c14' },
	clay: { light: '#faf4ee', dark: '#1c1610' },
	midnight: { light: '#f4f6fc', dark: '#101428' },
	matcha: { light: '#f4faf0', dark: '#121c10' },
	berry: { light: '#fbf0f4', dark: '#1c1014' }
};

function emitThemeEvent() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('qix-theme'));
}

function isLook(v: string | null): v is LookId {
	return !!v && (LOOK_IDS as string[]).includes(v);
}

function isWallpaper(v: string | null): v is WallpaperId {
	return !!v && (WALLPAPER_IDS as string[]).includes(v);
}

function isIntensity(v: string | null): v is WallpaperIntensity {
	return !!v && (INTENSITY_IDS as string[]).includes(v);
}

function isBubble(v: string | null): v is BubbleStyle {
	return !!v && (BUBBLE_IDS as string[]).includes(v);
}

export function getStoredTheme(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'light';
	const v = localStorage.getItem(MODE_KEY);
	if (v === 'light' || v === 'dark' || v === 'system') return v;
	return 'light';
}

export function getStoredLook(): LookId {
	if (typeof localStorage === 'undefined') return 'citrus';
	const look = localStorage.getItem(LOOK_KEY);
	if (isLook(look)) return look;
	const legacy = localStorage.getItem(LEGACY_ACCENT_KEY);
	if (legacy && LEGACY_ACCENT_MAP[legacy]) return LEGACY_ACCENT_MAP[legacy];
	return 'citrus';
}

export function getStoredWallpaper(): WallpaperId {
	if (typeof localStorage === 'undefined') return 'dots';
	const v = localStorage.getItem(WALLPAPER_KEY);
	if (isWallpaper(v)) return v;
	return 'dots';
}

export function getStoredIntensity(): WallpaperIntensity {
	if (typeof localStorage === 'undefined') return 'normal';
	const v = localStorage.getItem(INTENSITY_KEY);
	if (isIntensity(v)) return v;
	return 'normal';
}

export function getStoredBubble(): BubbleStyle {
	if (typeof localStorage === 'undefined') return 'default';
	const v = localStorage.getItem(BUBBLE_KEY);
	if (isBubble(v)) return v;
	return 'default';
}

export function getStoredReduceMotion(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(REDUCE_MOTION_KEY) === '1';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
	if (pref === 'light' || pref === 'dark') return pref;
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function statusBarColor(
	look: LookId = typeof document !== 'undefined' ? getStoredLook() : 'citrus',
	mode: 'light' | 'dark' = typeof document !== 'undefined'
		? resolveTheme(getStoredTheme())
		: 'light'
): string {
	return mode === 'dark' ? STATUS_BAR[look].dark : STATUS_BAR[look].light;
}

export function applyLook(look: LookId, resolved?: 'light' | 'dark') {
	document.documentElement.dataset.look = look;
	document.documentElement.removeAttribute('data-accent');
	const mode = resolved ?? resolveTheme(getStoredTheme());
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', statusBarColor(look, mode));
	}
	emitThemeEvent();
}

export function applyWallpaper(wallpaper: WallpaperId) {
	document.documentElement.dataset.wallpaper = wallpaper;
}

export function applyIntensity(intensity: WallpaperIntensity) {
	document.documentElement.dataset.wpIntensity = intensity;
}

export function applyBubble(style: BubbleStyle) {
	if (style === 'default') document.documentElement.removeAttribute('data-bubble');
	else document.documentElement.dataset.bubble = style;
}

export function applyReduceMotion(on: boolean) {
	if (on) document.documentElement.dataset.reduceMotion = '1';
	else document.documentElement.removeAttribute('data-reduce-motion');
}

export function applyTheme(pref: ThemePreference): 'light' | 'dark' {
	const resolved = resolveTheme(pref);
	document.documentElement.dataset.theme = resolved;
	document.documentElement.style.colorScheme = resolved;
	applyLook(getStoredLook(), resolved);
	applyWallpaper(getStoredWallpaper());
	applyIntensity(getStoredIntensity());
	applyBubble(getStoredBubble());
	applyReduceMotion(getStoredReduceMotion());
	return resolved;
}

/**
 * Cross-fades the palette instead of cutting to it.
 *
 * Changing theme or look rewrites dozens of custom properties in one frame, and
 * the whole app used to snap to the new colours — worst of all on the appearance
 * screen, which exists for trying them on. `.palette-switching` turns on a
 * colour-only transition for the length of the change; see motion.css. The class
 * is removed afterwards so it never taxes ordinary interaction, and the timer is
 * shared so rapid taps through the swatches do not end it early.
 */
const PALETTE_FADE_MS = 320;
let paletteFadeTimer: ReturnType<typeof setTimeout> | null = null;

function withPaletteFade(apply: () => void) {
	const root = typeof document !== 'undefined' ? document.documentElement : null;
	if (!root) {
		apply();
		return;
	}

	root.classList.add('palette-switching');
	apply();

	if (paletteFadeTimer) clearTimeout(paletteFadeTimer);
	paletteFadeTimer = setTimeout(() => {
		paletteFadeTimer = null;
		root.classList.remove('palette-switching');
	}, PALETTE_FADE_MS);
}

export function setThemePreference(pref: ThemePreference): 'light' | 'dark' {
	localStorage.setItem(MODE_KEY, pref);
	void patchSettings({ theme: pref }).catch(() => null);
	let resolved: 'light' | 'dark' = 'light';
	withPaletteFade(() => {
		resolved = applyTheme(pref);
	});
	return resolved;
}

export function setLookPreference(look: LookId) {
	localStorage.setItem(LOOK_KEY, look);
	void patchSettings({ look }).catch(() => null);
	withPaletteFade(() => applyLook(look));
}

export function setWallpaperPreference(wallpaper: WallpaperId) {
	localStorage.setItem(WALLPAPER_KEY, wallpaper);
	withPaletteFade(() => applyWallpaper(wallpaper));
}

export function setIntensityPreference(intensity: WallpaperIntensity) {
	localStorage.setItem(INTENSITY_KEY, intensity);
	withPaletteFade(() => applyIntensity(intensity));
}

export function setBubblePreference(style: BubbleStyle) {
	localStorage.setItem(BUBBLE_KEY, style);
	applyBubble(style);
}

export function setReduceMotionPreference(on: boolean) {
	localStorage.setItem(REDUCE_MOTION_KEY, on ? '1' : '0');
	applyReduceMotion(on);
}

export function initTheme(): ThemePreference {
	const pref = getStoredTheme();
	applyTheme(pref);
	return pref;
}

/** @deprecated use LookId / setLookPreference */
export type AccentId = LookId;
/** @deprecated */
export const ACCENTS = LOOKS.map((l) => ({ id: l.id as AccentId, label: l.id }));
/** @deprecated */
export const getStoredAccent = getStoredLook;
/** @deprecated */
export const setAccentPreference = setLookPreference;
/** @deprecated */
export const applyAccent = applyLook;
