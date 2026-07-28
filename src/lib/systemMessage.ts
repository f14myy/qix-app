/**
 * System messages — the "Alice added Bob" lines inside a group.
 *
 * They live in the `messages` table like anything else, with `kind = 'system'`,
 * so they order, paginate and stream through the existing machinery for free.
 * What they must NOT do is store a rendered English sentence: the same row is
 * read by a Russian client, and the people it names can be renamed afterwards.
 *
 * So the body stores only an event name and, at most, one argument:
 *
 *     member.added|usr_abc
 *     group.renamed|Weekend plans
 *
 * The server resolves user arguments to current display names on the way out
 * (see `systemMeta` in server/groups.ts) and the client picks the phrasing from
 * the dictionary. This module is the shared vocabulary both halves agree on.
 */

export const SYSTEM_EVENTS = [
	'group.created',
	'group.renamed',
	'group.photo',
	'group.photoCleared',
	'group.description',
	'group.descriptionCleared',
	'member.added',
	'member.removed',
	'member.left',
	'member.joined',
	'role.promoted',
	'role.demoted',
	'group.ownerChanged'
] as const;

export type SystemEvent = (typeof SYSTEM_EVENTS)[number];

/** Events whose argument is a user id rather than free text. */
const USER_ARG_EVENTS = new Set<SystemEvent>([
	'member.added',
	'member.removed',
	'role.promoted',
	'role.demoted',
	'group.ownerChanged'
]);

/** Events whose argument is free text supplied by a member. */
const TEXT_ARG_EVENTS = new Set<SystemEvent>(['group.renamed']);

export function isSystemEvent(value: string): value is SystemEvent {
	return (SYSTEM_EVENTS as readonly string[]).includes(value);
}

export function systemEventTakesUser(event: SystemEvent): boolean {
	return USER_ARG_EVENTS.has(event);
}

export function systemEventTakesText(event: SystemEvent): boolean {
	return TEXT_ARG_EVENTS.has(event);
}

/**
 * Builds a body for the `messages` row.
 *
 * The argument is truncated and stripped of the separator, because a group title
 * is user input and a stray `|` would otherwise be read back as a second field.
 */
export function encodeSystemBody(event: SystemEvent, arg?: string | null): string {
	if (!arg) return event;
	const clean = arg.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
	return clean ? `${event}|${clean}` : event;
}

export function decodeSystemBody(body: string): { event: SystemEvent; arg: string | null } | null {
	const sep = body.indexOf('|');
	const head = sep === -1 ? body : body.slice(0, sep);
	if (!isSystemEvent(head)) return null;
	const arg = sep === -1 ? null : body.slice(sep + 1) || null;
	return { event: head, arg };
}

/**
 * What a client needs to render one system line: the event, plus names already
 * resolved by the server so the client never has to know about departed members.
 */
export type SystemMessageMeta = {
	event: SystemEvent;
	/** Display name of whoever acted. */
	actor: string;
	/** Display name of the member the event is about, when it has one. */
	target: string | null;
	/** Free text the event carries — currently only a new group title. */
	text: string | null;
};

/** i18n key per event. Every entry takes {actor}; some also take {target}/{text}. */
export const SYSTEM_EVENT_KEYS: Record<SystemEvent, string> = {
	'group.created': 'sys.groupCreated',
	'group.renamed': 'sys.groupRenamed',
	'group.photo': 'sys.groupPhoto',
	'group.photoCleared': 'sys.groupPhotoCleared',
	'group.description': 'sys.groupDescription',
	'group.descriptionCleared': 'sys.groupDescriptionCleared',
	'member.added': 'sys.memberAdded',
	'member.removed': 'sys.memberRemoved',
	'member.left': 'sys.memberLeft',
	'member.joined': 'sys.memberJoined',
	'role.promoted': 'sys.rolePromoted',
	'role.demoted': 'sys.roleDemoted',
	'group.ownerChanged': 'sys.ownerChanged'
};

/**
 * Fills a translated template.
 *
 * Deliberately not a regex over the whole string: names come from user input, and
 * substituting placeholder-by-placeholder means a display name containing the
 * literal text `{target}` cannot make the next replacement read from it.
 */
export function formatSystemLine(template: string, meta: SystemMessageMeta): string {
	let out = '';
	let i = 0;
	while (i < template.length) {
		const open = template.indexOf('{', i);
		if (open === -1) {
			out += template.slice(i);
			break;
		}
		const close = template.indexOf('}', open);
		if (close === -1) {
			out += template.slice(i);
			break;
		}
		out += template.slice(i, open);
		const name = template.slice(open + 1, close);
		out +=
			name === 'actor'
				? meta.actor
				: name === 'target'
					? (meta.target ?? '')
					: name === 'text'
						? (meta.text ?? '')
						: template.slice(open, close + 1);
		i = close + 1;
	}
	return out;
}
