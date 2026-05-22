import { ValueMax, VitalsSnapshotBuilder } from "../../model/CharacterSnapshot.js";

export class CharacterVitals {
	constructor(actor, playbook, inventory) {
		this._actor    = actor;
		this._playbook = playbook;
		this._inventory = inventory;
	}

	async buildVitalsSnapshot() {
		const [playbookData, armorValue] = await Promise.all([
			this._playbook.getData(),
			this._inventory.getArmor(),
		]);
		const attrs = this._actor.system?.attributes ?? {};
		const level = attrs.level?.value ?? 1;
		return new VitalsSnapshotBuilder()
			.withHp(playbookData ? new ValueMax(attrs.hp?.value ?? 0, playbookData.hp ?? 0) : new ValueMax(0, 0))
			.withDamage(playbookData?.damage ?? null)
			.withArmor(armorValue)
			.withLevel(level)
			.withXp(new ValueMax(attrs.xp?.value ?? 0, 6 + level * 2))
			.build();
	}
}
