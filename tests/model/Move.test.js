import { describe, it, expect } from "vitest";
import { Move } from "../../module/model/data/Move.js";
import { Resource } from "../../module/model/data/Resource.js";
import { MoveSnapshot } from "../../module/model/CharacterSnapshot.js";

// -- Fixtures -----------------------------------------------------------------

const PLAYBOOK_ENTRY = {
	_id: "pb001",
	name: "Serenity",
	system: {
		playbook:       "The Blessed",
		rollType:       "wis",
		description:    "<p>Roll +WIS.</p>",
		isStartingMove: true,
		requirement:    { level: 2, moves: ["Serenity"], playbook: null },
		repeatMax:      2,
		resource:       { max: 3, maxStat: null, title: "Stock", labels: [] },
	},
};

const BASIC_ENTRY = {
	_id: "bm001",
	name: "Defy Danger",
	system: { rollType: "stat" },
};

// -- Tests --------------------------------------------------------------------

describe("Move", () => {
	it("stores id from _id", () => {
		expect(new Move(PLAYBOOK_ENTRY).id).toBe("pb001");
	});

	it("stores name", () => {
		expect(new Move(PLAYBOOK_ENTRY).name).toBe("Serenity");
	});

	it("stores playbook", () => {
		expect(new Move(PLAYBOOK_ENTRY).playbook).toBe("The Blessed");
	});

	it("stores rollType", () => {
		expect(new Move(PLAYBOOK_ENTRY).rollType).toBe("wis");
	});

	it("stores description", () => {
		expect(new Move(PLAYBOOK_ENTRY).description).toBe("<p>Roll +WIS.</p>");
	});

	it("stores isStarting from isStartingMove", () => {
		expect(new Move(PLAYBOOK_ENTRY).isStarting).toBe(true);
	});

	it("stores requirement", () => {
		expect(new Move(PLAYBOOK_ENTRY).requirement).toEqual({ level: 2, moves: ["Serenity"], playbook: null });
	});

	it("stores repeatMax", () => {
		expect(new Move(PLAYBOOK_ENTRY).repeatMax).toBe(2);
	});

	it("wraps resource in Resource when present", () => {
		expect(new Move(PLAYBOOK_ENTRY).resource).toBeInstanceOf(Resource);
		expect(new Move(PLAYBOOK_ENTRY).resource.max).toBe(3);
		expect(new Move(PLAYBOOK_ENTRY).resource.title).toBe("Stock");
	});

	it("resource is null when absent", () => {
		expect(new Move(BASIC_ENTRY).resource).toBeNull();
	});

	describe("defaults for absent system fields", () => {
		it("playbook defaults to null", () => {
			expect(new Move(BASIC_ENTRY).playbook).toBeNull();
		});

		it("rollType defaults to null", () => {
			expect(new Move({ _id: "x", name: "x", system: {} }).rollType).toBeNull();
		});

		it("description defaults to null", () => {
			expect(new Move(BASIC_ENTRY).description).toBeNull();
		});

		it("isStarting defaults to false", () => {
			expect(new Move(BASIC_ENTRY).isStarting).toBe(false);
		});

		it("requirement defaults to null", () => {
			expect(new Move(BASIC_ENTRY).requirement).toBeNull();
		});

		it("repeatMax defaults to null", () => {
			expect(new Move(BASIC_ENTRY).repeatMax).toBeNull();
		});
	});
});

// ── withInstances ─────────────────────────────────────────────────────────────

describe("Move.withInstances", () => {
	const base = { _id: "x", name: "Test", system: {} };

	it("returns same instance for fluent chaining", () => {
		const m = new Move(base);
		expect(m.withInstances([])).toBe(m);
	});

	it("owned=false when no instances", () => {
		expect(new Move(base).withInstances([]).owned).toBe(false);
	});

	it("owned=true when instances provided", () => {
		expect(new Move(base).withInstances([{ _id: "i1" }]).owned).toBe(true);
	});

	it("ownedId=null when no instances", () => {
		expect(new Move(base).withInstances([]).ownedId).toBeNull();
	});

	it("ownedId is last instance _id", () => {
		expect(new Move(base).withInstances([{ _id: "i1" }, { _id: "i2" }]).ownedId).toBe("i2");
	});

	it("ownedIds collects all instance _ids", () => {
		expect(new Move(base).withInstances([{ _id: "a" }, { _id: "b" }]).ownedIds).toEqual(["a", "b"]);
	});

	it("ownedIds is empty array when no instances", () => {
		expect(new Move(base).withInstances([]).ownedIds).toEqual([]);
	});
});

// ── withPlaybookContext ───────────────────────────────────────────────────────

describe("Move.withPlaybookContext", () => {
	function pbEntry(overrides = {}) {
		return new Move({
			_id: overrides._id ?? "abc",
			name: overrides.name ?? "Test Move",
			system: {
				isStartingMove: overrides.isStartingMove ?? false,
				requirement:    overrides.requirement   ?? null,
				repeatMax:      overrides.repeatMax     ?? null,
				rollType:       overrides.rollType      ?? null,
				description:    overrides.description   ?? "",
			},
		});
	}

	it("returns same instance for fluent chaining", () => {
		const m = pbEntry();
		expect(m.withPlaybookContext([], new Set(), new Map(), 1, null)).toBe(m);
	});

	it("unowned move: owned=false, locked=false, ownedId=null", () => {
		const m = pbEntry().withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.owned).toBe(false);
		expect(m.locked).toBe(false);
		expect(m.ownedId).toBeNull();
	});

	it("owned move: owned=true, ownedId set to last instance", () => {
		const m = pbEntry({ name: "Bulwark" })
			.withPlaybookContext([{ _id: "xyz" }], new Set(), new Map(), 1, null);
		expect(m.owned).toBe(true);
		expect(m.ownedId).toBe("xyz");
	});

	it("isStartingMove: isStarting=true, sourceLabel='Starting', locked=false", () => {
		const m = pbEntry({ isStartingMove: true })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.isStarting).toBe(true);
		expect(m.sourceLabel).toBe("Starting");
		expect(m.locked).toBe(false);
	});

	it("background move: isStarting=true, sourceLabel='Background', locked=false", () => {
		const m = pbEntry({ name: "Trackless Step" })
			.withPlaybookContext([], new Set(["Trackless Step"]), new Map(), 1, null);
		expect(m.isStarting).toBe(true);
		expect(m.sourceLabel).toBe("Background");
		expect(m.locked).toBe(false);
	});

	it("regular optional move: isStarting=false, sourceLabel=null", () => {
		const m = pbEntry().withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.isStarting).toBe(false);
		expect(m.sourceLabel).toBeNull();
	});

	it("requires unowned move: locked=true", () => {
		const m = pbEntry({ requirement: { moves: ["Glorious Servant"] } })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.locked).toBe(true);
	});

	it("requires owned move: locked=false", () => {
		const ownedBy = new Map([["Glorious Servant", [{ _id: "gs" }]]]);
		const m = pbEntry({ requirement: { moves: ["Glorious Servant"] } })
			.withPlaybookContext([], new Set(), ownedBy, 1, null);
		expect(m.locked).toBe(false);
	});

	it("minLevel above actor level: locked=true", () => {
		const m = pbEntry({ requirement: { level: 6 } })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.locked).toBe(true);
	});

	it("minLevel at actor level: locked=false", () => {
		const m = pbEntry({ requirement: { level: 3 } })
			.withPlaybookContext([], new Set(), new Map(), 3, null);
		expect(m.locked).toBe(false);
	});

	it("starting move with requires is NOT locked (isStarting overrides)", () => {
		const m = pbEntry({ isStartingMove: true, requirement: { moves: ["Some Move"] } })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("requires playbook not matching: locked=true", () => {
		const m = pbEntry({ requirement: { playbook: "The Blessed" } })
			.withPlaybookContext([], new Set(), new Map(), 1, "The Fox");
		expect(m.locked).toBe(true);
	});

	it("requires playbook matching: locked=false", () => {
		const m = pbEntry({ requirement: { playbook: "The Blessed" } })
			.withPlaybookContext([], new Set(), new Map(), 1, "The Blessed");
		expect(m.locked).toBe(false);
	});

	it("requiresLabel joins multiple moves with comma", () => {
		const m = pbEntry({ requirement: { moves: ["Move A", "Move B"] } })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.requiresLabel).toBe("Move A, Move B");
	});

	it("requiresLabel is null when no required moves", () => {
		const m = pbEntry().withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.requiresLabel).toBeNull();
	});

	it("requiresPlaybook set from requirement.playbook", () => {
		const m = pbEntry({ requirement: { playbook: "The Blessed" } })
			.withPlaybookContext([], new Set(), new Map(), 1, "The Blessed");
		expect(m.requiresPlaybook).toBe("The Blessed");
	});

	it("repeatable=false when repeatMax is null, repeatChecks=null", () => {
		const m = pbEntry().withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.repeatable).toBe(false);
		expect(m.repeatChecks).toBeNull();
	});

	it("repeatable=true when repeatMax > 1, repeatChecks has correct length", () => {
		const m = pbEntry({ repeatMax: 2 }).withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.repeatable).toBe(true);
		expect(m.repeatChecks).toHaveLength(2);
	});
});

// ── toSnapshot ────────────────────────────────────────────────────────────────

describe("Move.toSnapshot", () => {
	it("returns a MoveSnapshot", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" })).toBeInstanceOf(MoveSnapshot);
	});

	it("snapshot.id is the move id", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" }).id).toBe("bm001");
	});

	it("snapshot.name is the move name", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" }).name).toBe("Defy Danger");
	});

	it("snapshot.source is the passed source object", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" }).source).toEqual({ type: "basic" });
	});

	it("snapshot.owned reflects withInstances", () => {
		expect(new Move(BASIC_ENTRY).withInstances([{ _id: "i1" }]).toSnapshot({ type: "basic" }).owned).toBe(true);
	});

	it("snapshot.ownedId reflects withInstances", () => {
		expect(new Move(BASIC_ENTRY).withInstances([{ _id: "i1" }]).toSnapshot({ type: "basic" }).ownedId).toBe("i1");
	});

	it("snapshot.sourceLabel comes from withPlaybookContext", () => {
		const m = new Move({ _id: "x", name: "Test", system: { isStartingMove: true } })
			.withPlaybookContext([{ _id: "i" }], new Set(), new Map(), 1, null);
		expect(m.toSnapshot({ type: "playbook" }).sourceLabel).toBe("Starting");
	});

	it("snapshot.sourceLabel is null when only withInstances was used", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" }).sourceLabel).toBeNull();
	});

	it("snapshot.resource is null when move has no resource", () => {
		expect(new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" }).resource).toBeNull();
	});

	it("snapshot.resource.current comes from moveResourcesMap", () => {
		const m = new Move(PLAYBOOK_ENTRY).withPlaybookContext([{ _id: "i" }], new Set(), new Map(), 1, null);
		expect(m.toSnapshot({ type: "playbook" }, { "Serenity": 2 }).resource.current).toBe(2);
	});

	it("snapshot.resource.current defaults to 0 when not in moveResourcesMap", () => {
		const m = new Move(PLAYBOOK_ENTRY).withPlaybookContext([{ _id: "i" }], new Set(), new Map(), 1, null);
		expect(m.toSnapshot({ type: "playbook" }).resource.current).toBe(0);
	});

	it("snapshot.locked comes from withPlaybookContext", () => {
		const m = new Move({ _id: "x", name: "Test", system: { requirement: { moves: ["Other"] } } })
			.withPlaybookContext([], new Set(), new Map(), 1, null);
		expect(m.toSnapshot({ type: "playbook" }).locked).toBe(true);
	});

	it("snapshot.repeat is null and repeatable=false when not repeatable", () => {
		const snap = new Move(BASIC_ENTRY).withInstances([]).toSnapshot({ type: "basic" });
		expect(snap.repeat).toBeNull();
		expect(snap.repeatable).toBe(false);
	});

	it("snapshot.repeat has max and current when repeatable", () => {
		const m = new Move({ _id: "x", name: "Test", system: { repeatMax: 2 } })
			.withPlaybookContext([{ _id: "i1" }], new Set(), new Map(), 1, null);
		const snap = m.toSnapshot({ type: "playbook" });
		expect(snap.repeat).toEqual({ max: 2, current: 1 });
		expect(snap.repeatable).toBe(true);
	});
});
