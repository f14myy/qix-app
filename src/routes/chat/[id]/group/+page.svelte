<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Camera from '@lucide/svelte/icons/camera';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Link2 from '@lucide/svelte/icons/link-2';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Pencil from '@lucide/svelte/icons/pencil';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '$lib/components/Avatar.svelte';
	import GroupAvatar from '$lib/components/GroupAvatar.svelte';
	import NameWithBadges from '$lib/components/NameWithBadges.svelte';
	import { confirmDialog, toast } from '$lib/flash.svelte';
	import { haptic, hapticFail, hapticSuccess } from '$lib/haptic';
	import { useI18n } from '$lib/i18n/useI18n.svelte';
	import { goBack } from '$lib/nav';
	import { isOnlineIso } from '$lib/time';
	import type { GroupInfoDTO, GroupMemberDTO, GroupRole } from '$lib/types';

	type Person = {
		id: string;
		username: string;
		displayName: string | null;
		avatarPath: string | null;
	};

	const i18n = useI18n();
	const chatId = $derived(page.params.id ?? '');

	let group = $state<GroupInfoDTO | null>(null);
	let members = $state<GroupMemberDTO[]>([]);
	let loading = $state(true);
	let notFound = $state(false);

	/* Editing identity. Kept apart from `group` so an in-flight edit is not clobbered
	   by a `group_update` refresh landing mid-typing. */
	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(null);
	let removePhoto = $state(false);
	let saving = $state(false);
	let photoInput: HTMLInputElement | undefined = $state();

	let filter = $state('');
	let acting = $state(false);
	/** The member whose action sheet is open. */
	let sheetMember = $state<GroupMemberDTO | null>(null);

	let showAdd = $state(false);
	let addQuery = $state('');
	let addResults = $state<Person[]>([]);
	let addSearching = $state(false);
	let addPicked = $state<Record<string, Person>>({});
	let addBusy = $state(false);
	let addTimer: ReturnType<typeof setTimeout> | undefined;

	const canManage = $derived(!!group?.canManage);
	const isOwner = $derived(group?.myRole === 'owner');
	const inviteUrl = $derived(
		group?.inviteCode && typeof location !== 'undefined'
			? `${location.origin}/g/${group.inviteCode}`
			: ''
	);
	const addPickedList = $derived(Object.values(addPicked));
	const memberCountText = $derived(
		group
			? group.memberCount === 1
				? i18n.t('group.membersOne')
				: i18n.t('group.members', { n: group.memberCount })
			: ''
	);

	/* Owner first, then admins, then everyone else alphabetically — the same order
	   the server returns, filtered down live rather than re-sorted. */
	const shownMembers = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return members;
		return members.filter(
			(m) =>
				m.username.toLowerCase().includes(q) ||
				(m.displayName ?? '').toLowerCase().includes(q)
		);
	});

	function nameOf(m: GroupMemberDTO | Person) {
		return m.displayName || m.username;
	}

	function roleLabel(role: GroupRole) {
		return role === 'owner'
			? i18n.t('group.roleOwner')
			: role === 'admin'
				? i18n.t('group.roleAdmin')
				: '';
	}

	onMount(() => {
		void load();
		if (page.url.searchParams.get('add') === '1') openAdd();
		return () => {
			clearTimeout(addTimer);
			if (photoPreview) URL.revokeObjectURL(photoPreview);
		};
	});

	async function load() {
		loading = true;
		try {
			const res = await fetch(`/api/chats/${chatId}/group`);
			if (res.status === 404) {
				notFound = true;
				return;
			}
			const json = await res.json();
			if (!res.ok) {
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			loading = false;
		}
	}

	function apply(json: { group?: GroupInfoDTO | null; members?: GroupMemberDTO[] }) {
		if (json.group) group = json.group;
		if (json.members) members = json.members;
	}

	function startEdit() {
		if (!group) return;
		draftTitle = group.title;
		draftDescription = group.description ?? '';
		photoFile = null;
		removePhoto = false;
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoPreview = null;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		photoFile = null;
		removePhoto = false;
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoPreview = null;
	}

	function pickPhoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoFile = file;
		photoPreview = URL.createObjectURL(file);
		removePhoto = false;
	}

	function dropPhoto() {
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoFile = null;
		photoPreview = null;
		removePhoto = true;
	}

	async function saveEdit() {
		if (!group || saving) return;
		const title = draftTitle.trim();
		if (!title) {
			toast(i18n.t('group.nameRequired'), 'err');
			return;
		}
		saving = true;
		try {
			/* Multipart whenever a photo is involved, JSON otherwise — the endpoint
			   accepts both, and JSON keeps the common rename cheap. */
			let res: Response;
			if (photoFile || removePhoto) {
				const form = new FormData();
				form.set('title', title);
				form.set('description', draftDescription.trim());
				if (photoFile) form.set('photo', photoFile);
				if (removePhoto) form.set('removePhoto', '1');
				res = await fetch(`/api/chats/${chatId}/group`, { method: 'PATCH', body: form });
			} else {
				res = await fetch(`/api/chats/${chatId}/group`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ title, description: draftDescription.trim() })
				});
			}
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
			hapticSuccess();
			toast(i18n.t('group.saved'));
			cancelEdit();
		} catch {
			hapticFail();
			toast(i18n.t('common.error'), 'err');
		} finally {
			saving = false;
		}
	}

	async function setPermission(key: 'posting' | 'inviting', value: 'members' | 'admins') {
		if (!group || group[key] === value || acting) return;
		acting = true;
		haptic(8);
		try {
			const res = await fetch(`/api/chats/${chatId}/group`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ [key]: value })
			});
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	async function copyInvite() {
		if (!inviteUrl) return;
		try {
			await navigator.clipboard.writeText(inviteUrl);
			hapticSuccess();
			toast(i18n.t('group.linkCopied'));
		} catch {
			toast(i18n.t('common.error'), 'err');
		}
	}

	async function resetInvite() {
		if (acting) return;
		if (!(await confirmDialog(i18n.t('group.resetLink')))) return;
		acting = true;
		try {
			const res = await fetch(`/api/chats/${chatId}/invite`, { method: 'POST' });
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
			hapticSuccess();
			toast(i18n.t('group.resetLinkDone'));
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	async function changeRole(member: GroupMemberDTO, role: GroupRole) {
		if (acting) return;
		if (role === 'owner' && !(await confirmDialog(i18n.t('group.transferConfirm', { name: nameOf(member) })))) {
			return;
		}
		acting = true;
		sheetMember = null;
		try {
			const res = await fetch(`/api/chats/${chatId}/members/${member.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role })
			});
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
			hapticSuccess();
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	async function removeMember(member: GroupMemberDTO) {
		if (acting) return;
		if (!(await confirmDialog(i18n.t('group.removeConfirm', { name: nameOf(member) })))) return;
		acting = true;
		sheetMember = null;
		try {
			const res = await fetch(`/api/chats/${chatId}/members/${member.id}`, { method: 'DELETE' });
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
			hapticSuccess();
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	async function leave() {
		if (acting) return;
		const prompt = isOwner ? i18n.t('group.leaveOwnerPrompt') : i18n.t('group.leavePrompt');
		if (!(await confirmDialog(prompt))) return;
		acting = true;
		try {
			const res = await fetch(`/api/chats/${chatId}/leave`, { method: 'POST' });
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			toast(i18n.t('group.leaveDone'));
			await goto('/', { replaceState: true });
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	async function destroy() {
		if (acting) return;
		if (!(await confirmDialog(i18n.t('group.deletePrompt')))) return;
		acting = true;
		try {
			const res = await fetch(`/api/chats/${chatId}/group`, { method: 'DELETE' });
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			toast(i18n.t('group.deleteDone'));
			await goto('/', { replaceState: true });
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			acting = false;
		}
	}

	function openAdd() {
		showAdd = true;
		addQuery = '';
		addResults = [];
		addPicked = {};
	}

	function onAddInput() {
		clearTimeout(addTimer);
		const next = addQuery.trim().replace(/^@/, '');
		if (next.length < 2) {
			addResults = [];
			addSearching = false;
			return;
		}
		addTimer = setTimeout(() => void runAddSearch(next), 220);
	}

	async function runAddSearch(term: string) {
		addSearching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
			const json = await res.json();
			// Already-joined people are dropped here rather than shown greyed out:
			// there is no useful action on them from this sheet.
			if (res.ok) {
				const have = new Set(members.map((m) => m.id));
				addResults = ((json.people ?? []) as Person[]).filter((p) => !have.has(p.id));
			}
		} catch {
			addResults = [];
		} finally {
			addSearching = false;
		}
	}

	function toggleAdd(person: Person) {
		haptic(8);
		const next = { ...addPicked };
		if (next[person.id]) delete next[person.id];
		else next[person.id] = person;
		addPicked = next;
	}

	async function commitAdd() {
		if (!addPickedList.length || addBusy) return;
		addBusy = true;
		try {
			const res = await fetch(`/api/chats/${chatId}/members`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userIds: addPickedList.map((p) => p.id) })
			});
			const json = await res.json();
			if (!res.ok) {
				hapticFail();
				toast(json.error || i18n.t('common.error'), 'err');
				return;
			}
			apply(json);
			hapticSuccess();
			toast(i18n.t('group.addDone', { n: json.added ?? addPickedList.length }));
			showAdd = false;
		} catch {
			toast(i18n.t('common.error'), 'err');
		} finally {
			addBusy = false;
		}
	}
</script>

<div class="screen">
	<header class="topbar">
		<button
			type="button"
			class="icon-btn"
			aria-label={i18n.t('back')}
			onclick={() => goBack(`/chat/${chatId}`)}
		>
			<ArrowLeft size={22} />
		</button>
		<h1>{i18n.t('group.info')}</h1>
		<div class="topbar-actions">
			{#if canManage && !editing && group}
				<button
					type="button"
					class="icon-btn"
					aria-label={i18n.t('group.editTitle')}
					onclick={startEdit}
				>
					<Pencil size={20} />
				</button>
			{/if}
		</div>
	</header>

	<div class="settings-body">
		{#if notFound}
			<div class="empty empty-animate">
				<span class="empty-icon"><Users size={28} /></span>
				<strong>{i18n.t('group.deletedForYou')}</strong>
			</div>
		{:else if loading && !group}
			<div class="empty empty-animate">
				<p>{i18n.t('chats.searching')}</p>
			</div>
		{:else if group}
			<section class="group-hero">
				<div class="group-hero-photo">
					{#if photoPreview}
						<img class="avatar group-hero-img" src={photoPreview} alt="" />
					{:else if removePhoto}
						<GroupAvatar title={draftTitle || group.title} {chatId} avatarPath={null} size={96} />
					{:else}
						<GroupAvatar
							title={group.title}
							{chatId}
							avatarPath={group.avatarPath}
							size={96}
						/>
					{/if}
					{#if editing}
						<button
							type="button"
							class="group-hero-cam"
							aria-label={i18n.t('group.changePhoto')}
							onclick={() => photoInput?.click()}
						>
							<Camera size={16} />
						</button>
						<input
							bind:this={photoInput}
							type="file"
							accept="image/*"
							class="hidden-file"
							onchange={pickPhoto}
						/>
					{/if}
				</div>

				{#if editing}
					<input
						class="group-name-input group-hero-input"
						type="text"
						maxlength="60"
						aria-label={i18n.t('group.nameLabel')}
						placeholder={i18n.t('group.namePlaceholder')}
						bind:value={draftTitle}
					/>
					<textarea
						class="group-desc-input"
						rows="3"
						maxlength="400"
						aria-label={i18n.t('group.description')}
						placeholder={i18n.t('group.descriptionPlaceholder')}
						bind:value={draftDescription}
					></textarea>
					<div class="group-edit-actions">
						<button type="button" class="btn" disabled={saving} onclick={saveEdit}>
							{i18n.t('group.save')}
						</button>
						<button type="button" class="btn btn-ghost" onclick={cancelEdit}>
							{i18n.t('dialog.cancel')}
						</button>
						{#if (group.avatarPath || photoFile) && !removePhoto}
							<button type="button" class="btn btn-ghost btn-danger-outline" onclick={dropPhoto}>
								{i18n.t('group.removePhoto')}
							</button>
						{/if}
					</div>
				{:else}
					<h2 class="group-hero-title">{group.title}</h2>
					<p class="group-hero-sub">{memberCountText}</p>
					{#if group.description}
						<p class="group-hero-desc">{group.description}</p>
					{:else if canManage}
						<p class="group-hero-desc muted">{i18n.t('group.noDescription')}</p>
					{/if}
				{/if}
			</section>

			{#if canManage}
				<section class="settings-section">
					<h2>{i18n.t('group.settings')}</h2>
					<div class="settings-card soft">
						<div class="settings-row stack">
							<span class="label">{i18n.t('group.whoCanPost')}</span>
							<div class="theme-pills stacked-pills">
								<button
									type="button"
									class="theme-pill"
									class:active={group.posting === 'members'}
									onclick={() => setPermission('posting', 'members')}
								>
									{i18n.t('group.postMembers')}
								</button>
								<button
									type="button"
									class="theme-pill"
									class:active={group.posting === 'admins'}
									onclick={() => setPermission('posting', 'admins')}
								>
									{i18n.t('group.postAdmins')}
								</button>
							</div>
						</div>
						<div class="settings-row stack">
							<span class="label">{i18n.t('group.whoCanInvite')}</span>
							<div class="theme-pills stacked-pills">
								<button
									type="button"
									class="theme-pill"
									class:active={group.inviting === 'members'}
									onclick={() => setPermission('inviting', 'members')}
								>
									{i18n.t('group.inviteMembers')}
								</button>
								<button
									type="button"
									class="theme-pill"
									class:active={group.inviting === 'admins'}
									onclick={() => setPermission('inviting', 'admins')}
								>
									{i18n.t('group.inviteAdmins')}
								</button>
							</div>
						</div>
					</div>
				</section>
			{/if}

			{#if group.inviteCode}
				<section class="settings-section">
					<h2>{i18n.t('group.inviteLink')}</h2>
					<p class="settings-section-hint">{i18n.t('group.inviteLinkHint')}</p>
					<div class="settings-card soft">
						<div class="settings-row stack">
							<span class="invite-link-value"><Link2 size={15} /> <code>{inviteUrl}</code></span>
						</div>
						<button type="button" class="settings-row link-row" onclick={copyInvite}>
							<span class="sheet-row-ico"><Copy size={17} /></span>
							<span class="label">{i18n.t('group.copyLink')}</span>
						</button>
						{#if canManage}
							<button type="button" class="settings-row link-row" onclick={resetInvite}>
								<span class="sheet-row-ico"><RefreshCw size={17} /></span>
								<span class="label">{i18n.t('group.resetLink')}</span>
							</button>
						{/if}
					</div>
				</section>
			{/if}

			<section class="settings-section">
				<h2>{i18n.t('group.membersSection')}</h2>
				<div class="settings-card soft">
					{#if group.canInvite}
						<button type="button" class="settings-row link-row accent-row" onclick={openAdd}>
							<span class="sheet-row-ico"><UserPlus size={17} /></span>
							<span class="label">{i18n.t('group.addMembers')}</span>
						</button>
					{/if}
					{#if members.length > 8}
						<div class="list-filter inline-filter">
							<span class="list-filter-ico" aria-hidden="true"><Search size={16} /></span>
							<input
								type="search"
								placeholder={i18n.t('group.pickHint')}
								aria-label={i18n.t('common.search')}
								bind:value={filter}
								autocomplete="off"
							/>
							{#if filter}
								<button
									type="button"
									class="list-filter-clear"
									aria-label={i18n.t('common.clear')}
									onclick={() => (filter = '')}
								>
									<X size={16} />
								</button>
							{/if}
						</div>
					{/if}
					<div class="member-list stagger">
						{#each shownMembers as member (member.id)}
							<button
								type="button"
								class="user-row member-row"
								onclick={() => {
									haptic(6);
									sheetMember = member;
								}}
							>
								<span class="member-avatar" class:online={isOnlineIso(member.lastSeenAt)}>
									<Avatar
										name={nameOf(member)}
										size={44}
										avatarPath={member.avatarPath}
										userId={member.id}
									/>
								</span>
								<span class="search-user-meta">
									<span class="name">
										<NameWithBadges name={nameOf(member)} badges={member.badges} size="sm" />
									</span>
									<span class="hint">@{member.username}</span>
								</span>
								{#if roleLabel(member.role)}
									<span class="role-chip" class:owner={member.role === 'owner'}>
										{roleLabel(member.role)}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</section>

			<section class="settings-section">
				<div class="settings-card soft">
					<button type="button" class="settings-row link-row danger-row" onclick={leave}>
						<span class="sheet-row-ico"><LogOut size={17} /></span>
						<span class="label">{i18n.t('group.leave')}</span>
					</button>
					{#if isOwner}
						<button type="button" class="settings-row link-row danger-row" onclick={destroy}>
							<span class="sheet-row-ico"><Trash2 size={17} /></span>
							<span class="label">{i18n.t('group.delete')}</span>
						</button>
					{/if}
				</div>
			</section>
		{/if}
	</div>
</div>

{#if sheetMember}
	{@const member = sheetMember}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (sheetMember = null)}></div>
	<div class="msg-sheet">
		<div class="msg-menu">
			<p class="sheet-section">{nameOf(member)}</p>
			<button
				type="button"
				onclick={() => {
					sheetMember = null;
					void goto(`/u/${member.username}`);
				}}
			>
				{i18n.t('group.openProfile')}
			</button>
			{#if isOwner && member.role !== 'owner'}
				{#if member.role === 'member'}
					<button type="button" onclick={() => changeRole(member, 'admin')}>
						{i18n.t('group.promote')}
					</button>
				{:else}
					<button type="button" onclick={() => changeRole(member, 'member')}>
						{i18n.t('group.demote')}
					</button>
				{/if}
				<button type="button" onclick={() => changeRole(member, 'owner')}>
					{i18n.t('group.transfer')}
				</button>
			{/if}
			{#if canManage && member.role !== 'owner' && member.id !== page.data.user?.id}
				<button type="button" class="danger" onclick={() => removeMember(member)}>
					{i18n.t('group.removeMember')}
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if showAdd}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={() => (showAdd = false)}></div>
	<div class="chat-overlay-sheet">
		<div class="overlay-head">
			<input
				type="search"
				placeholder={i18n.t('group.pickHint')}
				bind:value={addQuery}
				oninput={onAddInput}
			/>
			<button type="button" class="icon-btn" onclick={() => (showAdd = false)}>
				<X size={18} />
			</button>
		</div>
		{#if addPickedList.length}
			<div class="picked-chips">
				{#each addPickedList as person (person.id)}
					<button type="button" class="picked-chip" onclick={() => toggleAdd(person)}>
						<Avatar
							name={nameOf(person)}
							size={22}
							avatarPath={person.avatarPath}
							userId={person.id}
						/>
						<span>{nameOf(person)}</span>
						<X size={13} />
					</button>
				{/each}
			</div>
		{/if}
		<div class="overlay-body">
			{#if addQuery.trim().length < 2}
				<p class="overlay-empty">{i18n.t('group.pickHint')}</p>
			{:else if addSearching && !addResults.length}
				<p class="overlay-empty">{i18n.t('chats.searching')}</p>
			{:else if !addResults.length}
				<p class="overlay-empty">{i18n.t('group.addNobody')}</p>
			{:else}
				{#each addResults as person (person.id)}
					{@const on = !!addPicked[person.id]}
					<button
						class="user-row pick-row"
						class:picked={on}
						type="button"
						onclick={() => toggleAdd(person)}
					>
						<Avatar
							name={nameOf(person)}
							size={44}
							avatarPath={person.avatarPath}
							userId={person.id}
						/>
						<span class="search-user-meta">
							<span class="name">{nameOf(person)}</span>
							<span class="hint">@{person.username}</span>
						</span>
						<span class="pick-check" class:on aria-hidden="true">
							{#if on}<Check size={14} />{/if}
						</span>
					</button>
				{/each}
			{/if}
		</div>
		<div class="group-create-bar">
			<span class="group-create-count">
				{i18n.t('group.selectedCount', { n: addPickedList.length })}
			</span>
			<button
				type="button"
				class="btn"
				disabled={!addPickedList.length || addBusy}
				onclick={commitAdd}
			>
				{i18n.t('group.addMembers')}
			</button>
		</div>
	</div>
{/if}
