import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Tauri ships the frontend as static files with no Node server, so the whole app
 * is a client-rendered SPA: every route falls back to index.html and the data
 * that `qix-www` fetches in `+page.server.ts` is fetched from its HTTP API here
 * instead. See `src/lib/net/api.ts`.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Same rule as qix-www: force runes for our own code so components copied
		// over from the site compile in exactly the same mode, while dependencies
		// keep their own (legacy) semantics.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		// Dynamic routes (/chat/[id], /u/[username]) only exist at runtime.
		prerender: { entries: [] }
	}
};

export default config;
