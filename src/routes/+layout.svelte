<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import CallOverlay from '$lib/components/CallOverlay.svelte';
	import WhatsNew from '$lib/components/WhatsNew.svelte';
	import AppFlash from '$lib/components/AppFlash.svelte';
	import RecoveryCodesGate from '$lib/components/RecoveryCodesGate.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import {
		handleIncomingInvite,
		onCallAccepted,
		onCallEnded,
		onCallRejected,
		onCallSignal,
		resumeActiveCall
	} from '$lib/calls/store.svelte';
	import { initTheme, setLookPreference, setThemePreference, statusBarColor, type LookId, type ThemePreference } from '$lib/theme';
	import { initLocale } from '$lib/i18n';
	import { fetchSettings } from '$lib/settings';
	import { registerServiceWorker } from '$lib/pwa';
	import { ENABLE_E2EE } from '$lib/e2ee/config';
	import { bootstrapE2ee } from '$lib/e2ee/bootstrap';
	import { canUseViewTransition } from '$lib/viewTransition';
	import { trackNavigation } from '$lib/nav';
	import { refreshRequestBadge } from '$lib/badges.svelte';
	import { goto } from '$app/navigation';
	import { forgetLogin } from '$lib/net/auth';
	import { resumeBackgroundNotifications } from '$lib/net/background';
	import { UNAUTHORIZED_EVENT } from '$lib/net/bootstrap';
	import { initSystemBars } from '$lib/net/systemBars';
	import { initWindowChrome } from '$lib/net/windowChrome';
	import { invalidateSessionUser } from './+layout';
	import '../app.css';

	let { children } = $props();
	let themeColor = $state('#f7f9ec');

	/** Top-level destinations that keep the bottom tab bar visible on phones. */
	const TAB_ROUTES = new Set(['/', '/requests', '/archive', '/settings']);
	/** Full-bleed flows that own the whole shell, rail included. */
	const CHROMELESS = ['/onboarding', '/invite/'];
	const showNav = $derived(
		!!page.data.user && !CHROMELESS.some((p) => page.url.pathname.startsWith(p))
	);
	/**
	 * On phones the bar only shows on top-level routes. On desktop it becomes a
	 * permanent side rail, so it renders everywhere and CSS hides it on narrow
	 * screens — that keeps the content column a constant width.
	 */
	const secondaryTabs = $derived(!TAB_ROUTES.has(page.url.pathname));

	onNavigate((navigation) => {
		trackNavigation(navigation.type);
		if (!canUseViewTransition()) return;

		// Drives the directional push/pop keyframes in app.css.
		document.documentElement.dataset.nav = navigation.type === 'popstate' ? 'back' : 'forward';

		return new Promise<void>((resolve) => {
			(
				document as Document & {
					startViewTransition: (cb: () => void | Promise<void>) => void;
				}
			).startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		initLocale();
		initTheme();
		themeColor = statusBarColor();
		const onTheme = () => {
			themeColor = statusBarColor();
		};
		window.addEventListener('qix-theme', onTheme);
		registerServiceWorker();
		fetchSettings().catch(() => {
			/* guest / offline */
		});
		if (page.data.user) {
			if (ENABLE_E2EE) {
				void bootstrapE2ee(page.data.user.id).catch(() => {
					/* crypto unavailable */
				});
			}
			void refreshRequestBadge();
			// Restart the Android background service if the user had it on.
			void resumeBackgroundNotifications();
		}

		/**
		 * The session token can be revoked while the app is open — another device
		 * signs out everywhere, or an admin bans the account. The fetch shim raises
		 * this on the first 401, and the guard flag keeps a burst of concurrent
		 * requests from queueing up several redirects.
		 */
		let signingOut = false;
		const onUnauthorized = () => {
			if (signingOut) return;
			signingOut = true;
			void (async () => {
				await forgetLogin();
				invalidateSessionUser();
				await goto('/login', { invalidateAll: true });
			})();
		};
		window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

		/**
		 * Tapping an Android notification launches MainActivity with the target
		 * route, which forwards it here once the WebView exists.
		 */
		const onOpenHref = (ev: Event) => {
			const href = (ev as CustomEvent<{ href?: string }>).detail?.href;
			if (href) void goto(href);
		};
		window.addEventListener('qix-open-href', onOpenHref);

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => {
			initTheme();
			themeColor = statusBarColor();
		};
		mq.addEventListener('change', onChange);

		// Android draws its status/navigation bar icons from the system theme,
		// which has nothing to do with the theme picked inside Qix.
		const stopSystemBars = initSystemBars();

		// On desktop the OS frame is the only frame we want — drop the site's.
		initWindowChrome();

		let es: EventSource | null = null;
		let beat: ReturnType<typeof setInterval> | undefined;

		function connectCalls() {
			if (!page.data.user) return;
			es?.close();
			es = new EventSource('/api/events');
			es.addEventListener('call_invite', (ev) => {
				try {
					const d = JSON.parse(ev.data) as {
						callId: string;
						chatId: string;
						video: boolean;
						from: {
							id: string;
							username: string;
							displayName: string | null;
							avatarPath: string | null;
						};
					};
					void handleIncomingInvite(d);
				} catch {
					/* ignore */
				}
			});
			es.addEventListener('call_accepted', (ev) => {
				try {
					const d = JSON.parse(ev.data) as { callId: string };
					void onCallAccepted(d.callId);
				} catch {
					/* ignore */
				}
			});
			es.addEventListener('call_rejected', (ev) => {
				try {
					const d = JSON.parse(ev.data) as { callId: string };
					onCallRejected(d.callId);
				} catch {
					/* ignore */
				}
			});
			es.addEventListener('call_ended', (ev) => {
				try {
					const d = JSON.parse(ev.data) as { callId: string };
					onCallEnded(d.callId);
				} catch {
					/* ignore */
				}
			});
			es.addEventListener('call_signal', (ev) => {
				try {
					const d = JSON.parse(ev.data) as {
						callId: string;
						fromUserId: string;
						type: 'offer' | 'answer' | 'ice';
						sdp: RTCSessionDescriptionInit | null;
						candidate: RTCIceCandidateInit | null;
					};
					void onCallSignal(d);
				} catch {
					/* ignore */
				}
			});
			startHeartbeat();
		}

		function startHeartbeat() {
			stopHeartbeat();
			beat = setInterval(() => fetch('/api/presence', { method: 'POST' }), 30000);
		}

		function stopHeartbeat() {
			if (beat) {
				clearInterval(beat);
				beat = undefined;
			}
		}

		function disconnectCalls() {
			es?.close();
			es = null;
			stopHeartbeat();
		}

		/**
		 * The event stream stays open in the background.
		 *
		 * It used to be closed whenever the app was hidden, which meant a
		 * `call_invite` never arrived and an incoming call simply did not ring —
		 * by the time you opened the app the 45s ring timeout had usually passed.
		 * One idle SSE connection is cheap; only the presence heartbeat stops,
		 * since nobody is looking at the screen.
		 */
		const onVisibility = () => {
			if (document.hidden) {
				stopHeartbeat();
				return;
			}
			if (!es || es.readyState === EventSource.CLOSED) connectCalls();
			else startHeartbeat();
			fetch('/api/presence', { method: 'POST' });
			void resumeActiveCall();
		};

		if (page.data.user) {
			connectCalls();
			void resumeActiveCall();
		}
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			stopSystemBars();
			mq.removeEventListener('change', onChange);
			window.removeEventListener('qix-theme', onTheme);
			window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
			window.removeEventListener('qix-open-href', onOpenHref);
			document.removeEventListener('visibilitychange', onVisibility);
			disconnectCalls();
		};
	});
</script>

<svelte:head>
	<title>Qix</title>
	<meta name="description" content="Light messenger for your privacy" />
	<meta name="theme-color" content={themeColor} />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Qix" />
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
</svelte:head>

<div class="app-shell">
	{@render children()}
	{#if showNav}
		<TabBar secondary={secondaryTabs} />
	{/if}
</div>

<AppFlash />

{#if page.data.user}
	<RecoveryCodesGate />
	<CallOverlay />
	<WhatsNew />
{/if}
