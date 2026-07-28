/**
 * SvelteKit client hooks.
 *
 * Catches unhandled errors that would otherwise crash the Android WebView
 * without any visible feedback. On desktop/browser these are harmless console
 * errors, but on Android they can bring down the whole process.
 */
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, message }) => {
	// Log to console so it shows up in logcat / devtools
	console.error('[qix] unhandled client error:', error);

	return {
		message: message || 'An unexpected error occurred'
	};
};
