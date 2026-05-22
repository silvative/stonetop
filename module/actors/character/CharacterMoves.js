import {
	MoveGroupSnapshot,
	MoveSnapshotBuilder,
	MovelistBuilder,
	OtherItemSnapshotBuilder,
} from "../../model/CharacterSnapshot.js";

const OTHER_MOVE_TYPES = new Map([
	["background", "Background Moves"],
	["special",    "Special Moves"],
	["follower",   "Follower Moves"],
	["expedition", "Expedition Moves"],
	["homefront",  "Homefront Moves"],
]);

export class CharacterMoves {
	constructor(moveRepo, moveResources, actor, playbook) {
		this._moveRepo            = moveRepo;
		this._moveResources       = moveResources;
		this._actor               = actor;
		this._playbook            = playbook;
		this._additionalCategories = new Map();
	}

	addCategory(moveType, label) {
		this._additionalCategories.set(moveType, label);
	}

	buildOwnedMovesMap() {
		const map = new Map();
		for (const item of this._actor.items.filter(i => i.type === "move")) {
			if (!map.has(item.name)) map.set(item.name, []);
			map.get(item.name).push(item);
		}
		return map;
	}

	countOwnedByName(moveName) {
		return this._actor.items.filter(i => i.type === "move" && i.name === moveName).length;
	}

	async buildSnapshot(bgSelectedSlug) {
		const playbookData   = await this._playbook.getData();
		const actorLevel     = this._actor.system?.attributes?.level?.value ?? 1;
		const ownedAllByName = this.buildOwnedMovesMap();
		const actorItems     = [...this._actor.items];

		// ── Playbook moves ───────────────────────────────────────────────────
		let playbookMoves    = [];
		let startingMovesNote = null;
		if (playbookData) {
			const background  = playbookData.backgrounds?.find(b => b.slug === bgSelectedSlug);
			const bgMoveNames = new Set(background?.moves ?? []);
			const entries     = await this._moveRepo.getPlaybookMoves(playbookData.name);
			if (entries.length > 0) {
				const contexted       = entries.map(e =>
					e.withPlaybookContext(ownedAllByName.get(e.name) ?? [], bgMoveNames, ownedAllByName, actorLevel, playbookData.name)
				);
				const sorted          = this.sortPlaybookMoves(contexted);
				const moveResourcesMap = this._moveResources.getMoveResources();
				const source          = { type: "playbook", slug: playbookData.slug };
				playbookMoves         = sorted.map(m => m.toSnapshot(source, moveResourcesMap));
				startingMovesNote     = playbookData.startingMovesNote ?? null;
			}
		}

		// ── Basic moves ──────────────────────────────────────────────────────
		const basicEntries = await this._moveRepo.getBasicMoves();
		const basicMoves   = basicEntries.map(e =>
			e.withInstances(ownedAllByName.get(e.name) ?? []).toSnapshot({ type: "basic" })
		);

		// ── Other groups (hardcoded + registered) ────────────────────────────
		const otherGroups = [];
		for (const [moveType, label] of [...OTHER_MOVE_TYPES, ...this._additionalCategories]) {
			const items = actorItems.filter(i => i.type === "move" && i.system?.moveType === moveType);
			if (items.length > 0) {
				otherGroups.push(new MoveGroupSnapshot(
					moveType, label,
					items.map(i => _actorItemSnapshot(i, { type: moveType }))
				));
			}
		}

		// ── Free-form "other" items ──────────────────────────────────────────
		const otherMoves = actorItems
			.filter(i => i.type === "move" && i.system?.moveType === "other")
			.map(i => new OtherItemSnapshotBuilder()
				.withId(i._id)
				.withName(i.name)
				.withDescription(i.system?.description ?? null)
				.withMoveType(i.system?.moveType ?? null)
				.withOwnedId(i._id)
				.build()
			);

		return new MovelistBuilder()
			.withPlaybookMoves(playbookMoves)
			.withBasicMoves(basicMoves)
			.withOtherGroups(otherGroups)
			.withOtherMoves(otherMoves)
			.withStartingMovesNote(startingMovesNote)
			.build();
	}

	sortPlaybookMoves(moves) {
		const groups = new Map();
		for (const move of moves) {
			const key = move.minLevel ?? 0;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(move);
		}
		const result = [];
		for (const level of [...groups.keys()].sort((a, b) => a - b)) {
			result.push(..._sortGroup(groups.get(level), new Set(groups.get(level).map(m => m.name))));
		}
		return result;
	}

	async addMove(compendiumId) {
		const doc = await this._moveRepo.getPlaybookMoveDocument(compendiumId);
		if (doc) await this._actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	}

	async removeMove(ownedId) {
		if (ownedId) await this._actor.deleteEmbeddedDocuments("Item", [ownedId]);
	}

	async onDropMove(itemData) {
		const alreadyOwned = !!this._actor.items.find(i => i.type === "move" && i.name === itemData.name);
		if (alreadyOwned) return false;

		const actorPlaybook = this._actor.system?.playbook?.name ?? null;
		const itemPlaybook  = itemData.system?.playbook ?? null;
		if (itemData.system?.moveType === "playbook" && itemPlaybook && itemPlaybook !== actorPlaybook) {
			itemData = { ...itemData, system: { ...itemData.system, moveType: "other" } };
		}

		await this._actor.createEmbeddedDocuments("Item", [itemData]);
		return true;
	}

	async ensureStartingMoves(bgSelectedSlug) {
		const playbookData = await this._playbook.getData();
		if (!playbookData) return;

		const entries    = await this._moveRepo.getPlaybookMoves(playbookData.name);
		const ownedNames = new Set(this._actor.items.filter(i => i.type === "move").map(i => i.name));

		const background  = playbookData.backgrounds?.find(b => b.slug === bgSelectedSlug);
		const bgMoveNames = new Set(background?.moves ?? []);

		const missing = entries.filter(e =>
			(e.isStarting || bgMoveNames.has(e.name)) && !ownedNames.has(e.name)
		);
		if (missing.length) {
			const docs = await Promise.all(missing.map(e => this._moveRepo.getPlaybookMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}

		const basicEntries  = await this._moveRepo.getBasicMoves();
		const missingBasic  = basicEntries.filter(e => !ownedNames.has(e.name));
		if (missingBasic.length) {
			const docs = await Promise.all(missingBasic.map(e => this._moveRepo.getBasicMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _actorItemSnapshot(item, source) {
	return new MoveSnapshotBuilder()
		.withId(item._id)
		.withCompendiumId(item._id)
		.withOwnedId(item._id)
		.withName(item.name)
		.withDescription(item.system?.description ?? "")
		.withRollType(item.system?.rollType ?? null)
		.withIsStarting(false)
		.withSource(source)
		.withSourceLabel(null)
		.withOwned(true)
		.withOwnedIds([item._id])
		.withLocked(false)
		.withRequirement(null)
		.withRequiresLabel(null)
		.withResource(null)
		.withRepeat(null)
		.withRepeatable(false)
		.build();
}

function _sortGroup(moves, groupNames) {
	const dependents = new Map();
	const roots      = [];
	for (const move of moves) {
		if (!move.requires || !groupNames.has(move.requires)) {
			roots.push(move);
		} else {
			if (!dependents.has(move.requires)) dependents.set(move.requires, []);
			dependents.get(move.requires).push(move);
		}
	}
	roots.sort((a, b) => a.name.localeCompare(b.name));
	for (const deps of dependents.values()) deps.sort((a, b) => a.name.localeCompare(b.name));
	const result  = [];
	const visited = new Set();

	function visit(move) {
		if (visited.has(move.name)) return;
		visited.add(move.name);
		result.push(move);
		for (const child of dependents.get(move.name) ?? []) visit(child);
	}

	for (const root of roots) visit(root);
	moves.filter(m => !visited.has(m.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach(m => result.push(m));
	return result;
}
