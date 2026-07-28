/**
 * Tells the stylesheet that we are the window, not a tab in one.
 *
 * The site has to draw its own frame: at desktop widths it centres a 1180px
 * rounded shell on a darkened backdrop, because a chat client stretched across a
 * browser viewport looks like a mistake. The desktop build has no browser around
 * it — the OS already drew the frame — so that shell becomes a second, smaller
 * window painted inside the real one, with a dead border all the way round.
 *
 * `desktop.css` keys the frameless, full-window layout off `html.native-window`,
 * which is set here. An installed PWA gets the same treatment through
 * `display-mode: standalone`, which a class cannot cover because it has to hold
 * before first paint.
 *
 * Android is excluded: its layout is the phone layout, which never had a frame.
 */
import { isMobile, isTauri } from './platform';

export function initWindowChrome(): void {
	if (typeof document === 'undefined') return;
	if (!isTauri() || isMobile()) return;
	document.documentElement.classList.add('native-window');
}
