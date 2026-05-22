import {
	LoreEntrySnapshotBuilder,
	LoreOptionSnapshotBuilder,
	LoreSection,
} from "../../model/CharacterSnapshot.js";

export class CharacterLore {
	constructor(flags) {
		this._flags = flags;
	}

	get counts() {
		return this._flags.getFlag("counts") ?? {};
	}

	getCount(loreSlug, optionSlug) {
		return this.counts[`${loreSlug}:${optionSlug}`] ?? 0;
	}

	async setCount(loreSlug, optionSlug, count) {
		const key = `${loreSlug}:${optionSlug}`;
		await this._flags.setFlag("counts", { ...this.counts, [key]: count });
	}

	get texts() {
		return this._flags.getFlag("texts") ?? {};
	}

	getText(loreSlug, optionSlug) {
		return this.texts[`${loreSlug}:${optionSlug}`] ?? "";
	}

	async setText(loreSlug, optionSlug, value) {
		const key = `${loreSlug}:${optionSlug}`;
		await this._flags.setFlag("texts", { ...this.texts, [key]: value });
	}

	buildSnapshot(loreData) {
		const entries = (loreData ?? []).map(entry => {
			const options = (entry.options ?? []).map(opt => {
				const isText = (opt.type ?? "checkbox") === "text";
				return new LoreOptionSnapshotBuilder()
					.withSlug(opt.slug)
					.withDescription(opt.description)
					.withType(opt.type ?? "checkbox")
					.withMax(isText ? 0 : (opt.max ?? 1))
					.withCount(isText ? 0 : this.getCount(entry.slug, opt.slug))
					.withTextValue(isText ? this.getText(entry.slug, opt.slug) : null)
					.build();
			});
			return new LoreEntrySnapshotBuilder()
				.withSlug(entry.slug)
				.withTitle(entry.title)
				.withDescription(entry.description ?? "")
				.withOptions(options)
				.build();
		});
		return new LoreSection(entries);
	}
}
