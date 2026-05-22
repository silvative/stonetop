import {CharacterSnapshotBuilder} from "../../model/CharacterSnapshot.js";
import {MoveResources} from "./MoveResources.js";
import {CharacterMoves} from "./CharacterMoves.js";
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {CharacterArcana} from "./CharacterArcana.js";
import {CharacterLore} from "./CharacterLore.js";
import {CharacterPostDeath} from "./CharacterPostDeath.js";
import {CharacterStats} from "./CharacterStats.js";
import {CharacterVitals} from "./CharacterVitals.js";
import {CharacterPlaybook} from "./CharacterPlaybook.js";
import {FoundryRepositoryFactory} from "./repositories/FoundryRepositoryFactory.js";

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"), actor);
		this._lore = new CharacterLore(new StonetopFlags(actor, "lore"));
		this._stats = new CharacterStats(actor);
		this._playbook = new CharacterPlaybook(actor, repos.playbook);
		this._moveResources = new MoveResources(new StonetopFlags(actor, "moves"));
		this._moves = new CharacterMoves(repos.moves, this._moveResources, actor, this._playbook);
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"), this._moves);
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"), repos.inventory, this._possessions, actor, this._playbook);
		this._arcana = new CharacterArcana(new StonetopFlags(actor, "arcana"), repos.arcana, this._stats, this._inventory);
		this._vitals = new CharacterVitals(actor, this._playbook, this._inventory);
		this._postDeath = new CharacterPostDeath(
			new StonetopFlags(actor, "postDeathInsert"),
			new CharacterInstincts(new StonetopFlags(actor, "postDeathInstinct")),
			new CharacterLore(new StonetopFlags(actor, "postDeathLore")),
			repos.postDeathInsert,
			repos.moves,
			this._moves,
			actor,
		);
	}

	static create(actor) {
		return new StonetopCharacter(actor, new FoundryRepositoryFactory());
	}

	get type() {
		return this._actor.type;
	}

	get background() {
		return this._background;
	}

	get instinct() {
		return this._instinct;
	}

	get appearance() {
		return this._appearance;
	}

	get origin() {
		return this._origin;
	}

	get possessions() {
		return this._possessions;
	}

	async playbook() {
		return this._playbook.getData();
	}

	async buildSnapshot() {
		const actor = this._actor;
		const actorItems = [...actor.items];
		const arcanaItems = await this._arcana.weightedInventoryItems();
		const inventory = await this._inventory.buildSnapshot(actorItems, arcanaItems);
		const postDeath = await this._postDeath.buildSnapshot();
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(await this._playbook.buildPlaybookSnapshot(this._background, this._instinct, this._appearance, this._origin, this._lore))
			.withDebilities(this._stats.buildDebilitiesSnapshot())
			.withStats(this._stats.buildStatsSnapshot())
			.withVitals(await this._vitals.buildVitalsSnapshot())
			.withMoves(await this._moves.buildSnapshot(this._background.selectedSlug))
			.withInventory(inventory)
			.withArcana(await this._arcana.buildSnapshot())
			.withPostDeathInsert(postDeath)
			.withRollMode(actor.flags?.pbta?.rollMode ?? "normal")
			.build();
	}

	async setPostDeathInsert(slug) {
		await this._postDeath.setInsert(slug);
	}

	async setPostDeathInstinct(value) {
		await this._postDeath.instinct.select(value);
	}

	async setPostDeathLoreCount(loreSlug, optSlug, n) {
		await this._postDeath.lore.setCount(loreSlug, optSlug, n);
	}

	async setPostDeathLoreText(loreSlug, optSlug, value) {
		await this._postDeath.lore.setText(loreSlug, optSlug, value);
	}

	async setInventoryItemChecked(slug, isChecked) {
		await this._inventory.setItemChecked(slug, isChecked);
	}

	async setInventoryResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	async setInventoryLoadLevel(level) {
		await this._inventory.setLoadLevel(level);
	}

	async setInventoryRegularPool(count) {
		await this._inventory.setRegularPool(count);
	}

	async setInventorySmallPool(count) {
		await this._inventory.setSmallPool(count);
	}

	async addMoveResource(button) {
		await this._moveResources.add(button);
	}

	async addCustomInventoryItem(name, weight) {
		await this._inventory.addCustomItem(name, weight);
	}

	async addCustomSmallItem(name) {
		await this._inventory.addCustomSmallItem(name);
	}

	async removeCustomInventoryItem(itemId) {
		await this._inventory.removeCustomItem(itemId);
	}

	async selectPossession(slug) {
		await this._possessions.select(slug);
	}

	async deselectPossession(slug) {
		await this._possessions.deselect(slug);
	}

	async setPossessionUses(slug, count) {
		await this._possessions.setUses(slug, count);
	}

	async selectSubChoice(possessionSlug, choiceSlug) {
		await this._possessions.addSubChoice(possessionSlug, choiceSlug);
	}

	async deselectSubChoice(possessionSlug, choiceSlug) {
		await this._possessions.removeSubChoice(possessionSlug, choiceSlug);
	}

	async selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		await this._possessions.selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs);
	}

	async setSubChoiceUses(possessionSlug, choiceSlug, count) {
		await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count);
	}

	async selectBackground(slug) {
		await this._background.selectBackground(slug);
		await this.ensureStartingMoves();
	}

	async ensureStartingMoves() {
		await this._moves.ensureStartingMoves(this._background.selectedSlug);
	}

	async onDropItems(items) {
		const arcana = items.filter(i => i.type === "move" && i.system?.moveType === "arcanum");
		const moves = items.filter(i => i.type === "move" && i.system?.moveType !== "arcanum");
		const others = items.filter(i => i.type !== "move");
		let anyAdded = false;
		for (const item of arcana) {
			const slug = item.flags?.stonetop?.slug;
			if (slug) {
				await this.addArcanum(slug);
				anyAdded = true;
			}
		}
		for (const item of moves) {
			if (await this.onDropMove(item)) anyAdded = true;
		}
		return {anyAdded, others};
	}

	async addMove(compendiumId) {
		await this._moves.addMove(compendiumId);
	}

	async removeMove(ownedId) {
		await this._moves.removeMove(ownedId);
	}

	async _onCreateDescendantDocuments(documents) {
		const stonetopItem = documents.find(d => d.type === "playbook");
		if (!stonetopItem) return;
		const stonetopPlaybook = stonetopItem.asPlaybook();

		const hp = stonetopPlaybook.hp;
		const damage = stonetopPlaybook.damage;
		if (hp && damage) {
			await this._actor.update({
				"system.attributes.hp.max": hp,
				"system.attributes.hp.value": hp,
				"system.attributes.damage.value": damage,
			});
		}
		await this.ensureStartingMoves();
	}

	async onRoll(event) {
		return this._stats.onRoll(event);
	}

	async onDropMove(itemData) {
		return this._moves.onDropMove(itemData);
	}

	async addArcanum(slug) {
		await this._arcana.addArcanum(slug);
	}

	async removeArcanum(slug) {
		await this._arcana.removeArcanum(slug);
	}

	async flipArcanum(slug) {
		await this._arcana.flipArcanum(slug);
	}

	async unflipArcanum(slug) {
		await this._arcana.unflipArcanum(slug);
	}

	async setArcanumUnlockCount(arcanumSlug, optionSlug, count) {
		await this._arcana.setUnlockCount(arcanumSlug, optionSlug, count);
	}

	async setArcanumBackOptionCount(arcanumSlug, optionSlug, count) {
		await this._arcana.setBackOptionCount(arcanumSlug, optionSlug, count);
	}

	async setArcanumResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	async setLoreOptionCount(loreSlug, optionSlug, count) {
		await this._lore.setCount(loreSlug, optionSlug, count);
	}

	async setLoreOptionText(loreSlug, optionSlug, value) {
		await this._lore.setText(loreSlug, optionSlug, value);
	}
}
