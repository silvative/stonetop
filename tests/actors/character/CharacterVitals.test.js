import { describe, it, expect } from "vitest";
import { CharacterVitals } from "../../../module/actors/character/CharacterVitals.js";

function makeActor(attrs = {}, playbookSlug = "the-blessed") {
	return { system: { attributes: attrs, playbook: { slug: playbookSlug } } };
}

function makeFakePlaybook(data = null) {
	return { getData: async () => data };
}

function makeInventory(armor = 0) {
	return { getArmor: async () => armor };
}

function makeVitals(attrs = {}, playbookData = null, armor = 0) {
	return new CharacterVitals(makeActor(attrs), makeFakePlaybook(playbookData), makeInventory(armor));
}

describe("CharacterVitals.buildVitalsSnapshot", () => {
	it("hp.max comes from playbook hp", async () => {
		const snap = await makeVitals({}, { hp: 20 }).buildVitalsSnapshot();
		expect(snap.hp.max).toBe(20);
	});

	it("hp.value comes from actor attrs.hp.value", async () => {
		const snap = await makeVitals({ hp: { value: 12 } }, { hp: 20 }).buildVitalsSnapshot();
		expect(snap.hp.value).toBe(12);
	});

	it("hp defaults to {value:0, max:0} when no playbook", async () => {
		const snap = await makeVitals({ hp: { value: 5 } }, null).buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 0 });
	});

	it("damage comes from playbook", async () => {
		const snap = await makeVitals({}, { hp: 18, damage: "d6" }).buildVitalsSnapshot();
		expect(snap.damage).toBe("d6");
	});

	it("damage is null when no playbook", async () => {
		const snap = await makeVitals({}, null).buildVitalsSnapshot();
		expect(snap.damage).toBeNull();
	});

	it("armor comes from inventory.getArmor()", async () => {
		const snap = await makeVitals({}, { hp: 18 }, 3).buildVitalsSnapshot();
		expect(snap.armor).toBe(3);
	});

	it("level comes from actor attrs.level.value", async () => {
		const snap = await makeVitals({ level: { value: 4 } }, { hp: 18 }).buildVitalsSnapshot();
		expect(snap.level).toBe(4);
	});

	it("level is 1 when missing from actor", async () => {
		const snap = await makeVitals({}, { hp: 18 }).buildVitalsSnapshot();
		expect(snap.level).toBe(1);
	});

	it("xp.max = 6 + level * 2", async () => {
		const snap = await makeVitals({ level: { value: 4 } }, { hp: 18 }).buildVitalsSnapshot();
		expect(snap.xp.max).toBe(14);
	});

	it("xp.value comes from actor attrs.xp.value", async () => {
		const snap = await makeVitals({ xp: { value: 5 } }, { hp: 18 }).buildVitalsSnapshot();
		expect(snap.xp.value).toBe(5);
	});

	it("defaults gracefully when actor.system.attributes is absent", async () => {
		const vitals = new CharacterVitals(
			{ system: {} },
			makeFakePlaybook({ hp: 18 }),
			makeInventory(0),
		);
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 18 });
		expect(snap.level).toBe(1);
		expect(snap.xp.max).toBe(8);
	});

	it("hp and damage are zero/null when playbook returns null", async () => {
		const vitals = new CharacterVitals(
			{ system: { attributes: {} } },
			makeFakePlaybook(null),
			makeInventory(0),
		);
		const snap = await vitals.buildVitalsSnapshot();
		expect(snap.hp).toMatchObject({ value: 0, max: 0 });
		expect(snap.damage).toBeNull();
	});
});
