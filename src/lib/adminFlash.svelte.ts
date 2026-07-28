let toastId = 0;

export type AdminToastKind = 'ok' | 'err';

export type AdminToast = {
	id: number;
	text: string;
	kind: AdminToastKind;
};

let toasts = $state<AdminToast[]>([]);
let confirmMsg = $state<string | null>(null);
let confirmResolve = $state<((ok: boolean) => void) | null>(null);

export function getAdminToasts() {
	return toasts;
}

export function getAdminConfirm() {
	return confirmMsg;
}

export function adminToast(text: string, kind: AdminToastKind = 'ok') {
	const id = ++toastId;
	toasts = [...toasts, { id, text, kind }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 2800);
}

export function adminConfirm(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		confirmMsg = message;
		confirmResolve = resolve;
	});
}

export function resolveAdminConfirm(ok: boolean) {
	confirmResolve?.(ok);
	confirmResolve = null;
	confirmMsg = null;
}

export function dismissAdminToast(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
}
