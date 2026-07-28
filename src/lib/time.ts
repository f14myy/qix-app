import { en, ru, type Locale } from './i18n/dicts';

export function formatRelativeTime(iso: string, locale: Locale = 'en', now = Date.now()): string {
	const then = new Date(iso).getTime();
	const diff = Math.max(0, now - then);
	const sec = Math.floor(diff / 1000);
	const dict = locale === 'ru' ? ru : en;
	if (sec < 60) return dict['time.now'];
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h`;
	const day = Math.floor(hr / 24);
	if (day === 1) return dict['time.yesterday'];
	if (day < 7) return `${day}d`;
	return new Date(iso).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
		month: 'short',
		day: 'numeric'
	});
}

export function formatMessageTime(iso: string, locale: Locale = 'en'): string {
	return new Date(iso).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function dayKey(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDayLabel(iso: string, locale: Locale = 'en', now = new Date()): string {
	const d = new Date(iso);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
	const dict = locale === 'ru' ? ru : en;
	if (diffDays === 0) return dict['time.today'];
	if (diffDays === 1) return dict['time.yesterday'];
	return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}

export function formatLastSeen(iso: string | null, locale: Locale = 'en'): string {
	if (!iso) return '';
	const then = new Date(iso).getTime();
	if (Date.now() - then < 60_000) {
		return locale === 'ru' ? ru['chat.online'] : en['chat.online'];
	}
	return formatRelativeTime(iso, locale);
}

export function isOnlineIso(iso: string | null | undefined): boolean {
	if (!iso) return false;
	return Date.now() - new Date(iso).getTime() < 60_000;
}
