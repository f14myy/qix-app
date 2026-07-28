import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

// `tauri android dev` sets this so the phone can reach the dev server over LAN.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [sveltekit()],

	// Let Rust compile errors stay on screen.
	clearScreen: false,

	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},

	build: {
		/*
		 * `target` and `cssTarget` are deliberately left at Vite's defaults — the
		 * same ones qix-www builds with — so the emitted CSS is byte-identical to
		 * the site's. Raising cssTarget makes Vite drop `-webkit-user-select` and
		 * `-webkit-backdrop-filter`, which the Android WebView and WKWebView still
		 * need; the result renders differently. Verified by diffing the two
		 * bundles, so do not "modernise" this without re-diffing.
		 */
		// `true` picks Vite 8's bundled minifier (oxc); naming esbuild explicitly
		// would pull in a dependency this project does not otherwise need.
		minify: !process.env.TAURI_ENV_DEBUG,
		sourcemap: !!process.env.TAURI_ENV_DEBUG
	}
});
