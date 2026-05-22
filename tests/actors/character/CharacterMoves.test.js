import { describe, expect, it, vi } from "vitest";
import { CharacterMoves } from "../../../module/actors/character/CharacterMoves.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import {
	MoveGroupSnapshot,
	MoveSnapshot,
	Movelist,
	OtherItemSnapshot,
} from "../../../module/model/CharacterSnapshot.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResources(map = {}) {
	return { getMoveResources: () => map };
}

function makeActor(items = [], playbookName = null) {
	return {
		items,
		system: { playbook: { name: playbookName } },
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

function makeFakePlaybook(data = null) {
	return { getData: async () => data };
}

function makeMoves(repo = new FakeMoveRepository(), resources = makeResources(), actor = makeActor(), playbook = null) {
	return new CharacterMoves(repo, resources, actor, playbook ?? makeFakePlaybook());
}

function makePlaybookData(overrides = {}) {
	return {
		slug: "the-heavy",
		name: "The Heavy",
		startingMovesNote: null,
		backgrounds: [],
		...overrides,
	};
}

function makeMoveItem(overrides = {}) {
	return {
		_id: overrides._id ?? "item1",
		type: "move",
		name: overrides.name ?? "Test Move",
		system: {
			moveType: overrides.moveType ?? "other",
			rollType: overrides.rollType ?? null,
			description: overrides.description ?? "",
		},
		flags: overrides.flags ?? {},
	};
}

// ── buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — empty", () => {
	it("returns a Movelist when no playbook, no basic moves, no actor items", async () => {
		const result = await makeMoves().buildSnapshot(null);
		expect(result).toBeInstanceOf(Movelist);
	});

	it("playbookMoves and basicMoves are both empty when nothing is configured", async () => {
		const result = await makeMoves(new FakeMoveRepository([], [])).buildSnapshot(null);
		expect(result.playbookMoves).toHaveLength(0);
		expect(result.basicMoves).toHaveLength(0);
	});
});

describe("CharacterMoves.buildSnapshot — basic moves", () => {
	it("basicMoves has one move when basic move is present", async () => {
		const repo = new FakeMoveRepository();
		repo.addBasic({ _id: "b1", name: "Defy Danger", system: { rollType: "str", isStartingMove: false } });
		const result = await makeMoves(repo).buildSnapshot(null);
		expect(result.basicMoves).toHaveLength(1);
	});

	it("basic move is marked owned when actor owns it by name", async () => {
		const repo = new FakeMoveRepository();
		repo.addBasic({ _id: "b1", name: "Defy Danger", system: { rollType: "str", isStartingMove: false } });
		const actor = makeActor([{ _id: "own1", type: "move", name: "Defy Danger" }]);
		const result = await makeMoves(repo, makeResources(), actor).buildSnapshot(null);
		expect(result.basicMoves[0].owned).toBe(true);
		expect(result.basicMoves[0].ownedId).toBe("own1");
	});

	it("basic move is unowned when actor does not own it", async () => {
		const repo = new FakeMoveRepository();
		repo.addBasic({ _id: "b1", name: "Defy Danger", system: { rollType: "str", isStartingMove: false } });
		const result = await makeMoves(repo).buildSnapshot(null);
		expect(result.basicMoves[0].owned).toBe(false);
		expect(result.basicMoves[0].ownedId).toBeNull();
	});

	it("basic move has source={type:'basic'}", async () => {
		const repo = new FakeMoveRepository();
		repo.addBasic({ _id: "b1", name: "Defy Danger", system: { rollType: null, isStartingMove: false } });
		const result = await makeMoves(repo).buildSnapshot(null);
		expect(result.basicMoves[0].source).toEqual({ type: "basic" });
	});
});

describe("CharacterMoves.buildSnapshot — playbook moves", () => {
	it("playbookMoves has one move when playbook move is present", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Bulwark", system: { moveType: "playbook", isStartingMove: true } });
		const result = await makeMoves(repo, makeResources(), makeActor(), makeFakePlaybook(makePlaybookData())).buildSnapshot(null);
		expect(result.playbookMoves).toHaveLength(1);
	});

	it("startingMovesNote comes from playbook startingMovesNote", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Bulwark", system: { moveType: "playbook", isStartingMove: true } });
		const playbook = makePlaybookData({ startingMovesNote: "Choose 2 to start." });
		const result = await makeMoves(repo, makeResources(), makeActor(), makeFakePlaybook(playbook)).buildSnapshot(null);
		expect(result.startingMovesNote).toBe("Choose 2 to start.");
	});

	it("starting playbook move has sourceLabel='Starting'", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Bulwark", system: { moveType: "playbook", isStartingMove: true } });
		const result = await makeMoves(repo, makeResources(), makeActor(), makeFakePlaybook(makePlaybookData())).buildSnapshot(null);
		expect(result.playbookMoves[0].sourceLabel).toBe("Starting");
	});

	it("background move has sourceLabel='Background'", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Harden", system: { moveType: "playbook", isStartingMove: false } });
		const playbook = makePlaybookData({ backgrounds: [{ slug: "warrior", label: "Warrior", moves: ["Harden"] }] });
		const result = await makeMoves(repo, makeResources(), makeActor(), makeFakePlaybook(playbook)).buildSnapshot("warrior");
		expect(result.playbookMoves[0].sourceLabel).toBe("Background");
	});

	it("non-starting non-background move has sourceLabel=null", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Optional Move", system: { moveType: "playbook", isStartingMove: false } });
		const result = await makeMoves(repo, makeResources(), makeActor(), makeFakePlaybook(makePlaybookData())).buildSnapshot(null);
		expect(result.playbookMoves[0].sourceLabel).toBeNull();
	});

	it("playbook move resource pulls current count from moveResources", async () => {
		const repo = new FakeMoveRepository();
		repo.addPlaybook({ _id: "p1", name: "Resource Move", system: {
			moveType: "playbook", isStartingMove: true,
			resource: { max: 3, title: "Favor", labels: [] },
		}});
		const resources = makeResources({ "Resource Move": 2 });
		const result = await makeMoves(repo, resources, makeActor(), makeFakePlaybook(makePlaybookData())).buildSnapshot(null);
		expect(result.playbookMoves[0].resource.current).toBe(2);
		expect(result.playbookMoves[0].resource.max).toBe(3);
	});

	it("playbookMoves is empty when playbook has no moves", async () => {
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), makeActor(), makeFakePlaybook(makePlaybookData())).buildSnapshot(null);
		expect(result.playbookMoves).toHaveLength(0);
	});

	it("playbookMoves is empty when no playbook selected", async () => {
		const result = await makeMoves().buildSnapshot(null);
		expect(result.playbookMoves).toHaveLength(0);
	});
});

describe("CharacterMoves.buildSnapshot — other move types", () => {
	it("otherGroups has a group for 'special' moves from actor items", async () => {
		const actor = makeActor([makeMoveItem({ _id: "s1", moveType: "special", name: "Special Power" })]);
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).buildSnapshot(null);
		const group = result.otherGroups.find(g => g.key === "special");
		expect(group).toBeDefined();
		expect(group.moves[0].name).toBe("Special Power");
	});

	it("otherGroups has a group for 'follower' moves", async () => {
		const actor = makeActor([makeMoveItem({ moveType: "follower", name: "Trusted Ally" })]);
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).buildSnapshot(null);
		expect(result.otherGroups.find(g => g.key === "follower")?.moves[0].name).toBe("Trusted Ally");
	});

	it("otherGroups is empty when no other-type items exist", async () => {
		const result = await makeMoves().buildSnapshot(null);
		expect(result.otherGroups).toHaveLength(0);
	});

	it("otherMoves is collected from actor items with moveType 'other'", async () => {
		const actor = makeActor([{_id: "x", type: "move", name: "Other Thing", system: {moveType: "other", description: null, rollType: null}, flags: {}}]);
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).buildSnapshot(null);
		expect(result.otherMoves).toHaveLength(1);
		expect(result.otherMoves[0]).toBeInstanceOf(OtherItemSnapshot);
		expect(result.otherMoves[0].name).toBe("Other Thing");
	});

	it("otherMoves is empty when no 'other' type items in actor", async () => {
		expect((await makeMoves().buildSnapshot(null)).otherMoves).toHaveLength(0);
	});
});

describe("CharacterMoves.buildSnapshot — post-death", () => {
	it("no otherGroups entry for post-death-* when addCategory not called", async () => {
		const actor = makeActor([makeMoveItem({ _id: "pd1", moveType: "post-death-revenant", name: "Haunt" })]);
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).buildSnapshot(null);
		expect(result.otherGroups.find(g => g.key === "post-death-revenant")).toBeUndefined();
	});

	it("registered post-death category appears in otherGroups with correct label and moves", async () => {
		const actor = makeActor([makeMoveItem({ _id: "pd1", moveType: "post-death-revenant", name: "Haunt" })]);
		const moves = makeMoves(new FakeMoveRepository(), makeResources(), actor);
		moves.addCategory("post-death-revenant", "Revenant");
		const result = await moves.buildSnapshot(null);
		const group = result.otherGroups.find(g => g.key === "post-death-revenant");
		expect(group).toBeDefined();
		expect(group.label).toBe("Revenant");
		expect(group.moves[0].name).toBe("Haunt");
	});

	it("postDeathGroup is not present on Movelist", async () => {
		expect((await makeMoves().buildSnapshot(null))).not.toHaveProperty("postDeathGroup");
	});
});


// ── sortPlaybookMoves ─────────────────────────────────────────────────────────

function mv(name, { requires = null, minLevel = null } = {}) { return { name, requires, minLevel }; }
function names(ms) { return ms.map(m => m.name); }

describe("CharacterMoves.sortPlaybookMoves", () => {
	const moves = makeMoves();

	it("returns empty array for empty input", () => {
		expect(moves.sortPlaybookMoves([])).toEqual([]);
	});

	it("single move with no requires is returned as-is", () => {
		expect(names(moves.sortPlaybookMoves([mv("Alpha")]))).toEqual(["Alpha"]);
	});

	it("multiple independent moves are sorted alphabetically", () => {
		expect(names(moves.sortPlaybookMoves([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("a move that requires another follows it immediately", () => {
		const result = names(moves.sortPlaybookMoves([mv("Child", { requires: "Parent" }), mv("Parent"), mv("Alpha")]));
		expect(result).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("multiple moves requiring the same parent are sorted alphabetically after it", () => {
		const ms = [mv("Zeta", { requires: "Parent" }), mv("Alpha", { requires: "Parent" }), mv("Parent"), mv("Root")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Parent", "Alpha", "Zeta", "Root"]);
	});

	it("chains: grandchild follows child follows parent", () => {
		const ms = [mv("Grandchild", { requires: "Child" }), mv("Child", { requires: "Parent" }), mv("Parent")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Parent", "Child", "Grandchild"]);
	});

	it("root moves stay alphabetical while dependents follow their parents", () => {
		const ms = [
			mv("Zeal"), mv("Zeal-Child", { requires: "Zeal" }),
			mv("Armor"), mv("Armor-Child-B", { requires: "Armor" }), mv("Armor-Child-A", { requires: "Armor" }),
		];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]);
	});

	it("move requiring a non-existent parent is treated as a root", () => {
		expect(names(moves.sortPlaybookMoves([mv("Orphan", { requires: "Missing Parent" }), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]);
	});

	it("circular dependency does not infinite-loop", () => {
		const ms = [mv("A", { requires: "B" }), mv("B", { requires: "A" })];
		expect(() => moves.sortPlaybookMoves(ms)).not.toThrow();
		expect(moves.sortPlaybookMoves(ms)).toHaveLength(2);
	});

	it("level-6 moves come after all level-0 moves", () => {
		expect(names(moves.sortPlaybookMoves([mv("Bravo", { minLevel: 6 }), mv("Alpha"), mv("Charlie", { minLevel: 6 })]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("level groups are sorted ascending: 0, 2, 6", () => {
		expect(names(moves.sortPlaybookMoves([mv("L6", { minLevel: 6 }), mv("L2", { minLevel: 2 }), mv("L0")]))).toEqual(["L0", "L2", "L6"]);
	});

	it("within a level group, dependency chaining still applies", () => {
		const ms = [mv("Child", { minLevel: 6, requires: "Parent" }), mv("Parent", { minLevel: 6 }), mv("Alpha", { minLevel: 6 })];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("cross-level dependency is ignored: level-6 move requiring level-0 move stays in level-6 group", () => {
		const ms = [mv("Root"), mv("Lv6-Child", { minLevel: 6, requires: "Root" }), mv("Alpha")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Alpha", "Root", "Lv6-Child"]);
	});
});

// ── buildOwnedMovesMap ────────────────────────────────────────────────────────

describe("CharacterMoves.buildOwnedMovesMap", () => {
	it("returns empty Map when actor has no items", () => {
		expect(makeMoves().buildOwnedMovesMap().size).toBe(0);
	});

	it("returns empty Map when actor has no move-type items", () => {
		const actor = makeActor([{ _id: "e1", type: "equipment", name: "Sword" }]);
		expect(makeMoves(new FakeMoveRepository(), makeResources(), actor).buildOwnedMovesMap().size).toBe(0);
	});

	it("maps a single move name to an array containing that item", () => {
		const actor = makeActor([{ _id: "m1", type: "move", name: "Bulwark" }]);
		const map = makeMoves(new FakeMoveRepository(), makeResources(), actor).buildOwnedMovesMap();
		expect(map.get("Bulwark")).toHaveLength(1);
		expect(map.get("Bulwark")[0]._id).toBe("m1");
	});

	it("groups multiple instances of the same move name together", () => {
		const actor = makeActor([
			{ _id: "m1", type: "move", name: "Bulwark" },
			{ _id: "m2", type: "move", name: "Bulwark" },
		]);
		const map = makeMoves(new FakeMoveRepository(), makeResources(), actor).buildOwnedMovesMap();
		expect(map.get("Bulwark")).toHaveLength(2);
	});

	it("tracks different move names as separate keys", () => {
		const actor = makeActor([
			{ _id: "m1", type: "move", name: "Alpha" },
			{ _id: "m2", type: "move", name: "Beta" },
		]);
		const map = makeMoves(new FakeMoveRepository(), makeResources(), actor).buildOwnedMovesMap();
		expect(map.size).toBe(2);
	});
});

// ── countOwnedByName ─────────────────────────────────────────────────────────

describe("CharacterMoves.countOwnedByName", () => {
	it("returns 0 when actor has no items", () => {
		expect(makeMoves().countOwnedByName("Bulwark")).toBe(0);
	});

	it("returns 0 when no owned move matches the name", () => {
		const actor = makeActor([{ _id: "m1", type: "move", name: "Alpha" }]);
		expect(makeMoves(new FakeMoveRepository(), makeResources(), actor).countOwnedByName("Bulwark")).toBe(0);
	});

	it("returns 1 when actor has one move with that name", () => {
		const actor = makeActor([{ _id: "m1", type: "move", name: "Bulwark" }]);
		expect(makeMoves(new FakeMoveRepository(), makeResources(), actor).countOwnedByName("Bulwark")).toBe(1);
	});

	it("returns 2 when actor has two moves with the same name", () => {
		const actor = makeActor([
			{ _id: "m1", type: "move", name: "Bulwark" },
			{ _id: "m2", type: "move", name: "Bulwark" },
		]);
		expect(makeMoves(new FakeMoveRepository(), makeResources(), actor).countOwnedByName("Bulwark")).toBe(2);
	});

	it("ignores non-move items with the same name", () => {
		const actor = makeActor([{ _id: "e1", type: "equipment", name: "Bulwark" }]);
		expect(makeMoves(new FakeMoveRepository(), makeResources(), actor).countOwnedByName("Bulwark")).toBe(0);
	});
});

// ── addMove / removeMove ──────────────────────────────────────────────────────

describe("CharacterMoves.addMove", () => {
	it("creates an embedded document from the compendium move", async () => {
		const moveDoc = { _id: "m1", name: "Bulwark", toObject: () => ({ name: "Bulwark", type: "move" }) };
		const repo = new FakeMoveRepository([moveDoc], []);
		const actor = makeActor();
		await makeMoves(repo, makeResources(), actor).addMove("m1");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Bulwark", type: "move" }]);
	});

	it("does nothing when the compendium move is not found", async () => {
		const actor = makeActor();
		await makeMoves(new FakeMoveRepository(), makeResources(), actor).addMove("nonexistent");
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe("CharacterMoves.removeMove", () => {
	it("deletes the embedded document by id", async () => {
		const actor = makeActor();
		await makeMoves(new FakeMoveRepository(), makeResources(), actor).removeMove("item-1");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["item-1"]);
	});

	it("does nothing when ownedId is null", async () => {
		const actor = makeActor();
		await makeMoves(new FakeMoveRepository(), makeResources(), actor).removeMove(null);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

// ── ensureStartingMoves ───────────────────────────────────────────────────────

const SIMPLE_PLAYBOOK = {
	slug: "the-blessed",
	name: "The Blessed",
	backgrounds: [{ slug: "initiate", moves: ["Rites of the Land"] }],
};

function makeMoveEntry(name, isStartingMove, id) {
	return { _id: id, name, system: { isStartingMove, playbook: "The Blessed" }, toObject: () => ({ name }) };
}

describe("CharacterMoves.ensureStartingMoves", () => {
	it("does nothing when playbook returns null", async () => {
		const actor = makeActor();
		await makeMoves(new FakeMoveRepository(), makeResources(), actor).ensureStartingMoves(null);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds missing starting moves", async () => {
		const actor = makeActor();
		const repo = new FakeMoveRepository([makeMoveEntry("Rites of the Land", true, "id1")], []);
		await makeMoves(repo, makeResources(), actor, makeFakePlaybook(SIMPLE_PLAYBOOK)).ensureStartingMoves(null);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});

	it("does not add moves the actor already owns", async () => {
		const actor = makeActor([{ _id: "own1", type: "move", name: "Rites of the Land" }]);
		const repo = new FakeMoveRepository([makeMoveEntry("Rites of the Land", true, "id1")], []);
		await makeMoves(repo, makeResources(), actor, makeFakePlaybook(SIMPLE_PLAYBOOK)).ensureStartingMoves(null);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds background-specific moves based on bgSelectedSlug", async () => {
		const actor = makeActor();
		const repo = new FakeMoveRepository([makeMoveEntry("Rites of the Land", false, "id1")], []);
		await makeMoves(repo, makeResources(), actor, makeFakePlaybook(SIMPLE_PLAYBOOK)).ensureStartingMoves("initiate");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});
});

// ── onDropMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.onDropMove", () => {
	it("returns false when a move with the same name is already owned", async () => {
		const actor = makeActor([{ type: "move", name: "Barkskin" }], "The Blessed");
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor)
			.onDropMove({ name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } });
		expect(result).toBe(false);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("returns true and creates a same-playbook move as-is", async () => {
		const actor = makeActor([], "The Blessed");
		const itemData = { name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } };
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "playbook" }) }),
		]);
	});

	it("returns true and changes moveType to 'other' for cross-playbook moves", async () => {
		const actor = makeActor([], "The Fox");
		const itemData = { name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } };
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "other" }) }),
		]);
	});

	it("returns true and creates other-moveType moves without changing moveType", async () => {
		const actor = makeActor([], "The Fox");
		const itemData = { name: "Some Follower Move", type: "move", system: { moveType: "follower", playbook: null } };
		const result = await makeMoves(new FakeMoveRepository(), makeResources(), actor).onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "follower" }) }),
		]);
	});
});

// ── addCategory ───────────────────────────────────────────────────────────────

describe("CharacterMoves.addCategory", () => {
	it("category with no matching actor items does not appear in otherGroups", async () => {
		const moves = makeMoves();
		moves.addCategory("post-death-revenant", "Revenant");
		const result = await moves.buildSnapshot(null);
		expect(result.otherGroups.find(g => g.key === "post-death-revenant")).toBeUndefined();
	});

	it("registering same moveType twice uses the latest label", async () => {
		const actor = makeActor([makeMoveItem({ moveType: "post-death-revenant", name: "Haunt" })]);
		const moves = makeMoves(new FakeMoveRepository(), makeResources(), actor);
		moves.addCategory("post-death-revenant", "Old Name");
		moves.addCategory("post-death-revenant", "New Name");
		const result = await moves.buildSnapshot(null);
		expect(result.otherGroups.find(g => g.key === "post-death-revenant")?.label).toBe("New Name");
	});
});
