import { getCachedSettings } from './settings';

type VoiceControls = {
	id: string;
	play: () => void;
	pause: () => void;
};

const chain: VoiceControls[] = [];
let activeId: string | null = null;

/** Register a voice player in DOM order. Returns unregister. */
export function registerVoicePlayer(entry: VoiceControls) {
	chain.push(entry);
	return () => {
		const i = chain.findIndex((e) => e.id === entry.id);
		if (i >= 0) chain.splice(i, 1);
		if (activeId === entry.id) activeId = null;
	};
}

export function voiceStarted(id: string) {
	activeId = id;
	for (const e of chain) {
		if (e.id !== id) e.pause();
	}
}

/** When a voice ends, auto-play the next registered one. */
export function voiceEnded(id: string) {
	if (activeId !== id) return;
	if (!getCachedSettings().autoPlayVoice) {
		activeId = null;
		return;
	}
	const i = chain.findIndex((e) => e.id === id);
	const next = i >= 0 ? chain[i + 1] : undefined;
	if (next) {
		activeId = next.id;
		queueMicrotask(() => next.play());
	} else {
		activeId = null;
	}
}
