<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Phone from '@lucide/svelte/icons/phone';
	import PhoneOff from '@lucide/svelte/icons/phone-off';
	import Video from '@lucide/svelte/icons/video';
	import VideoOff from '@lucide/svelte/icons/video-off';
	import Avatar from '$lib/components/Avatar.svelte';
	import {
		acceptCall,
		getActiveCallSession,
		getCallTick,
		hangupCall,
		rejectCall
	} from '$lib/calls/store.svelte';
	import { toast } from '$lib/flash.svelte';
	import { haptic } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';

	const i18n = useI18n();
	let localEl: HTMLVideoElement | undefined = $state();
	let remoteEl: HTMLVideoElement | undefined = $state();
	let remoteAudio: HTMLAudioElement | undefined = $state();
	let busy = $state(false);
	let now = $state(Date.now());

	const session = $derived.by(() => {
		getCallTick();
		return getActiveCallSession();
	});

	const peerTitle = $derived(
		session ? session.call.peer.displayName || session.call.peer.username : ''
	);

	const ringing = $derived(
		session?.phase === 'outgoing' || session?.phase === 'incoming'
	);

	const showPeerAvatar = $derived.by(() => {
		if (!session) return false;
		if (!session.call.video) return true;
		if (session.phase !== 'active') return true;
		if (!session.remoteStream) return true;
		return false;
	});

	const durationLabel = $derived.by(() => {
		void now;
		if (!session?.connectedAt || session.phase !== 'active') return '';
		const sec = Math.max(0, Math.floor((now - session.connectedAt) / 1000));
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	const statusLabel = $derived.by(() => {
		if (!session) return '';
		if (session.error === 'permission') return i18n.t('call.permission');
		if (session.error === 'connectionLost') return i18n.t('call.connectionLost');
		if (session.error === 'acceptFailed') return i18n.t('call.acceptFailed');
		if (session.error === 'failed') return i18n.t('call.failed');
		if (session.reconnecting) return i18n.t('call.reconnecting');
		if (session.phase === 'active' && durationLabel) return durationLabel;
		switch (session.phase) {
			case 'outgoing':
				return i18n.t('call.calling');
			case 'incoming':
				return i18n.t('call.incoming');
			case 'connecting':
				return i18n.t('call.connecting');
			case 'active':
				return i18n.t('call.connected');
			default:
				return '';
		}
	});

	$effect(() => {
		const s = session;
		if (!s || s.phase === 'ended' || s.phase === 'idle') return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});

	$effect(() => {
		const s = session;
		if (!s?.connectedAt || s.phase !== 'active') return;
		now = Date.now();
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	/**
	 * Setting `srcObject` is not enough on its own: an element that was attached
	 * while the overlay was still mounting stays paused, and the call is silent
	 * with no error anywhere. Playback is (re)started explicitly, and only when
	 * the stream actually changed so this does not fight the user.
	 */
	function attach(el: HTMLMediaElement | undefined, stream: MediaStream | null) {
		if (!el || !stream || el.srcObject === stream) return;
		el.srcObject = stream;
		void el.play().catch(() => {
			/* autoplay policy — the accept button is a gesture, so this is rare */
		});
	}

	$effect(() => {
		const s = session;
		if (!s) return;
		attach(localEl, s.localStream);
		attach(remoteEl, s.remoteStream);
		attach(remoteAudio, s.remoteStream);
	});

	async function onAccept() {
		busy = true;
		haptic(12);
		try {
			await acceptCall();
		} catch (e) {
			toast(
				i18n.t(
					e instanceof Error &&
						(e.message === 'permission' || e.message.toLowerCase().includes('permission'))
						? 'call.permission'
						: 'common.error'
				),
				'err'
			);
		} finally {
			busy = false;
		}
	}

	async function onReject() {
		busy = true;
		haptic(8);
		try {
			await rejectCall();
		} finally {
			busy = false;
		}
	}

	async function onHangup() {
		busy = true;
		haptic(10);
		try {
			await hangupCall();
		} finally {
			busy = false;
		}
	}
</script>

{#if session && session.phase !== 'ended' && session.phase !== 'idle'}
	<div
		class="call-overlay"
		class:video={session.call.video}
		class:active={session.phase === 'active'}
		class:ringing
		role="dialog"
		aria-modal="true"
		aria-label={peerTitle}
	>
		{#if session.call.video}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video class="call-remote-video" bind:this={remoteEl} autoplay playsinline></video>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				class="call-local-video"
				bind:this={localEl}
				autoplay
				playsinline
				muted
				class:hidden={session.cameraOff || session.phase === 'incoming'}
			></video>
			{#if session.cameraOff && session.phase !== 'incoming'}
				<div class="call-local-placeholder" aria-hidden="true">
					<Avatar
						name={i18n.t('call.you')}
						size={40}
						avatarPath={null}
						userId="local"
					/>
				</div>
			{/if}
		{:else}
			<audio bind:this={remoteAudio} autoplay></audio>
		{/if}

		<div class="call-ambient-glow" aria-hidden="true"></div>

		<div class="call-stage">
			{#if showPeerAvatar}
				<div class="call-avatar-wrap" class:pulse={ringing}>
					<span class="call-ring" aria-hidden="true"></span>
					<span class="call-ring delay" aria-hidden="true"></span>
					<Avatar
						name={peerTitle}
						size={104}
						avatarPath={session.call.peer.avatarPath}
						userId={session.call.peer.id}
					/>
				</div>
			{/if}
			<p class="call-kind">
				{session.call.video ? i18n.t('call.video') : i18n.t('call.voice')}
			</p>
			<h2 class="call-name">{peerTitle}</h2>
			<p class="call-status" aria-live="polite">
				{#if session.phase === 'active' && durationLabel}
					<span class="call-status-live-dot" aria-hidden="true"></span>
				{/if}
				{statusLabel}
			</p>
			{#if session.error === 'connectionLost'}
				<button type="button" class="call-end-link" disabled={busy} onclick={onHangup}>
					{i18n.t('call.hangup')}
				</button>
			{/if}
		</div>

		<div class="call-actions">
			{#if session.phase === 'incoming'}
				<div class="call-action">
					<button
						type="button"
						class="call-btn reject"
						aria-label={i18n.t('call.reject')}
						disabled={busy}
						onclick={onReject}
					>
						<PhoneOff size={26} />
					</button>
					<span class="call-btn-label">{i18n.t('call.reject')}</span>
				</div>
				<div class="call-action">
					<button
						type="button"
						class="call-btn accept"
						aria-label={i18n.t('call.accept')}
						disabled={busy}
						onclick={onAccept}
					>
						<Phone size={26} />
					</button>
					<span class="call-btn-label">{i18n.t('call.accept')}</span>
				</div>
			{:else}
				<div class="call-action">
					<button
						type="button"
						class="call-btn mute"
						class:on={session.muted}
						aria-label={session.muted ? i18n.t('call.unmute') : i18n.t('call.mute')}
						onclick={() => {
							haptic(6);
							session?.toggleMute();
						}}
					>
						{#if session.muted}
							<MicOff size={22} />
						{:else}
							<Mic size={22} />
						{/if}
					</button>
					<span class="call-btn-label"
						>{session.muted ? i18n.t('call.unmute') : i18n.t('call.mute')}</span
					>
				</div>
				{#if session.call.video}
					<div class="call-action">
						<button
							type="button"
							class="call-btn cam"
							class:on={session.cameraOff}
							aria-label={session.cameraOff ? i18n.t('call.camOn') : i18n.t('call.camOff')}
							onclick={() => {
								haptic(6);
								session?.toggleCamera();
							}}
						>
							{#if session.cameraOff}
								<VideoOff size={22} />
							{:else}
								<Video size={22} />
							{/if}
						</button>
						<span class="call-btn-label"
							>{session.cameraOff ? i18n.t('call.camOn') : i18n.t('call.camOff')}</span
						>
					</div>
				{/if}
				<div class="call-action">
					<button
						type="button"
						class="call-btn reject"
						aria-label={i18n.t('call.hangup')}
						disabled={busy}
						onclick={onHangup}
					>
						<PhoneOff size={26} />
					</button>
					<span class="call-btn-label">{i18n.t('call.hangup')}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
