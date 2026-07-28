let requests = $state(0);
let unread = $state(0);

export function getRequestBadge() {
	return requests;
}

export function getUnreadBadge() {
	return unread;
}

export function setUnreadBadge(value: number) {
	unread = value;
}

export function setRequestBadge(value: number) {
	requests = value;
}

export async function refreshRequestBadge() {
	try {
		const res = await fetch('/api/requests');
		const json = await res.json();
		requests = Array.isArray(json.requests) ? json.requests.length : 0;
	} catch {
		requests = 0;
	}
}
