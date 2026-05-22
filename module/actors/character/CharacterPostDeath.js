import {
	PostDeathInsertSnapshotBuilder,
	PostDeathSectionSnapshotBuilder,
} from "../../model/snapshot/PostDeathInsertSnapshot.js";
import {
	InstinctOptionSnapshotBuilder,
	InstinctSection,
	MoveSnapshotBuilder,
} from "../../model/CharacterSnapshot.js";

export class CharacterPostDeath {
	constructor(insertFlags, instinct, lore, insertRepo, moveRepo, moves, actor) {
		this._insertFlags = insertFlags;
		this._instinct    = instinct;
		this._lore        = lore;
		this._insertRepo  = insertRepo;
		this._moveRepo    = moveRepo;
		this._moves       = moves;
		this._actor       = actor;
	}

	get activeSlug()       { return this._insertFlags.getFlag("slug") ?? null; }
	async setActiveSlug(s) { await this._insertFlags.setFlag("slug", s); }
	get instinct()         { return this._instinct; }
	get lore()             { return this._lore; }

	async setInsert(slug) {
		const toRemove = this._actor.items
			.filter(i => i.type === "move" && i.system?.moveType?.startsWith("post-death-"))
			.map(i => i._id);
		if (toRemove.length > 0) {
			await this._actor.deleteEmbeddedDocuments("Item", toRemove);
		}
		await this.setActiveSlug(slug);
		if (slug) {
			const insert   = await this._insertRepo.findBySlug(slug);
			const moveType = `post-death-${slug}`;
			this._moves.addCategory(moveType, insert?.name ?? slug);
			const entries  = await this._moveRepo.getPostDeathMoves(slug);
			await this._actor.createEmbeddedDocuments("Item", entries.map(m => ({
				name:   m.name,
				type:   "move",
				system: { moveType, rollType: m.rollType ?? "", description: m.description ?? "" },
			})));
		}
	}

	async buildSnapshot() {
		const slug       = this.activeSlug;
		const allEntries = await this._insertRepo.getAll();

		let activeInsert = null;
		if (slug) {
			const data = await this._insertRepo.findBySlug(slug);
			if (data) {
				const moveType    = `post-death-${slug}`;
				this._moves.addCategory(moveType, data.name);
				const actorPDMoves = this._actor.items
					.filter(i => i.type === "move" && i.system?.moveType === moveType);
				activeInsert = new PostDeathInsertSnapshotBuilder()
					.withSlug(data.slug)
					.withName(data.name)
					.withImg(data.img)
					.withDescription(data.description)
					.withInstinct(_buildInstinctSection(data.instincts, this._instinct.selectedValue))
					.withLore(this._lore.buildSnapshot(data.lore))
					.withMoves(_buildMoveSnapshotsFromItems(actorPDMoves))
					.build();
			}
		}
		return new PostDeathSectionSnapshotBuilder()
			.withActiveSlug(slug)
			.withActiveInsert(activeInsert)
			.withAvailableInserts(allEntries)
			.build();
	}
}

function _buildInstinctSection(instincts, selectedValue) {
	const options = (instincts ?? []).map(({ word, description }) => {
		const value = `${word} — ${description}`;
		return new InstinctOptionSnapshotBuilder()
			.withWord(word)
			.withDescription(description)
			.withValue(value)
			.withSelected(selectedValue === value)
			.build();
	});
	return new InstinctSection(selectedValue || null, options);
}

function _buildMoveSnapshotsFromItems(items) {
	return items.map(i => new MoveSnapshotBuilder()
		.withId(i._id)
		.withCompendiumId(i._id)
		.withOwnedId(i._id)
		.withName(i.name)
		.withDescription(i.system?.description ?? "")
		.withRollType(i.system?.rollType ?? null)
		.withIsStarting(true)
		.withSource({ type: "post-death" })
		.withSourceLabel(null)
		.withOwned(true)
		.withOwnedIds([i._id])
		.withLocked(false)
		.withRequirement(null)
		.withRequiresLabel(null)
		.withResource(null)
		.withRepeat(null)
		.withRepeatable(false)
		.build()
	);
}
