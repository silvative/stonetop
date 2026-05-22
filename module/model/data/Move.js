import {Resource} from "./Resource.js";
import {MoveSnapshotBuilder, RequirementSnapshot, ResourceBuilder} from "../CharacterSnapshot.js";

export class Move {
	constructor(data) {
		this.id          = data._id;
		this.name        = data.name;
		this.playbook    = data.system?.playbook        ?? null;
		this.rollType    = data.system?.rollType        ?? null;
		this.description = data.system?.description     ?? null;
		this.isStarting  = data.system?.isStartingMove  ?? false;
		this.requirement = data.system?.requirement     ?? null;
		this.repeatMax   = data.system?.repeatMax       ?? null;
		this.resource    = data.system?.resource ? new Resource(data.system.resource) : null;
		// actor-state defaults
		this.owned            = false;
		this.ownedId          = null;
		this.ownedIds         = [];
		this.locked           = false;
		this.sourceLabel      = null;
		this.requiresPlaybook = null;
		this.requiresLabel    = null;
		this.repeatable       = false;
		this.repeatChecks     = null;
	}

	get requires() { return this.requirement?.moves?.[0] ?? null; }
	get minLevel()  { return this.requirement?.level      ?? null; }

	withInstances(instances) {
		const lastOwnedId = instances[instances.length - 1]?._id ?? null;
		this.owned    = instances.length > 0;
		this.ownedId  = lastOwnedId;
		this.ownedIds = instances.map(i => i._id);
		return this;
	}

	withPlaybookContext(ownedInstances, bgMoveNames, ownedAllByName, actorLevel, actorPlaybook) {
		const isFromPlaybook   = this.isStarting;
		const isFromBackground = bgMoveNames.has(this.name);
		const req              = this.requirement;
		const requiresMoves    = req?.moves ?? [];
		const repeatMax        = this.repeatMax ?? 1;
		const lastOwnedId      = ownedInstances[ownedInstances.length - 1]?._id ?? null;

		this.owned            = ownedInstances.length > 0;
		this.ownedId          = lastOwnedId;
		this.ownedIds         = ownedInstances.map(i => i._id);
		this.isStarting       = isFromPlaybook || isFromBackground;
		this.sourceLabel      = isFromPlaybook ? "Starting" : isFromBackground ? "Background" : null;
		this.requiresPlaybook = req?.playbook ?? null;
		this.requiresLabel    = requiresMoves.length > 0 ? requiresMoves.join(", ") : null;
		this.repeatable       = repeatMax > 1;
		this.locked           = !this.isStarting && !!(
			requiresMoves.some(m => !ownedAllByName.has(m)) ||
			(this.requiresPlaybook && this.requiresPlaybook !== actorPlaybook) ||
			(req?.level && actorLevel < req.level)
		);
		this.repeatChecks = this.repeatable
			? Array.from({ length: repeatMax }, (_, i) => ({
				checked:  i < ownedInstances.length,
				ownedId:  i < ownedInstances.length ? lastOwnedId : null,
				disabled: this.isStarting || this.locked || (!(i < ownedInstances.length) && i !== ownedInstances.length),
			}))
			: null;
		return this;
	}

	toSnapshot(source, moveResourcesMap = {}) {
		const resource    = this.resource ? new ResourceBuilder()
			.withCurrent(moveResourcesMap[this.name] ?? 0)
			.withMax(this.resource.max)
			.withTitle(this.resource.title ?? null)
			.withLabels(this.resource.labels ?? [])
			.build() : null;
		const repeat      = this.repeatable
			? { max: this.repeatMax, current: this.ownedIds.length }
			: null;
		const requirement = this.requiresLabel
			? new RequirementSnapshot(this.requiresLabel, !this.locked)
			: null;
		return new MoveSnapshotBuilder()
			.withId(this.id)
			.withCompendiumId(this.id)
			.withOwnedId(this.ownedId)
			.withName(this.name)
			.withDescription(this.description ?? "")
			.withRollType(this.rollType)
			.withIsStarting(this.isStarting)
			.withSource(source)
			.withSourceLabel(this.sourceLabel)
			.withOwned(this.owned)
			.withOwnedIds(this.ownedIds)
			.withLocked(this.locked)
			.withRequirement(requirement)
			.withRequiresLabel(requirement?.label ?? null)
			.withResource(resource)
			.withRepeat(repeat)
			.withRepeatable(repeat !== null)
			.build();
	}
}
