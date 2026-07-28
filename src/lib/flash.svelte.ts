let toastId = 0;

export type FlashKind = 'ok' | 'err';

export type FlashToast = {
	id: number;
	text: string;
	kind: FlashKind;
};

type PromptState = {
	message: string;
	placeholder: string;
	resolve: (value: string | null) => void;
};

let toasts = $state<FlashToast[]>([]);
let confirmMsg = $state<string | null>(null);
let confirmResolve = $state<((ok: boolean) => void) | null>(null);
let promptState = $state<PromptState | null>(null);

export function getToasts() {
	return toasts;
}

export function getConfirm() {
	return confirmMsg;
}

export function getPrompt() {
	return promptState;
}

export function toast(text: string, kind: FlashKind = 'ok') {
	const id = ++toastId;
	toasts = [...toasts, { id, text, kind }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 2800);
}

export function confirmDialog(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		confirmMsg = message;
		confirmResolve = resolve;
	});
}

export function resolveConfirm(ok: boolean) {
	confirmResolve?.(ok);
	confirmResolve = null;
	confirmMsg = null;
}

export function promptDialog(message: string, placeholder = ''): Promise<string | null> {
	return new Promise((resolve) => {
		promptState = { message, placeholder, resolve };
	});
}

export function resolvePrompt(value: string | null) {
	promptState?.resolve(value);
	promptState = null;
}

export function dismissToast(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
}
