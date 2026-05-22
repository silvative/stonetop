import { describe, it, expect, vi } from "vitest";
import { CharacterPlaybook } from "../../../module/actors/character/CharacterPlaybook.js";
import { PlaybookSnapshot } from "../../../module/model/CharacterSnapshot.js";

// -- Helpers ------------------------------------------------------------------

function makeActor(playbookSlug = "the-blessed") {
	return { system: { playbook: { slug: playbookSlug } } };
}

function makeRepo(data = null) {
	return { findBySlug: vi.fn(async () => data) };
}

function makeFakeSub(result = null) {
	return { buildSnapshot: vi.fn(() => result) };
}

const PLAYBOOK = {
	slug:           "the-blessed",
	name:           "The Blessed",
	img:            "img.webp",
	description:    "<p>A healer.</p>",
	statsNote:      "Assign +2/+1/+1/0/0/-1",
	lore:           [{ slug: "lore-1" }],
	backgrounds:    [{ slug: "bg-1", label: "BG 1", description: "", moves: [] }],
	instincts:      [{ word: "Pious", description: "Devout." }],
	appearance:     [["tall", "short"]],
	origin:         [{ region: "The Reach", names: ["Aldric"] }],
};

// -- getData ------------------------------------------------------------------

describe("CharacterPlaybook.getData", () => {
	it("returns null when actor has no playbook slug", async () => {
		expect(await new CharacterPlaybook(makeActor(null), makeRepo(PLAYBOOK)).getData()).toBeNull();
	});

	it("calls repo.findBySlug with the actor's playbook slug", async () => {
		const repo = makeRepo(PLAYBOOK);
		await new CharacterPlaybook(makeActor("the-blessed"), repo).getData();
		expect(repo.findBySlug).toHaveBeenCalledWith("the-blessed");
	});

	it("returns the playbook from the repo", async () => {
		expect(await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK)).getData()).toBe(PLAYBOOK);
	});

	it("returns null when repo returns null (slug not found)", async () => {
		expect(await new CharacterPlaybook(makeActor("unknown"), makeRepo(null)).getData()).toBeNull();
	});
});

// -- buildPlaybookSnapshot ----------------------------------------------------

describe("CharacterPlaybook.buildPlaybookSnapshot", () => {
	function makeSubs() {
		return {
			background: makeFakeSub("bg-snap"),
			instinct:   makeFakeSub("instinct-snap"),
			appearance: makeFakeSub("appearance-snap"),
			origin:     makeFakeSub("origin-snap"),
			lore:       makeFakeSub("lore-snap"),
		};
	}

	it("returns null when no playbook is set on actor", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		const snap = await new CharacterPlaybook(makeActor(null), makeRepo(null))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(snap).toBeNull();
	});

	it("returns a PlaybookSnapshot", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		const snap = await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(snap).toBeInstanceOf(PlaybookSnapshot);
	});

	it("snapshot has correct slug, name, img, description, statsNote", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		const snap = await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(snap.slug).toBe("the-blessed");
		expect(snap.name).toBe("The Blessed");
		expect(snap.img).toBe("img.webp");
		expect(snap.description).toBe("<p>A healer.</p>");
		expect(snap.statsNote).toBe("Assign +2/+1/+1/0/0/-1");
	});

	it("delegates to background.buildSnapshot with playbook.backgrounds", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(background.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.backgrounds);
	});

	it("delegates to instinct.buildSnapshot with playbook.instincts", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(instinct.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.instincts);
	});

	it("delegates to appearance.buildSnapshot with playbook.appearance", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(appearance.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.appearance);
	});

	it("delegates to origin.buildSnapshot with playbook.origin", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(origin.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.origin);
	});

	it("delegates to lore.buildSnapshot with playbook.lore", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(lore.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.lore);
	});

	it("snapshot sections come from subsystem buildSnapshot() results", async () => {
		const { background, instinct, appearance, origin, lore } = makeSubs();
		const snap = await new CharacterPlaybook(makeActor(), makeRepo(PLAYBOOK))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(snap.background).toBe("bg-snap");
		expect(snap.instinct).toBe("instinct-snap");
		expect(snap.appearance).toBe("appearance-snap");
		expect(snap.origin).toBe("origin-snap");
		expect(snap.lore).toBe("lore-snap");
	});

	it("falls back to empty arrays when playbook fields are absent", async () => {
		const minimal = { slug: "the-blessed", name: "The Blessed" };
		const { background, instinct, appearance, origin, lore } = makeSubs();
		await new CharacterPlaybook(makeActor(), makeRepo(minimal))
			.buildPlaybookSnapshot(background, instinct, appearance, origin, lore);
		expect(background.buildSnapshot).toHaveBeenCalledWith([]);
		expect(instinct.buildSnapshot).toHaveBeenCalledWith([]);
		expect(appearance.buildSnapshot).toHaveBeenCalledWith([]);
		expect(origin.buildSnapshot).toHaveBeenCalledWith([]);
		expect(lore.buildSnapshot).toHaveBeenCalledWith([]);
	});
});
