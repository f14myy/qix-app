/**
 * Telegram-like lightweight markup → safe HTML.
 * Supports: *bold*, _italic_, ~strike~, `code`, ```pre```, ||spoiler||, [text](url), autolinks.
 */

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
	return escapeHtml(s).replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
	try {
		const u = new URL(url, 'https://example.com');
		return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
	} catch {
		return false;
	}
}

type Token =
	| { type: 'text'; value: string }
	| { type: 'bold'; value: string }
	| { type: 'italic'; value: string }
	| { type: 'strike'; value: string }
	| { type: 'code'; value: string }
	| { type: 'pre'; value: string }
	| { type: 'spoiler'; value: string }
	| { type: 'link'; text: string; href: string };

const INLINE_RE =
	/```([\s\S]+?)```|\|\|(.+?)\|\||`([^`]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~|\[([^\]]+?)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+)/g;

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let last = 0;
	const re = new RegExp(INLINE_RE.source, 'g');
	let m: RegExpExecArray | null;
	while ((m = re.exec(input))) {
		if (m.index > last) {
			tokens.push({ type: 'text', value: input.slice(last, m.index) });
		}
		if (m[1] !== undefined) tokens.push({ type: 'pre', value: m[1] });
		else if (m[2] !== undefined) tokens.push({ type: 'spoiler', value: m[2] });
		else if (m[3] !== undefined) tokens.push({ type: 'code', value: m[3] });
		else if (m[4] !== undefined) tokens.push({ type: 'bold', value: m[4] });
		else if (m[5] !== undefined) tokens.push({ type: 'italic', value: m[5] });
		else if (m[6] !== undefined) tokens.push({ type: 'strike', value: m[6] });
		else if (m[7] !== undefined && m[8] !== undefined) {
			tokens.push({ type: 'link', text: m[7], href: m[8] });
		} else if (m[9] !== undefined) {
			const href = m[9].replace(/[.,);:!?]+$/, '');
			tokens.push({ type: 'link', text: href, href });
		}
		last = m.index + m[0].length;
	}
	if (last < input.length) tokens.push({ type: 'text', value: input.slice(last) });
	return tokens;
}

function renderToken(t: Token): string {
	switch (t.type) {
		case 'text':
			return escapeHtml(t.value);
		case 'bold':
			return `<strong>${escapeHtml(t.value)}</strong>`;
		case 'italic':
			return `<em>${escapeHtml(t.value)}</em>`;
		case 'strike':
			return `<s>${escapeHtml(t.value)}</s>`;
		case 'code':
			return `<code class="msg-code">${escapeHtml(t.value)}</code>`;
		case 'pre':
			return `<pre class="msg-pre"><code>${escapeHtml(t.value)}</code></pre>`;
		case 'spoiler':
			return `<span class="msg-spoiler" tabindex="0" role="button">${escapeHtml(t.value)}</span>`;
		case 'link': {
			if (!isSafeUrl(t.href)) return escapeHtml(t.text);
			return `<a class="msg-link" href="${escapeAttr(t.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.text)}</a>`;
		}
	}
}

/** Returns HTML safe for {@html}. Plain text is escaped. */
export function formatMessageHtml(body: string): string {
	if (!body) return '';
	const parts = body.split('\n');
	return parts
		.map((line) => {
			if (!line) return '<br>';
			return tokenize(line).map(renderToken).join('');
		})
		.join('<br>');
}

export function stripMessageMarkup(body: string): string {
	return body
		.replace(/```([\s\S]+?)```/g, '$1')
		.replace(/\|\|(.+?)\|\|/g, '$1')
		.replace(/`([^`]+?)`/g, '$1')
		.replace(/\*([^*\n]+?)\*/g, '$1')
		.replace(/_([^_\n]+?)_/g, '$1')
		.replace(/~([^~\n]+?)~/g, '$1')
		.replace(/\[([^\]]+?)\]\(([^)\s]+)\)/g, '$1');
}
