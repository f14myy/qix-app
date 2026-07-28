import { DEFAULT_SETTINGS, type UserSettingsDTO } from './settingsTypes';

const CACHE_KEY = 'qix-settings-cache';

let memory: UserSettingsDTO | null = null;

export type ClientSettings = UserSettingsDTO;
export type { UserSettingsDTO, LastSeenVisibility, WhoCanMessage, ProfileVisibility } from './settingsTypes';
export { DEFAULT_SETTINGS } from './settingsTypes';

export function getCachedSettings(): ClientSettings {
	if (memory) return memory;
	if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<UserSettingsDTO>;
		memory = { ...DEFAULT_SETTINGS, ...parsed };
		return memory;
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function setCachedSettings(settings: ClientSettings) {
	memory = settings;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
	} catch {
		/* ignore */
	}
}

export async function fetchSettings(): Promise<ClientSettings> {
	const res = await fetch('/api/me/settings');
	const json = await res.json();
	if (!res.ok) throw new Error(json.error || 'Failed to load settings');
	setCachedSettings(json.settings as ClientSettings);
	return json.settings as ClientSettings;
}

export async function patchSettings(patch: Partial<ClientSettings>): Promise<ClientSettings> {
	const res = await fetch('/api/me/settings', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(patch)
	});
	const json = await res.json();
	if (!res.ok) throw new Error(json.error || 'Failed to save');
	setCachedSettings(json.settings as ClientSettings);
	return json.settings as ClientSettings;
}
