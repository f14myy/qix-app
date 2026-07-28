export type LastSeenVisibility = 'everyone' | 'chats' | 'nobody';
export type WhoCanMessage = 'everyone' | 'chats' | 'nobody';
export type ProfileVisibility = 'everyone' | 'chats' | 'nobody';

export type UserSettingsDTO = {
	notifyMessages: boolean;
	notifyReactions: boolean;
	notifySound: boolean;
	haptics: boolean;
	sendWithEnter: boolean;
	linkPreviews: boolean;
	confirmMessageDelete: boolean;
	autoPlayVoice: boolean;
	lastSeenVisibility: LastSeenVisibility;
	lastSeenReciprocity: boolean;
	readReceipts: boolean;
	showTyping: boolean;
	whoCanMessage: WhoCanMessage;
	profileVisibility: ProfileVisibility;
	look: string;
	theme: string;
};

export const DEFAULT_SETTINGS: UserSettingsDTO = {
	notifyMessages: true,
	notifyReactions: true,
	notifySound: true,
	haptics: true,
	sendWithEnter: true,
	linkPreviews: true,
	confirmMessageDelete: true,
	autoPlayVoice: true,
	lastSeenVisibility: 'everyone',
	lastSeenReciprocity: true,
	readReceipts: true,
	showTyping: true,
	whoCanMessage: 'everyone',
	profileVisibility: 'everyone',
	look: 'citrus',
	theme: 'light'
};
