export type BadgeDTO = {
	id: string;
	label: string;
	color: string;
};

export type BannerKey =
	| 'default'
	| 'teal'
	| 'charcoal'
	| 'ember'
	| 'ocean'
	| 'forest'
	| 'sunset'
	| 'mist'
	| 'night';

export const BANNER_PRESETS: Array<{ key: BannerKey; labelEn: string; labelRu: string }> = [
	{ key: 'default', labelEn: 'Default', labelRu: 'По умолчанию' },
	{ key: 'teal', labelEn: 'Teal', labelRu: 'Бирюза' },
	{ key: 'charcoal', labelEn: 'Charcoal', labelRu: 'Уголь' },
	{ key: 'ember', labelEn: 'Ember', labelRu: 'Тлеющий' },
	{ key: 'ocean', labelEn: 'Ocean', labelRu: 'Океан' },
	{ key: 'forest', labelEn: 'Forest', labelRu: 'Лес' },
	{ key: 'sunset', labelEn: 'Sunset', labelRu: 'Закат' },
	{ key: 'mist', labelEn: 'Mist', labelRu: 'Туман' },
	{ key: 'night', labelEn: 'Night', labelRu: 'Ночь' }
];

export const BADGE_COLOR_PRESETS = [
	'#6b7280',
	'#1a7a6d',
	'#2b6cb0',
	'#c05621',
	'#b83232',
	'#2f855a',
	'#d69e2e',
	'#1a202c',
	'#805ad5'
] as const;

export function normalizeBannerKey(raw: string | null | undefined): BannerKey {
	const key = (raw ?? 'default') as BannerKey;
	return BANNER_PRESETS.some((b) => b.key === key) ? key : 'default';
}

export function normalizeBadgeColor(raw: string): string {
	const c = raw.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
	if (/^#[0-9a-fA-F]{3}$/.test(c)) {
		const [r, g, b] = c.slice(1);
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}
	return BADGE_COLOR_PRESETS[0];
}
