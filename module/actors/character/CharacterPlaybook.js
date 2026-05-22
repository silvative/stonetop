import { PlaybookSnapshotBuilder } from "../../model/CharacterSnapshot.js";

export class CharacterPlaybook {
	constructor(actor, playbookRepo) {
		this._actor = actor;
		this._repo  = playbookRepo;
	}

	async getData() {
		const slug = this._actor.system?.playbook?.slug ?? null;
		if (!slug) return null;
		return this._repo.findBySlug(slug);
	}

	async buildPlaybookSnapshot(background, instinct, appearance, origin, lore) {
		const data = await this.getData();
		if (!data) return null;
		return new PlaybookSnapshotBuilder()
			.withSlug(data.slug)
			.withName(data.name)
			.withImg(data.img ?? null)
			.withDescription(data.description ?? null)
			.withStatsNote(data.statsNote ?? null)
			.withLore(lore.buildSnapshot(data.lore ?? []))
			.withBackground(background.buildSnapshot(data.backgrounds ?? []))
			.withInstinct(instinct.buildSnapshot(data.instincts ?? []))
			.withAppearance(appearance.buildSnapshot(data.appearance ?? []))
			.withOrigin(origin.buildSnapshot(data.origin ?? []))
			.build();
	}
}
