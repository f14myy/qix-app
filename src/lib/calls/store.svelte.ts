import { haptic } from '$lib/haptic';
import { CallSession, type CallDTO, type CallPeer, type CallPhase } from './session.svelte';

type InvitePayload = {
	callId: string;
	chatId: string;
	video: boolean;
	from: CallPeer;
};

let session: CallSession | null = null;
let tick = $state(0);
let iceServersCache: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' }
];
let ringVibrate: ReturnType<typeof setInterval> | null = null;

function bump() {
	tick += 1;
}

/* ── Ringing ────────────────────────────────────────────────────────────────
   Synthesised rather than shipped as an audio file: two short tones for an
   incoming call, one softer tone for the caller's ringback, so a call is
   audible and not just a vibration. Autoplay policy can leave the context
   suspended when there was no user gesture (an incoming call); the vibration
   still carries in that case. */

let ringCtx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;

function audioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	try {
		const Ctx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return null;
		ringCtx ??= new Ctx();
		if (ringCtx.state === 'suspended') void ringCtx.resume().catch(() => {});
		return ringCtx;
	} catch {
		return null;
	}
}

function tone(ctx: AudioContext, freq: number, at: number, duration: number, peak: number) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	// Ramped rather than switched, so it does not click.
	gain.gain.setValueAtTime(0.0001, at);
	gain.gain.exponentialRampToValueAtTime(peak, at + 0.04);
	gain.gain.setValueAtTime(peak, at + duration - 0.06);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(at);
	osc.stop(at + duration + 0.02);
}

function ringPulse(kind: 'incoming' | 'outgoing') {
	const ctx = audioContext();
	if (!ctx) return;
	const t = ctx.currentTime;
	if (kind === 'incoming') {
		tone(ctx, 660, t, 0.34, 0.08);
		tone(ctx, 880, t + 0.42, 0.34, 0.08);
	} else {
		tone(ctx, 440, t, 0.5, 0.035);
	}
}

function stopRinging() {
	if (ringTimer) {
		clearInterval(ringTimer);
		ringTimer = null;
	}
	if (ringVibrate) {
		clearInterval(ringVibrate);
		ringVibrate = null;
	}
	try {
		navigator.vibrate?.(0);
	} catch {
		/* ignore */
	}
}

function startRinging(kind: 'incoming' | 'outgoing') {
	stopRinging();

	const period = kind === 'incoming' ? 2400 : 3600;
	ringPulse(kind);
	ringTimer = setInterval(() => ringPulse(kind), period);

	// Only the callee's phone buzzes; the caller is already holding it.
	if (kind === 'incoming') {
		haptic([180, 120, 180, 520]);
		ringVibrate = setInterval(() => {
			haptic([180, 120, 180, 520]);
		}, 1600);
	}
}

export function getCallTick() {
	return tick;
}

export function getActiveCallSession() {
	void tick;
	return session;
}

export function getCallPhase(): CallPhase {
	void tick;
	return session?.phase ?? 'idle';
}

function setSession(next: CallSession | null) {
	if (!next) stopRinging();
	session?.dispose();
	session = next;
	bump();
}

export function mapCallStartError(raw: string): 'busy' | 'already' | 'permission' | 'failed' {
	const m = raw.toLowerCase();
	if (m.includes('busy')) return 'busy';
	if (m.includes('already')) return 'already';
	if (m === 'permission' || m.includes('permission') || m.includes('denied')) return 'permission';
	return 'failed';
}

export async function startOutgoingCall(chatId: string, video: boolean) {
	if (session && session.phase !== 'ended' && session.phase !== 'idle') {
		throw new Error('Already in a call');
	}
	const res = await fetch('/api/calls', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ chatId, video })
	});
	const json = await res.json();
	if (!res.ok) throw new Error(json.error || 'Failed to start call');
	const call = json.call as CallDTO;
	iceServersCache = call.iceServers?.length ? call.iceServers : iceServersCache;
	const s = new CallSession(call, 'outgoing', bump);
	setSession(s);
	try {
		await s.prepareAsCaller();
	} catch (e) {
		await hangupCall();
		throw e instanceof Error ? e : new Error('permission');
	}
	// Ringback, so the caller can hear that it is actually ringing. Stopped by
	// onCallAccepted / onCallRejected / hangup.
	startRinging('outgoing');
	return s;
}

export async function handleIncomingInvite(invite: InvitePayload) {
	if (session && session.phase !== 'ended' && session.phase !== 'idle') {
		// auto-busy: reject
		await fetch(`/api/calls/${invite.callId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'reject' })
		});
		return;
	}
	const call: CallDTO = {
		id: invite.callId,
		chatId: invite.chatId,
		video: invite.video,
		status: 'ringing',
		role: 'callee',
		peer: invite.from,
		createdAt: Date.now(),
		iceServers: iceServersCache
	};
	const s = new CallSession(call, 'incoming', bump);
	setSession(s);
	startRinging('incoming');

	// refresh ice servers from server
	try {
		const res = await fetch(`/api/calls/${invite.callId}`);
		const json = await res.json();
		if (res.ok && json.call?.iceServers) {
			s.call.iceServers = json.call.iceServers;
			iceServersCache = json.call.iceServers;
		}
	} catch {
		/* ignore */
	}
}

export async function acceptCall() {
	if (!session || session.phase !== 'incoming') return;
	stopRinging();
	await session.acceptIncoming();
}

export async function rejectCall() {
	if (!session) return;
	stopRinging();
	await session.rejectIncoming();
	setSession(null);
}

export async function hangupCall() {
	if (!session) return;
	stopRinging();
	await session.hangup();
	setSession(null);
}

export async function onCallAccepted(callId: string) {
	if (!session || session.call.id !== callId) return;
	stopRinging();
	await session.onAccepted();
}

export function onCallEnded(callId: string) {
	if (!session || session.call.id !== callId) return;
	stopRinging();
	session.phase = 'ended';
	session.dispose();
	setSession(null);
}

export function onCallRejected(callId: string) {
	if (!session || session.call.id !== callId) return;
	stopRinging();
	session.phase = 'ended';
	session.dispose();
	setSession(null);
}

export async function onCallSignal(msg: {
	callId: string;
	fromUserId: string;
	type: 'offer' | 'answer' | 'ice';
	sdp: RTCSessionDescriptionInit | null;
	candidate: RTCIceCandidateInit | null;
}) {
	if (!session || session.call.id !== msg.callId) return;
	await session.handleSignal(msg);
}

export async function resumeActiveCall() {
	try {
		const res = await fetch('/api/calls');
		const json = await res.json();
		if (!res.ok || !json.call) return;
		const call = json.call as CallDTO;
		if (call.status === 'ended') return;
		if (session?.call.id === call.id) return;
		iceServersCache = call.iceServers?.length ? call.iceServers : iceServersCache;
		const phase: CallPhase =
			call.status === 'ringing'
				? call.role === 'caller'
					? 'outgoing'
					: 'incoming'
				: 'connecting';
		const s = new CallSession(call, phase, bump);
		setSession(s);
		if (phase === 'incoming') startRinging('incoming');
		if (phase === 'outgoing') startRinging('outgoing');
		if (phase === 'outgoing' || phase === 'connecting') {
			await s.startMedia();
			/*
			 * A call already in progress has to be re-negotiated from scratch: the
			 * old peer connection died with the page. Previously only the caller
			 * did this, which left a returning callee stuck on "connecting"
			 * forever. Perfect negotiation makes it safe for either side to offer,
			 * so whoever came back drives it.
			 */
			if (call.status === 'active') await s.renegotiate();
		}
	} catch {
		/* ignore */
	}
}
