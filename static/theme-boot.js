/*
 * Copied verbatim from qix-www/src/app.html, where it runs inline.
 *
 * It must apply the stored theme, look and wallpaper before the first paint or
 * the app flashes the wrong palette. The app's CSP forbids inline scripts, so it
 * lives in its own file and is loaded with a plain (render-blocking) <script>
 * tag in <head> — same timing, same result.
 */

/* Global error guard — surfaces JS crashes on Android instead of silently killing the WebView */
window.onerror = function (msg, src, line, col, err) {
	try {
		var detail = msg + '\n' + (src || '') + ':' + line + ':' + col + '\n' + (err && err.stack ? err.stack : '');
		console.error('[qix-crash]', detail);
		document.title = 'ERR: ' + msg;
	} catch (e) { /* last resort */ }
};
window.addEventListener('unhandledrejection', function (ev) {
	try {
		var reason = ev.reason;
		var detail = reason instanceof Error ? reason.message + '\n' + reason.stack : String(reason);
		console.error('[qix-crash] unhandled rejection:', detail);
		document.title = 'ERR: ' + (reason && reason.message ? reason.message : String(reason));
	} catch (e) { /* last resort */ }
});

(function () {
	try {
		var pref = localStorage.getItem('qix-theme') || 'system';
		var dark =
			pref === 'dark' ||
			(pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
		var look = localStorage.getItem('qix-look');
		if (!look) {
			var legacy = localStorage.getItem('qix-accent');
			var map = { teal: 'qix', ocean: 'lagoon', forest: 'meadow', slate: 'graphite', amber: 'ember' };
			/* Default must match getStoredLook() in lib/theme.ts or the first
			   paint flashes one look before hydration swaps in another. */
			look = map[legacy] || 'citrus';
		}
		var looks = [
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
		if (looks.indexOf(look) === -1) look = 'citrus';
		document.documentElement.dataset.look = look;
		var wallpaper = localStorage.getItem('qix-wallpaper') || 'dots';
		var walls = [
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
		if (walls.indexOf(wallpaper) === -1) wallpaper = 'dots';
		document.documentElement.dataset.wallpaper = wallpaper;
		var intensity = localStorage.getItem('qix-wallpaper-intensity') || 'normal';
		if (['soft', 'normal', 'bold'].indexOf(intensity) === -1) intensity = 'normal';
		document.documentElement.dataset.wpIntensity = intensity;
		var bubble = localStorage.getItem('qix-bubble') || 'default';
		if (['default', 'soft', 'pill', 'sharp'].indexOf(bubble) === -1) bubble = 'default';
		if (bubble !== 'default') document.documentElement.dataset.bubble = bubble;
		if (localStorage.getItem('qix-reduce-motion') === '1') {
			document.documentElement.dataset.reduceMotion = '1';
		}
		/* Match --bg-elevated so iOS PWA safe-area matches the shell */
		var colors = {
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
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta && colors[look])
			meta.setAttribute('content', dark ? colors[look].dark : colors[look].light);
	} catch (e) {}
})();
