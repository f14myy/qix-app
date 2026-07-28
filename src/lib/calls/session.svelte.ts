export type CallPeer = {
	id: string;
	username: string;
	displayName: string | null;
	avatarPath: string | null;
};

export type CallDTO = {
	id: string;
	chatId: string;
	video: boolean;
	status: 'ringing' | 'active' | 'ended';
	role: 'caller' | 'callee';
	peer: CallPeer;
	createdAt: number;
	iceServers: RTCIceServer[];
};

export type CallPhase =
	| 'idle'
	| 'outgoing'
	| 'incoming'
	| 'connecting'
	| 'active'
	| 'ended';

/** Stable keys mapped in the UI via i18n (`call.*`). */
export type CallErrorCode = 'permission' | 'connectionLost' | 'acceptFailed' | 'failed';

type SignalMsg = {
	callId: string;
	fromUserId: string;
	type: 'offer' | 'answer' | 'ice';
	sdp: RTCSessionDescriptionInit | null;
	candidate: RTCIceCandidateInit | null;
};

async function postSignal(callId: string, body: Record<string, unknown>) {
	await fetch(`/api/calls/${callId}/signal`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function isPermissionError(e: unknown) {
	if (!(e instanceof Error)) return false;
	const name = e.name || '';
	const msg = e.message.toLowerCase();
	return (
		name === 'NotAllowedError' ||
		name === 'PermissionDeniedError' ||
		msg.includes('permission') ||
		msg.includes('denied') ||
		msg.includes('not allowed')
	);
}

export class CallSession {
	call: CallDTO;

	/*
	 * Everything the overlay renders is `$state` — which is why this module is
	 * `.svelte.ts`.
	 *
	 * The store's `bump()` counter cannot carry these on its own: the overlay
	 * reads the session through a `$derived`, and a derived that recomputes to
	 * the same object reference counts as unchanged, so the template is never
	 * invalidated. Mutating a plain field showed nothing on screen — pressing
	 * Accept started the media and the negotiation, then left the overlay
	 * ringing forever with the remote stream attached to nothing. `bump()` is
	 * still what makes a session appearing or disappearing reactive.
	 */
	phase: CallPhase = $state<CallPhase>('idle');
	localStream: MediaStream | null = $state(null);
	remoteStream: MediaStream | null = $state(null);
	muted = $state(false);
	cameraOff = $state(false);
	error: CallErrorCode | '' = $state<CallErrorCode | ''>('');
	reconnecting = $state(false);
	connectedAt: number | null = $state(null);
	/** True once this side has agreed to the call; gates SDP handling for the callee. */
	accepted = false;

	private pc: RTCPeerConnection | null = null;
	private pendingIce: RTCIceCandidateInit[] = [];
	private disposed = false;
	private onChange: () => void;
	private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private iceRestarts = 0;

	/*
	 * Perfect negotiation state.
	 *
	 * Both sides may need to offer — the caller at the start, and either side
	 * after resuming a call that was interrupted. Two offers crossing mid-flight
	 * ("glare") put the connection into an invalid signaling state and the call
	 * dies. The roles below break the tie deterministically: the callee is polite
	 * and rolls its own offer back, the caller is impolite and ignores the
	 * incoming one.
	 */
	private readonly polite: boolean;
	private makingOffer = false;
	private ignoreOffer = false;
	private settingRemoteAnswer = false;

	constructor(call: CallDTO, phase: CallPhase, onChange: () => void) {
		this.call = call;
		this.phase = phase;
		this.onChange = onChange;
		this.polite = call.role === 'callee';
		this.accepted = call.role === 'caller' || call.status === 'active';
	}

	private notify() {
		if (!this.disposed) this.onChange();
	}

	private markActive() {
		if (this.phase === 'active' && this.connectedAt) {
			this.reconnecting = false;
			this.error = '';
			this.clearDisconnectTimer();
			this.notify();
			return;
		}
		this.phase = 'active';
		this.reconnecting = false;
		this.error = '';
		this.connectedAt ??= Date.now();
		this.clearDisconnectTimer();
		this.notify();
	}

	private clearDisconnectTimer() {
		if (this.disconnectTimer) {
			clearTimeout(this.disconnectTimer);
			this.disconnectTimer = null;
		}
	}

	async startMedia() {
		const constraints: MediaStreamConstraints = {
			// Without these the far end hears itself through our speaker. Browsers
			// default them on for getUserMedia, but only when asked as an object.
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true
			},
			video: this.call.video
				? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
				: false
		};
		try {
			this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
		} catch (e) {
			if (isPermissionError(e)) {
				this.error = 'permission';
				this.notify();
				throw Object.assign(new Error('permission'), { code: 'permission' as const });
			}
			this.error = 'failed';
			this.notify();
			throw e;
		}
		// The peer connection may already exist if a signal arrived first.
		this.attachLocalTracks();
		this.notify();
	}

	/** Idempotent: safe whether media or the connection came first. */
	private attachLocalTracks() {
		if (!this.pc || !this.localStream) return;
		const senders = this.pc.getSenders();
		for (const track of this.localStream.getTracks()) {
			if (senders.some((s) => s.track === track)) continue;
			this.pc.addTrack(track, this.localStream);
		}
	}

	private ensurePc() {
		if (this.pc) return this.pc;
		this.pc = new RTCPeerConnection({ iceServers: this.call.iceServers });
		this.pc.onicecandidate = (ev) => {
			if (!ev.candidate || this.disposed) return;
			void postSignal(this.call.id, {
				type: 'ice',
				candidate: ev.candidate.toJSON()
			});
		};
		this.pc.ontrack = (ev) => {
			if (!this.remoteStream) this.remoteStream = new MediaStream();
			for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
				this.remoteStream.addTrack(track);
			}
			this.markActive();
		};
		this.pc.onconnectionstatechange = () => {
			const s = this.pc?.connectionState;
			if (s === 'connected') {
				this.markActive();
				return;
			}
			if (s === 'disconnected') {
				this.reconnecting = true;
				this.notify();
				this.clearDisconnectTimer();
				this.disconnectTimer = setTimeout(() => {
					if (this.disposed || this.pc?.connectionState === 'connected') return;
					// Give ICE a chance to recover before giving up on the call.
					void this.renegotiate({ iceRestart: true });
				}, 3000);
				return;
			}
			if (s === 'failed') {
				this.clearDisconnectTimer();
				void this.renegotiate({ iceRestart: true });
			}
		};
		this.attachLocalTracks();
		return this.pc;
	}

	/**
	 * Sends a fresh offer.
	 *
	 * Used to (re)start negotiation: after the callee accepts, when a resumed
	 * call needs to re-establish media, and to restart ICE after a network
	 * change. Collisions are handled by `handleSignal`, so either side may call
	 * this at any time.
	 */
	async renegotiate(opts?: { iceRestart?: boolean }): Promise<void> {
		if (this.disposed) return;

		if (opts?.iceRestart) {
			// Two restarts that both fail mean the path is genuinely gone.
			if (this.iceRestarts >= 2) {
				this.error = 'connectionLost';
				this.reconnecting = false;
				this.notify();
				return;
			}
			this.iceRestarts += 1;
			this.reconnecting = true;
			this.notify();
		}

		const pc = this.ensurePc();
		try {
			this.makingOffer = true;
			if (opts?.iceRestart) pc.restartIce();
			const offer = await pc.createOffer(opts?.iceRestart ? { iceRestart: true } : undefined);
			// A remote offer may have landed while we were building ours.
			if (pc.signalingState !== 'stable') return;
			await pc.setLocalDescription(offer);
			await postSignal(this.call.id, { type: 'offer', sdp: pc.localDescription });
		} catch {
			if (opts?.iceRestart) {
				this.error = 'connectionLost';
				this.reconnecting = false;
				this.notify();
			}
		} finally {
			this.makingOffer = false;
		}
	}

	async prepareAsCaller() {
		await this.startMedia();
		this.ensurePc();
		this.phase = 'outgoing';
		this.notify();
	}

	async onAccepted() {
		this.accepted = true;
		this.phase = 'connecting';
		this.notify();
		if (this.call.role === 'caller') {
			await this.renegotiate();
		}
	}

	async acceptIncoming() {
		await this.startMedia();
		this.phase = 'connecting';
		const res = await fetch(`/api/calls/${this.call.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'accept' })
		});
		const json = (await res.json().catch(() => ({}))) as {
			error?: string;
			call?: { iceServers?: RTCIceServer[] };
		};
		if (!res.ok) {
			this.error = 'acceptFailed';
			this.notify();
			throw new Error(json.error || 'Accept failed');
		}
		/*
		 * The invite itself carries no ICE config, so the session was built with
		 * the cached one — STUN-only on the first call of a session, and with a
		 * TURN credential that may have expired on a later one. The accept
		 * response carries a fresh list, and it has to be applied *before* the
		 * peer connection exists: `iceServers` is read when the connection is
		 * constructed, so a callee who answered quickly would otherwise spend the
		 * whole call without a relay and fail behind a strict NAT.
		 */
		if (json.call?.iceServers?.length) this.call.iceServers = json.call.iceServers;
		this.ensurePc();
		this.accepted = true;
		this.notify();
		// An offer may have been buffered while we were still ringing.
		await this.flushPendingSdp();
	}

	async rejectIncoming() {
		await fetch(`/api/calls/${this.call.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'reject' })
		});
		this.phase = 'ended';
		this.dispose();
	}

	async hangup() {
		try {
			await fetch(`/api/calls/${this.call.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'end' })
			});
		} catch {
			/* ignore */
		}
		this.phase = 'ended';
		this.dispose();
	}

	/** An offer that arrived before the user pressed Accept. */
	private bufferedOffer: RTCSessionDescriptionInit | null = null;

	private async flushPendingSdp() {
		const offer = this.bufferedOffer;
		if (!offer) return;
		this.bufferedOffer = null;
		await this.applyDescription(offer);
	}

	private async flushPendingIce() {
		if (!this.pc?.remoteDescription) return;
		const queued = this.pendingIce;
		this.pendingIce = [];
		for (const candidate of queued) {
			try {
				await this.pc.addIceCandidate(candidate);
			} catch {
				/* a candidate from a superseded negotiation */
			}
		}
	}

	async handleSignal(msg: SignalMsg) {
		if (msg.callId !== this.call.id || this.disposed) return;

		if (msg.type === 'ice') {
			if (!msg.candidate) return;
			// Candidates routinely beat their description through the relay.
			if (!this.pc?.remoteDescription) {
				this.pendingIce.push(msg.candidate);
				return;
			}
			try {
				await this.pc.addIceCandidate(msg.candidate);
			} catch {
				// Expected while an ignored offer is still in flight.
			}
			return;
		}

		if (!msg.sdp) return;

		// Answering before the user accepted would negotiate a connection with no
		// microphone attached, and the call would be silent once accepted.
		if (!this.accepted) {
			if (msg.sdp.type === 'offer') this.bufferedOffer = msg.sdp;
			return;
		}

		await this.applyDescription(msg.sdp);
	}

	private async applyDescription(sdp: RTCSessionDescriptionInit) {
		const pc = this.ensurePc();
		const isOffer = sdp.type === 'offer';

		const readyForOffer =
			!this.makingOffer && (pc.signalingState === 'stable' || this.settingRemoteAnswer);
		const collision = isOffer && !readyForOffer;

		// Impolite side wins the tie and keeps its own offer.
		this.ignoreOffer = !this.polite && collision;
		if (this.ignoreOffer) return;

		try {
			if (collision) {
				// Polite side withdraws its offer and accepts theirs.
				await Promise.all([
					pc.setLocalDescription({ type: 'rollback' } as RTCLocalSessionDescriptionInit),
					pc.setRemoteDescription(sdp)
				]);
			} else {
				this.settingRemoteAnswer = !isOffer;
				await pc.setRemoteDescription(sdp);
				this.settingRemoteAnswer = false;
			}

			await this.flushPendingIce();

			if (isOffer) {
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				await postSignal(this.call.id, { type: 'answer', sdp: pc.localDescription });
				if (this.phase !== 'active') {
					this.phase = 'connecting';
					this.notify();
				}
			} else {
				this.markActive();
			}
		} catch {
			this.settingRemoteAnswer = false;
			// A failed exchange is recoverable; the connection state watcher will
			// restart ICE if media never arrives.
		}
	}

	toggleMute() {
		this.muted = !this.muted;
		this.localStream?.getAudioTracks().forEach((t) => {
			t.enabled = !this.muted;
		});
		this.notify();
	}

	toggleCamera() {
		if (!this.call.video) return;
		this.cameraOff = !this.cameraOff;
		this.localStream?.getVideoTracks().forEach((t) => {
			t.enabled = !this.cameraOff;
		});
		this.notify();
	}

	dispose() {
		this.disposed = true;
		this.clearDisconnectTimer();
		this.pc?.close();
		this.pc = null;
		this.localStream?.getTracks().forEach((t) => t.stop());
		this.localStream = null;
		this.remoteStream = null;
		this.notify();
	}
}
