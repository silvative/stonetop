import { describe, it, expect, vi } from "vitest";
import { CharacterPostDeath } from "../../../module/actors/character/CharacterPostDeath.js";
import { CharacterInstincts } from "../../../module/actors/character/CharacterInstincts.js";
import { CharacterLore } from "../../../module/actors/character/CharacterLore.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeActor(items = []) {
	return {
		items,
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

function makeInsertRepo(inserts = []) {
	return {
		getAll:     async () => inserts,
		findBySlug: async (slug) => inserts.find(i => i.slug === slug) ?? null,
	};
}

function makeMoveRepo(moves = []) {
	return {
		getPostDeathMoves: async () => moves,
	};
}

function makeFakeMoves() {
	return { addCategory: vi.fn() };
}

function makePostDeath({
	flags     = makeFlags(),
	actor     = makeActor(),
	insertRepo = makeInsertRepo([]),
	moveRepo  = makeMoveRepo(),
	moves     = makeFakeMoves(),
} = {}) {
	return new CharacterPostDeath(
		flags,
		new CharacterInstincts(makeFlags()),
		new CharacterLore(makeFlags()),
		insertRepo,
		moveRepo,
		moves,
		actor,
	);
}

describe("CharacterPostDeath", () => {
	it("activeSlug returns null when unset", () => {
		const pd = makePostDeath();
		expect(pd.activeSlug).toBeNull();
	});

	it("setActiveSlug stores slug and activeSlug returns it", async () => {
		const flags = makeFlags();
		const pd = makePostDeath({ flags });
		await pd.setActiveSlug("revenant");
		expect(flags.setFlag).toHaveBeenCalledWith("slug", "revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("instinct returns the CharacterInstincts instance", () => {
		const pd = makePostDeath();
		expect(pd.instinct).toBeInstanceOf(CharacterInstincts);
	});

	it("lore returns the CharacterLore instance", () => {
		const pd = makePostDeath();
		expect(pd.lore).toBeInstanceOf(CharacterLore);
	});
});

describe("CharacterPostDeath.setInsert", () => {
	it("removes existing post-death-* items and clears slug when called with null", async () => {
		const existing = [
			{ _id: "m1", type: "move", system: { moveType: "post-death-revenant" } },
			{ _id: "m2", type: "move", system: { moveType: "post-death-ghost" } },
		];
		const actor = makeActor(existing);
		const pd = makePostDeath({ actor });
		await pd.setInsert(null);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["m1", "m2"]);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(pd.activeSlug).toBeNull();
	});

	it("skips deleteEmbeddedDocuments when no post-death items owned", async () => {
		const actor = makeActor([{ _id: "x1", type: "move", system: { moveType: "playbook" } }]);
		const pd = makePostDeath({ actor });
		await pd.setInsert("revenant");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("removes old post-death-* items when switching insert", async () => {
		const existing = [{ _id: "old1", type: "move", system: { moveType: "post-death-ghost" } }];
		const actor = makeActor(existing);
		const pd = makePostDeath({ actor });
		await pd.setInsert("revenant");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["old1"]);
	});

	it("sets the active slug after a successful insert", async () => {
		const actor = makeActor();
		const pd = makePostDeath({ actor });
		await pd.setInsert("revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("does not call createEmbeddedDocuments when slug is null", async () => {
		const actor = makeActor();
		const pd = makePostDeath({ actor });
		await pd.setInsert(null);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("creates move items with moveType 'post-death-{slug}'", async () => {
		const actor = makeActor();
		const moveRepo = makeMoveRepo([{ name: "Haunt", rollType: "wis", description: "A ghost." }]);
		const pd = makePostDeath({ actor, moveRepo });
		await pd.setInsert("revenant");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "post-death-revenant" }) }),
		]);
	});

	it("calls moves.addCategory with 'post-death-{slug}' and insert name", async () => {
		const insertRepo = makeInsertRepo([
			{ slug: "revenant", name: "Revenant", img: null, description: "", instincts: [], lore: [] },
		]);
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ insertRepo, moves: fakeMoves });
		await pd.setInsert("revenant");
		expect(fakeMoves.addCategory).toHaveBeenCalledWith("post-death-revenant", "Revenant");
	});

	it("does not call moves.addCategory when slug is null", async () => {
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ moves: fakeMoves });
		await pd.setInsert(null);
		expect(fakeMoves.addCategory).not.toHaveBeenCalled();
	});
});

describe("CharacterPostDeath.buildSnapshot", () => {
	it("activeInsert is null when no slug is set", async () => {
		const pd = makePostDeath({ insertRepo: makeInsertRepo([]) });
		const snap = await pd.buildSnapshot();
		expect(snap.activeInsert).toBeNull();
	});

	it("activeInsert.moves come from actor items with moveType 'post-death-{slug}'", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instincts: [], lore: [] };
		const actor = makeActor([
			{ _id: "pd1", type: "move", name: "Haunt", system: { moveType: "post-death-revenant", rollType: "wis", description: "A ghost." }, flags: {} },
		]);
		const pd = makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
			actor,
		});
		const snap = await pd.buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(1);
		expect(snap.activeInsert.moves[0].name).toBe("Haunt");
	});

	it("activeInsert.moves is empty when no post-death-{slug} items owned", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instincts: [], lore: [] };
		const pd = makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
			actor: makeActor([]),
		});
		const snap = await pd.buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(0);
	});

	it("calls moves.addCategory when slug is set", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instincts: [], lore: [] };
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
			moves: fakeMoves,
		});
		await pd.buildSnapshot();
		expect(fakeMoves.addCategory).toHaveBeenCalledWith("post-death-revenant", "Revenant");
	});

	it("does not call moves.addCategory when no slug is set", async () => {
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ moves: fakeMoves });
		await pd.buildSnapshot();
		expect(fakeMoves.addCategory).not.toHaveBeenCalled();
	});
});
